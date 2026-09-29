// Procedencia de los íconos de apps/movil/assets (icon, android-icon-*, splash-icon, favicon).
// Dibujados a partir del SVG de MarcaApp (src/componentes/base/Icono.tsx), rasterizados con
// qlmanage (macOS) y, en los transparentes, alfa derivado por matting negro/blanco.
// Uso: node .impeccable/generar-iconos.cjs  → escribe en .impeccable/iconos/; copiar a apps/movil/assets.
const fs=require('fs'),z=require('zlib'),{execSync}=require('child_process');
const DIR=__dirname+'/iconos';
function decode(file){const b=fs.readFileSync(file);let o=8,idat=[],w,h;while(o<b.length){const l=b.readUInt32BE(o),t=b.toString('ascii',o+4,o+8);if(t==='IHDR'){w=b.readUInt32BE(o+8);h=b.readUInt32BE(o+12);if(b[o+17]!==6||b[o+16]!==8)throw new Error('formato');}if(t==='IDAT')idat.push(b.slice(o+8,o+8+l));o+=12+l;}
const d=z.inflateSync(Buffer.concat(idat)),bpp=4,st=w*bpp,out=Buffer.alloc(h*st);
for(let y=0;y<h;y++){const f=d[y*(st+1)],r=d.slice(y*(st+1)+1,(y+1)*(st+1));for(let x=0;x<st;x++){const a=x>=bpp?out[y*st+x-bpp]:0,up=y>0?out[(y-1)*st+x]:0,c=(x>=bpp&&y>0)?out[(y-1)*st+x-bpp]:0;let v=r[x];
if(f===1)v+=a;else if(f===2)v+=up;else if(f===3)v+=(a+up)>>1;else if(f===4){const p=a+up-c,pa=Math.abs(p-a),pb=Math.abs(p-up),pc=Math.abs(p-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?up:c);}out[y*st+x]=v&255;}}return {w,h,px:out};}
function crc(buf){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}c=0xffffffff;for(const x of buf)c=t[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){const l=Buffer.alloc(4);l.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);}
function encode(file,w,h,px,alpha){const ch=alpha?4:3,raw=Buffer.alloc(h*(w*ch+1));for(let y=0;y<h;y++){raw[y*(w*ch+1)]=0;for(let x=0;x<w;x++)for(let k=0;k<ch;k++)raw[y*(w*ch+1)+1+x*ch+k]=px[(y*w+x)*4+k];}
const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=alpha?6:2;fs.writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',z.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]));}
function render(name,svg,size){const f=`${DIR}/${name}.svg`;fs.writeFileSync(f,svg);execSync(`qlmanage -t -s ${size} -o ${DIR} ${f}`,{stdio:'ignore'});return decode(`${f}.png`);}
const cubo=(stroke,cian=true)=>`${cian?'<path d="M24 11.5l11 6.25-11 6.25-11-6.25z" fill="#7FD8FF" fill-opacity="0.55"/>':''}<path d="M24 11.5l11 6.25v12.5L24 36.5l-11-6.25v-12.5zM13 17.75L24 24l11-6.25M24 24v12.5" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" fill="none"/>`;
const defs=`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5B9BFF"/><stop offset="0.45" stop-color="#2B63F6"/><stop offset="1" stop-color="#1446DB"/></linearGradient><radialGradient id="h" cx="0.85" cy="0.05" r="0.8"><stop offset="0" stop-color="#9CC3FF" stop-opacity="0.45"/><stop offset="1" stop-color="#9CC3FF" stop-opacity="0"/></radialGradient></defs>`;
const svg=(size,body,bg)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">${defs}${bg?`<rect width="48" height="48" fill="${bg}"/>`:''}${body}</svg>`;
function transparente(name,size,body){const n=render(name+'-n',svg(size,body,'#000000'),size),b=render(name+'-b',svg(size,body,'#FFFFFF'),size),out=Buffer.alloc(size*size*4);
for(let i=0;i<size*size;i++){const dn=n.px.slice(i*4,i*4+3),db=b.px.slice(i*4,i*4+3);const a=1-((db[0]-dn[0])+(db[1]-dn[1])+(db[2]-dn[2]))/(3*255);const al=Math.max(0,Math.min(1,a));for(let k=0;k<3;k++)out[i*4+k]=al>0?Math.min(255,Math.round(dn[k]/al)):0;out[i*4+3]=Math.round(al*255);}return out;}
const lleno=`<rect width="48" height="48" fill="url(#g)"/><rect width="48" height="48" fill="url(#h)"/>`;
// icon.png: full-bleed (iOS recorta sus esquinas), cubo al 62 %.
{const s=1024,r=render('icon',svg(s,`${lleno}<g transform="translate(24 24) scale(1.1) translate(-24 -24)">${cubo('#FFFFFF')}</g>`,null),s);encode(DIR+'/icon.png',s,s,r.px,false);}
{const s=512,r=render('bg',svg(s,lleno,null),s);encode(DIR+'/android-icon-background.png',s,s,r.px,false);}
{const s=512;encode(DIR+'/android-icon-foreground.png',s,s,transparente('fg',s,`<g transform="translate(24 24) scale(0.95) translate(-24 -24)">${cubo('#FFFFFF')}</g>`),true);}
{const s=512;encode(DIR+'/android-icon-monochrome.png',s,s,transparente('mono',s,`<g transform="translate(24 24) scale(0.95) translate(-24 -24)">${cubo('#FFFFFF',false)}</g>`),true);}
const placa=`<rect x="1" y="1" width="46" height="46" rx="14" fill="url(#g)" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="1.5"/>${cubo('#FFFFFF')}`;
{const s=1024;encode(DIR+'/splash-icon.png',s,s,transparente('splash',s,placa),true);}
{const s=48,r=render('fav',svg(s,`<rect x="1" y="1" width="46" height="46" rx="14" fill="url(#g)"/>${cubo('#FFFFFF')}`,'#FFFFFF'),s);encode(DIR+'/favicon.png',s,s,r.px,false);}
console.log('listo');

import { esFotoGenericaDeHandy, normalizarFotoHandy } from './foto-handy';

const FOTO_REAL =
  'https://handy-prod.s3.amazonaws.com/profile-pictures/12345/foto-vendedor.jpg';
const PLACEHOLDER = 'https://cdn.handy.la/web-app/sales/user-profile.png';

describe('esFotoGenericaDeHandy', () => {
  it('una foto real de S3 no es generica', () => {
    expect(esFotoGenericaDeHandy(FOTO_REAL)).toBe(false);
  });

  it('el placeholder de Handy es generico', () => {
    expect(esFotoGenericaDeHandy(PLACEHOLDER)).toBe(true);
  });

  it('el placeholder con query params sigue siendo generico', () => {
    expect(esFotoGenericaDeHandy(`${PLACEHOLDER}?v=2`)).toBe(true);
  });

  it('null y cadena vacia son genericos', () => {
    expect(esFotoGenericaDeHandy(null)).toBe(true);
    expect(esFotoGenericaDeHandy('')).toBe(true);
    expect(esFotoGenericaDeHandy('   ')).toBe(true);
  });

  it('algo que no es URL no sirve como foto', () => {
    expect(esFotoGenericaDeHandy('user-profile.png')).toBe(true);
  });
});

describe('normalizarFotoHandy', () => {
  it('conserva la foto real, recortando espacios', () => {
    expect(normalizarFotoHandy(`  ${FOTO_REAL} `)).toBe(FOTO_REAL);
  });

  it('el placeholder (con o sin ?v=2) se vuelve null', () => {
    expect(normalizarFotoHandy(PLACEHOLDER)).toBeNull();
    expect(normalizarFotoHandy(`${PLACEHOLDER}?v=2`)).toBeNull();
  });

  it('null y cadena vacia se vuelven null', () => {
    expect(normalizarFotoHandy(null)).toBeNull();
    expect(normalizarFotoHandy('')).toBeNull();
  });
});

import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';

import {
  LIMITE_CREDENCIALES_IP,
  LIMITE_CREDENCIALES_USUARIO,
  LIMITE_GLOBAL,
  LimiteCredenciales,
  LimitePeticionesGuard,
  SinLimiteDePeticiones,
  opcionesLimitesPeticiones,
  usuarioDeLaPeticion,
} from './limites-peticiones';

@Controller()
class PruebaController {
  @Get('a')
  a() {
    return 'a';
  }

  @Get('b')
  b() {
    return 'b';
  }

  @Post('login')
  @LimiteCredenciales()
  login(@Body() _cuerpo: unknown) {
    return 'login';
  }

  @Post('confirmar')
  @LimiteCredenciales()
  confirmar(@Body() _cuerpo: unknown) {
    return 'confirmar';
  }
}

@Controller('salud')
@SinLimiteDePeticiones()
class SaludPruebaController {
  @Get()
  salud() {
    return 'ok';
  }
}

/** JWT con la forma real (la firma no se revisa al elegir el contador). */
function tokenDe(sub: string): string {
  const parte = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return `Bearer ${parte({ alg: 'HS256' })}.${parte({ sub })}.firma`;
}

describe('limites de peticiones', () => {
  let app: NestExpressApplication;
  let advertencias: jest.SpyInstance;

  beforeEach(async () => {
    advertencias = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const modulo = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(opcionesLimitesPeticiones())],
      controllers: [PruebaController, SaludPruebaController],
      providers: [{ provide: APP_GUARD, useClass: LimitePeticionesGuard }],
    }).compile();
    app = modulo.createNestApplication<NestExpressApplication>();
    // Igual que main.ts en produccion (detras del proxy de Render).
    app.set('trust proxy', 1);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    advertencias.mockRestore();
  });

  /** Simula el proxy de Render: agrega la IP real al final del encabezado. */
  const desde = (ip: string, encabezadoDelCliente?: string) => ({
    'X-Forwarded-For': encabezadoDelCliente
      ? `${encabezadoDelCliente}, ${ip}`
      : ip,
  });

  async function pedirN(n: number, hacer: (i: number) => request.Test) {
    const estados: number[] = [];
    for (let i = 0; i < n; i++) estados.push((await hacer(i)).status);
    return estados;
  }

  const loginDe = (usuarioAppId: string, ip = '10.0.0.1') =>
    request(app.getHttpServer())
      .post('/login')
      .set(desde(ip))
      .send({ usuarioAppId, pin: '1234' });

  it('el limite global es por IP y cuenta todos los endpoints juntos', async () => {
    const servidor = app.getHttpServer();
    const mitad = LIMITE_GLOBAL.limite / 2;
    await pedirN(mitad, () =>
      request(servidor).get('/a').set(desde('1.1.1.1')),
    );
    await pedirN(mitad, () =>
      request(servidor).get('/b').set(desde('1.1.1.1')),
    );

    const excedida = await request(servidor).get('/a').set(desde('1.1.1.1'));
    expect(excedida.status).toBe(429);
    expect(excedida.body).toEqual({
      statusCode: 429,
      codigo: 'DEMASIADAS_SOLICITUDES',
      mensaje: expect.any(String),
    });

    // Otra IP (otro cliente real detras del mismo proxy) no se ve afectada.
    await request(servidor).get('/a').set(desde('2.2.2.2')).expect(200);
  });

  it('el limite de PIN es por usuario: uno machacando no frena a sus companeros de la misma IP', async () => {
    const servidor = app.getHttpServer();
    const mitad = LIMITE_CREDENCIALES_USUARIO.limite / 2;
    const estados = [
      ...(await pedirN(mitad, () => loginDe('usuarioA'))),
      // Confirmacion entre telefonos: el usuario sale del token.
      ...(await pedirN(mitad, () =>
        request(servidor)
          .post('/confirmar')
          .set(desde('10.0.0.1'))
          .set('Authorization', tokenDe('usuarioA'))
          .send({ pin: '1234', cantidadFinal: 3 }),
      )),
    ];
    expect(estados.every((e) => e === 201)).toBe(true);

    const excedida = await loginDe('usuarioA');
    expect(excedida.status).toBe(429);
    expect(excedida.body.mensaje).toMatch(/este usuario/);

    // Misma IP (la bodega), otra persona: sigue entrando y confirmando.
    await loginDe('usuarioB').expect(201);
    await request(servidor)
      .post('/confirmar')
      .set(desde('10.0.0.1'))
      .set('Authorization', tokenDe('usuarioA'))
      .send({ pin: '1234', cantidadFinal: 3, confirmaUsuarioAppId: 'usuarioC' })
      .expect(201);
    // El resto de la API sigue disponible para todos.
    await request(servidor).get('/a').set(desde('10.0.0.1')).expect(200);
  });

  it('en confirmacion en el mismo telefono cuenta contra quien confirma, no contra la sesion', () => {
    const req = {
      ip: '10.0.0.1',
      headers: { authorization: tokenDe('dueno') },
      body: { confirmaUsuarioAppId: 'otro', pin: '1234' },
    };
    expect(usuarioDeLaPeticion(req)).toBe('usuario:otro');
    expect(usuarioDeLaPeticion({ ...req, body: { pin: '1234' } })).toBe(
      'usuario:dueno',
    );
    expect(usuarioDeLaPeticion({ ip: '10.0.0.1', headers: {}, body: {} })).toBe(
      'sin-usuario:10.0.0.1',
    );
    expect(
      usuarioDeLaPeticion({
        ip: '10.0.0.1',
        headers: { authorization: 'Bearer basura' },
        body: { usuarioAppId: { $ne: 1 } },
      }),
    ).toBe('sin-usuario:10.0.0.1');
  });

  it('hay un techo por IP en los endpoints de PIN aunque cada peticion sea de otro usuario', async () => {
    const estados = await pedirN(LIMITE_CREDENCIALES_IP.limite, (i) =>
      loginDe(`usuario${i}`, '3.3.3.3'),
    );
    expect(estados.every((e) => e === 201)).toBe(true);

    const excedida = await loginDe('otroMas', '3.3.3.3');
    expect(excedida.status).toBe(429);
    expect(excedida.body.mensaje).toMatch(/esta conexión/);
  });

  it('lo que el cliente escriba en X-Forwarded-For no le da otra IP', async () => {
    const servidor = app.getHttpServer();
    const estados = await pedirN(LIMITE_CREDENCIALES_IP.limite + 1, (i) =>
      request(servidor)
        .post('/login')
        .set(desde('4.4.4.4', `9.9.9.${Math.floor(Math.random() * 250)}`))
        .send({ usuarioAppId: `usuario${i}`, pin: '1234' }),
    );
    expect(estados.at(-1)).toBe(429);
  });

  it('cada 429 deja una advertencia con ruta, limite y llave, sin PIN ni token', async () => {
    const servidor = app.getHttpServer();
    const token = tokenDe('usuarioZ');
    await pedirN(LIMITE_CREDENCIALES_USUARIO.limite + 1, () =>
      request(servidor)
        .post('/confirmar?x=1')
        .set(desde('5.5.5.6'))
        .set('Authorization', token)
        .send({ pin: '9876', cantidadFinal: 3 }),
    );

    expect(advertencias).toHaveBeenCalledTimes(1);
    const linea = String(advertencias.mock.calls[0][0]);
    expect(linea).toBe(
      `429 POST /confirmar limite=${LIMITE_CREDENCIALES_USUARIO.nombre} ` +
        `(${LIMITE_CREDENCIALES_USUARIO.limite} por 60s) llave=usuario:usuarioZ`,
    );
    expect(linea).not.toContain('9876');
    expect(linea).not.toContain(token.split(' ')[1]);
  });

  it('/salud no tiene limite', async () => {
    const servidor = app.getHttpServer();
    const estados = await pedirN(LIMITE_GLOBAL.limite + 5, () =>
      request(servidor).get('/salud').set(desde('5.5.5.5')),
    );
    expect(estados.every((e) => e === 200)).toBe(true);
  });
});

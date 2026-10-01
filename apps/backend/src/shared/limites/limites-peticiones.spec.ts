import { Controller, Get, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';

import {
  LIMITE_CREDENCIALES,
  LIMITE_GLOBAL,
  LimiteCredenciales,
  LimitePeticionesGuard,
  SinLimiteDePeticiones,
  opcionesLimitesPeticiones,
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
  login() {
    return 'login';
  }

  @Post('confirmar')
  @LimiteCredenciales()
  confirmar() {
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

describe('limites de peticiones', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
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
  });

  /** Simula el proxy de Render: agrega la IP real al final del encabezado. */
  const desde = (ip: string, encabezadoDelCliente?: string) => ({
    'X-Forwarded-For': encabezadoDelCliente
      ? `${encabezadoDelCliente}, ${ip}`
      : ip,
  });

  async function pedirN(n: number, hacer: () => request.Test) {
    const estados: number[] = [];
    for (let i = 0; i < n; i++) estados.push((await hacer()).status);
    return estados;
  }

  it('el limite global es por IP y cuenta todos los endpoints juntos', async () => {
    const servidor = app.getHttpServer();
    const mitad = LIMITE_GLOBAL.limite / 2;
    await pedirN(mitad, () => request(servidor).get('/a').set(desde('1.1.1.1')));
    await pedirN(mitad, () => request(servidor).get('/b').set(desde('1.1.1.1')));

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

  it('login y confirmacion con PIN comparten un limite mas estricto', async () => {
    const servidor = app.getHttpServer();
    const mitad = LIMITE_CREDENCIALES.limite / 2;
    const estados = [
      ...(await pedirN(mitad, () =>
        request(servidor).post('/login').set(desde('3.3.3.3')),
      )),
      ...(await pedirN(mitad, () =>
        request(servidor).post('/confirmar').set(desde('3.3.3.3')),
      )),
    ];
    expect(estados.every((e) => e === 201)).toBe(true);

    await request(servidor).post('/login').set(desde('3.3.3.3')).expect(429);
    // El resto de la API sigue disponible para esa IP.
    await request(servidor).get('/a').set(desde('3.3.3.3')).expect(200);
  });

  it('lo que el cliente escriba en X-Forwarded-For no le da otra IP', async () => {
    const servidor = app.getHttpServer();
    const estados = await pedirN(LIMITE_CREDENCIALES.limite + 1, () =>
      request(servidor)
        .post('/login')
        .set(desde('4.4.4.4', `9.9.9.${Math.floor(Math.random() * 250)}`)),
    );
    expect(estados.at(-1)).toBe(429);
  });

  it('/salud no tiene limite', async () => {
    const servidor = app.getHttpServer();
    const estados = await pedirN(LIMITE_GLOBAL.limite + 5, () =>
      request(servidor).get('/salud').set(desde('5.5.5.5')),
    );
    expect(estados.every((e) => e === 200)).toBe(true);
  });
});

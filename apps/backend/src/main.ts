import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { exigirEntornoValido } from './config/entorno';

async function bootstrap() {
  // Antes de levantar Nest. El `.env` local ya esta en `process.env`: lo carga
  // `ConfigModule.forRoot` al importar `AppModule`. En Render no hay `.env`;
  // las variables llegan del panel.
  exigirEntornoValido();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Render pone un proxy delante: sin esto `req.ip` seria la IP del proxy para
  // todos y el limite de peticiones bloquearia a todos juntos. `1` = confiar
  // solo en el salto inmediato (el proxy de Render), que agrega la IP real del
  // cliente al final de `X-Forwarded-For`; lo que el cliente haya escrito antes
  // en ese encabezado se ignora. En local no hay proxy y se deja apagado para
  // que nadie pueda inventarse la IP.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // CORS queda apagado a proposito (Nest no lo habilita si no se pide): la app
  // movil no es un navegador y no lo necesita. Si algun dia hay un cliente web,
  // habilitarlo solo para ese origen, nunca con `origin: '*'`.

  // Render manda SIGTERM al reemplazar la instancia: cerrar Prisma limpio.
  app.enableShutdownHooks();

  // Render asigna PORT; 3000 es solo para local.
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  Controller,
  Get,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';

import { SinLimiteDePeticiones } from '../../../shared/limites/limites-peticiones';
import { PrismaService } from '../../../shared/prisma/prisma.service';

/** Si la base tarda mas que esto, para Render el servicio no esta sano. */
export const ESPERA_MAXIMA_BASE_MS = 3_000;

export interface RespuestaSalud {
  estado: 'ok' | 'error';
  version: string;
  baseDeDatos: 'ok' | 'sin respuesta';
}

/**
 * Version de `package.json`. Desde `src/modules/salud/interface` (pruebas) y
 * desde `dist/modules/salud/interface` (produccion) son cuatro niveles arriba.
 */
function leerVersion(): string {
  try {
    const ruta = join(__dirname, '..', '..', '..', '..', 'package.json');
    const { version } = JSON.parse(readFileSync(ruta, 'utf8')) as {
      version?: unknown;
    };
    return typeof version === 'string' ? version : 'desconocida';
  } catch {
    return 'desconocida';
  }
}

/**
 * `GET /salud`: Render lo consulta para saber si el servicio esta vivo
 * (`healthCheckPath` en render.yaml) y no manda trafico a una instancia
 * nueva hasta que responde 200. Publico (sin JWT) y fuera de los limites de
 * peticiones. Solo dice estado, version y si la base responde: nada de
 * variables de entorno, cadena de conexion ni token de Handy, y el error de
 * la base tampoco se devuelve (podria traer el host o el usuario).
 */
@Controller('salud')
@SinLimiteDePeticiones()
export class SaludController {
  private readonly version = leerVersion();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async revisar(): Promise<RespuestaSalud> {
    if (await this.baseResponde()) {
      return { estado: 'ok', version: this.version, baseDeDatos: 'ok' };
    }
    const respuesta: RespuestaSalud = {
      estado: 'error',
      version: this.version,
      baseDeDatos: 'sin respuesta',
    };
    throw new ServiceUnavailableException({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      ...respuesta,
    });
  }

  private async baseResponde(): Promise<boolean> {
    let temporizador: NodeJS.Timeout | undefined;
    const vencida = new Promise<false>((resolver) => {
      temporizador = setTimeout(() => resolver(false), ESPERA_MAXIMA_BASE_MS);
    });
    const consulta = this.prisma.$queryRaw`SELECT 1`.then(
      () => true,
      () => false,
    );
    try {
      return await Promise.race([consulta, vencida]);
    } finally {
      clearTimeout(temporizador);
    }
  }
}

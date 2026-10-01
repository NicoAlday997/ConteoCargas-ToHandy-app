import { ServiceUnavailableException } from '@nestjs/common';

import type { PrismaService } from '../../../shared/prisma/prisma.service';
import { ESPERA_MAXIMA_BASE_MS, SaludController } from './salud.controller';

const { version } = jest.requireActual<{ version: string }>(
  '../../../../package.json',
);

function controladorCon(queryRaw: jest.Mock): SaludController {
  return new SaludController({ $queryRaw: queryRaw } as unknown as PrismaService);
}

async function cuerpoDelError(promesa: Promise<unknown>): Promise<unknown> {
  try {
    await promesa;
  } catch (error) {
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    return (error as ServiceUnavailableException).getResponse();
  }
  throw new Error('se esperaba un 503');
}

describe('SaludController', () => {
  afterEach(() => jest.useRealTimers());

  it('con la base respondiendo devuelve estado ok, version y base ok, nada mas', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

    await expect(controladorCon(queryRaw).revisar()).resolves.toStrictEqual({
      estado: 'ok',
      version,
      baseDeDatos: 'ok',
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('si la base falla responde 503 sin filtrar el error de la base', async () => {
    const queryRaw = jest
      .fn()
      .mockRejectedValue(
        new Error('Can not reach database server at `db-secreta:5432`'),
      );

    const cuerpo = await cuerpoDelError(controladorCon(queryRaw).revisar());

    expect(cuerpo).toStrictEqual({
      statusCode: 503,
      estado: 'error',
      version,
      baseDeDatos: 'sin respuesta',
    });
    expect(JSON.stringify(cuerpo)).not.toContain('db-secreta');
  });

  it('si la base no contesta a tiempo responde 503', async () => {
    jest.useFakeTimers();
    const queryRaw = jest.fn().mockReturnValue(new Promise(() => undefined));

    const respuesta = cuerpoDelError(controladorCon(queryRaw).revisar());
    await jest.advanceTimersByTimeAsync(ESPERA_MAXIMA_BASE_MS);

    expect(await respuesta).toMatchObject({ baseDeDatos: 'sin respuesta' });
  });
});

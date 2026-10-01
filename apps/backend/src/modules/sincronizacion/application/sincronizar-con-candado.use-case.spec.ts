import type {
  ResultadoCandado,
  UltimaSincronizacion,
} from '../domain/candado-sincronizacion';
import {
  RegistroSincronizacionRepository,
  type NuevoRegistroSincronizacion,
  type ResultadoReserva,
} from './registro-sincronizacion.repository';
import { HandyErrorServidorError } from './handy.gateway';
import { SincronizarConCandadoUseCase } from './sincronizar-con-candado.use-case';
import type {
  ResultadoSincronizarConHandy,
  SincronizarConHandyUseCase,
} from './sincronizar-con-handy.use-case';

/**
 * Pruebas del candado de 2 minutos y de la bitacora de quien sincronizo. La
 * sincronizacion en si va como doble: aqui importa cuando SE LLAMA a Handy y
 * cuando no.
 */

const T0 = new Date('2026-09-30T16:00:00.000Z');

function resultado(): ResultadoSincronizarConHandy {
  return {
    productos: {
      nuevos: 1,
      actualizados: 0,
      desactivados: 0,
      sinConfirmarEmpaque: 1,
      desactivacionRetenida: null,
    },
    vendedores: {
      nuevos: 0,
      actualizados: 0,
      desactivados: 0,
      desactivacionRetenida: null,
    },
    errorVendedores: null,
    sincronizadoEn: T0,
  };
}

/** Bitacora en memoria con la misma semantica que el adaptador Prisma. */
class RegistrosEnMemoria extends RegistroSincronizacionRepository {
  readonly filas: Array<
    NuevoRegistroSincronizacion & {
      id: string;
      terminadaEn: Date | null;
      exito: boolean | null;
    }
  > = [];

  async reservar(
    registro: NuevoRegistroSincronizacion,
    evaluar: (ultima: UltimaSincronizacion | null) => ResultadoCandado,
  ): Promise<ResultadoReserva> {
    const ultima = this.filas.reduce<UltimaSincronizacion | null>(
      (max, f) => (max === null || f.iniciadaEn > max.iniciadaEn ? f : max),
      null,
    );
    const candado = evaluar(
      ultima && { iniciadaEn: ultima.iniciadaEn, exito: ultima.exito },
    );
    if (!candado.libre) {
      return {
        reservado: false,
        motivo: candado.motivo,
        reintentarEn: candado.reintentarEn,
      };
    }
    return { reservado: true, registroId: await this.registrar(registro) };
  }

  async registrar(registro: NuevoRegistroSincronizacion): Promise<string> {
    const id = `r-${this.filas.length + 1}`;
    this.filas.push({ ...registro, id, terminadaEn: null, exito: null });
    return id;
  }

  async terminar(
    id: string,
    datos: { terminadaEn: Date; exito: boolean },
  ): Promise<void> {
    const fila = this.filas.find((f) => f.id === id);
    if (fila) Object.assign(fila, datos);
  }
}

function armar(opciones: { falla?: boolean } = {}) {
  let ahora = T0;
  let falla = opciones.falla ?? false;
  const sincronizar = {
    ejecutar: jest.fn(async () => {
      if (falla) throw new HandyErrorServidorError('/products', 503);
      return resultado();
    }),
    ejecutarAutomatica: jest.fn(async () => ({
      exito: true as const,
      resultado: resultado(),
    })),
  };
  const registros = new RegistrosEnMemoria();
  const useCase = new SincronizarConCandadoUseCase(
    sincronizar as unknown as SincronizarConHandyUseCase,
    registros,
    () => ahora,
  );
  return {
    useCase,
    registros,
    sincronizar,
    avanzar: (ms: number) => {
      ahora = new Date(ahora.getTime() + ms);
    },
    handyVuelve: () => {
      falla = false;
    },
  };
}

describe('SincronizarConCandadoUseCase', () => {
  it('la primera pasa, llama a Handy y registra quien y cuando', async () => {
    const { useCase, registros, sincronizar } = armar();

    const r = await useCase.ejecutarManual('vendedor-1');

    expect(r.exito).toBe(true);
    expect(sincronizar.ejecutar).toHaveBeenCalledWith('MANUAL');
    expect(registros.filas).toEqual([
      {
        id: 'r-1',
        origen: 'MANUAL',
        usuarioAppId: 'vendedor-1',
        iniciadaEn: T0,
        terminadaEn: T0,
        exito: true,
      },
    ]);
  });

  it('otra persona a los 40 s: 429 con la hora exacta, sin llamar a Handy', async () => {
    const { useCase, registros, sincronizar, avanzar } = armar();
    await useCase.ejecutarManual('vendedor-1');
    avanzar(40_000);

    const r = await useCase.ejecutarManual('contador-1');

    expect(r).toEqual({
      exito: false,
      motivo: 'SINCRONIZACION_RECIENTE',
      reintentarEn: new Date('2026-09-30T16:02:00.000Z'),
    });
    expect(sincronizar.ejecutar).toHaveBeenCalledTimes(1);
    // El intento rechazado no deja fila: no alarga el candado.
    expect(registros.filas).toHaveLength(1);
  });

  it('el candado es global: tambien frena al mismo usuario', async () => {
    const { useCase, avanzar } = armar();
    await useCase.ejecutarManual('supervisor-1');
    avanzar(1_000);
    expect((await useCase.ejecutarManual('supervisor-1')).exito).toBe(false);
  });

  it('a los 2 minutos se puede otra vez', async () => {
    const { useCase, sincronizar, avanzar } = armar();
    await useCase.ejecutarManual('vendedor-1');
    avanzar(120_000);

    expect((await useCase.ejecutarManual('contador-1')).exito).toBe(true);
    expect(sincronizar.ejecutar).toHaveBeenCalledTimes(2);
  });

  it('si Handy falla: el error sube y el registro queda como fallido', async () => {
    const { useCase, registros } = armar({ falla: true });

    await expect(useCase.ejecutarManual('vendedor-1')).rejects.toBeInstanceOf(
      HandyErrorServidorError,
    );
    expect(registros.filas[0]).toMatchObject({ exito: false });
  });

  it('tras un fallo, a los 10 s: candado corto con motivo honesto, sin llamar a Handy', async () => {
    const { useCase, registros, sincronizar, avanzar } = armar({
      falla: true,
    });
    await expect(useCase.ejecutarManual('vendedor-1')).rejects.toThrow();
    avanzar(10_000);

    const r = await useCase.ejecutarManual('vendedor-1');

    expect(r).toEqual({
      exito: false,
      motivo: 'SINCRONIZACION_FALLIDA_RECIENTE',
      reintentarEn: new Date('2026-09-30T16:00:20.000Z'),
    });
    expect(sincronizar.ejecutar).toHaveBeenCalledTimes(1);
    expect(registros.filas).toHaveLength(1);
  });

  it('tras un fallo, a los 20 s se puede reintentar (no son 2 minutos)', async () => {
    const { useCase, sincronizar, avanzar, handyVuelve } = armar({
      falla: true,
    });
    await expect(useCase.ejecutarManual('vendedor-1')).rejects.toThrow();
    avanzar(20_000);
    handyVuelve();

    expect((await useCase.ejecutarManual('vendedor-1')).exito).toBe(true);
    expect(sincronizar.ejecutar).toHaveBeenCalledTimes(2);
  });

  it('el reintento exitoso tras un fallo vuelve a cerrar 2 minutos', async () => {
    const { useCase, avanzar, handyVuelve } = armar({ falla: true });
    await expect(useCase.ejecutarManual('vendedor-1')).rejects.toThrow();
    avanzar(20_000);
    handyVuelve();
    await useCase.ejecutarManual('vendedor-1');
    avanzar(60_000);

    expect(await useCase.ejecutarManual('contador-1')).toMatchObject({
      exito: false,
      motivo: 'SINCRONIZACION_RECIENTE',
    });
  });

  it('la corrida automatica se registra sin usuario y cuenta para el candado', async () => {
    const { useCase, registros, sincronizar, avanzar } = armar();

    const corrida = await useCase.ejecutarAutomatica();
    expect(corrida.exito).toBe(true);
    expect(sincronizar.ejecutarAutomatica).toHaveBeenCalledTimes(1);
    expect(registros.filas[0]).toMatchObject({
      origen: 'AUTOMATICA',
      usuarioAppId: null,
      exito: true,
    });

    avanzar(30_000);
    expect((await useCase.ejecutarManual('vendedor-1')).exito).toBe(false);
  });

  it('la corrida automatica no se frena por una manual reciente', async () => {
    const { useCase, sincronizar, avanzar } = armar();
    await useCase.ejecutarManual('vendedor-1');
    avanzar(5_000);

    await useCase.ejecutarAutomatica();
    expect(sincronizar.ejecutarAutomatica).toHaveBeenCalledTimes(1);
  });
});

import type { TipoSesion, UbicacionConteo } from '@prisma/client';

import {
  AbrirSesionUseCase,
  type ResultadoAbrirSesion,
} from './abrir-sesion.use-case';
import type {
  ResultadoVerificarCortePendiente,
  VerificarCortePendienteUseCase,
} from './verificar-corte-pendiente.use-case';
import type {
  CargaRepository,
  DatosActualizarDiscrepancia,
  DatosCrearEvento,
  Discrepancia,
  DiscrepanciaAGuardar,
  EventoCarga,
  ItemAGuardar,
  ItemCapturado,
  SesionConteo,
} from './carga.repository';

/**
 * Pruebas del caso de uso "abrir sesion" (docs/04 §1.4): el guardarail de una
 * sesion por usuario por evento y el bloqueo por liquidacion, que aplica solo
 * al CONTADOR (docs/01 §6 regla 2). Sin base de datos: dobles en memoria de
 * `CargaRepository` y de `VerificarCortePendienteUseCase`.
 */

const AHORA = new Date('2026-09-17T08:00:00-06:00');

function eventoDePrueba(overrides: Partial<EventoCarga> = {}): EventoCarga {
  return {
    id: 'ev-1',
    rutaId: 'ruta-1',
    plantillaId: null,
    tipo: 'INICIAL',
    tipoOperacion: 'AUTOVENTA',
    usuarioHandyId: 42,
    estado: 'EN_ESPERA_CONTADOR',
    fechaConteo: AHORA,
    fechaOperativa: AHORA,
    autorizadaPorId: null,
    fechaAutorizacion: null,
    fechaBloqueoCortePendiente: null,
    fechaDesbloqueo: null,
    creadoEn: AHORA,
    ...overrides,
  };
}

function sesionDePrueba(overrides: Partial<SesionConteo> = {}): SesionConteo {
  return {
    id: 'se-existente',
    eventoCargaId: 'ev-1',
    tipo: 'VENDEDOR',
    usuarioAppId: 'v1',
    dispositivoId: null,
    ubicacion: null,
    estado: 'ABIERTA',
    iniciadaEn: AHORA,
    finalizadaEn: null,
    ...overrides,
  };
}

/**
 * Doble del repositorio: solo implementa lo que este caso de uso usa
 * (`buscarEventoPorId`, `listarSesionesDeEvento`, `crearSesion`). El resto
 * lanza para que una prueba falle si el caso de uso empieza a depender de mas.
 */
class FakeCargaRepository implements CargaRepository {
  listarCapturasDeSesion(): never {
    throw new Error('no usado en esta prueba');
  }
  buscarCargaInicialDeFecha(): never {
    throw new Error('no usado en esta prueba');
  }
  evento: EventoCarga | null = eventoDePrueba();
  sesionesExistentes: SesionConteo[] = [];
  readonly sesionesCreadas: Array<{
    eventoId: string;
    tipo: TipoSesion;
    usuarioAppId: string;
    ubicacion?: UbicacionConteo;
  }> = [];
  private secuencia = 0;

  async buscarEventoPorId(): Promise<EventoCarga | null> {
    return this.evento;
  }

  async listarSesionesDeEvento(): Promise<SesionConteo[]> {
    return this.sesionesExistentes;
  }

  async crearSesion(
    eventoId: string,
    tipo: TipoSesion,
    usuarioAppId: string,
    _dispositivoId?: string,
    ubicacion?: UbicacionConteo,
  ): Promise<SesionConteo> {
    this.secuencia += 1;
    this.sesionesCreadas.push({ eventoId, tipo, usuarioAppId, ubicacion });
    return {
      id: `se-${this.secuencia}`,
      eventoCargaId: eventoId,
      tipo,
      usuarioAppId,
      dispositivoId: null,
      ubicacion: ubicacion ?? null,
      estado: 'ABIERTA',
      iniciadaEn: AHORA,
      finalizadaEn: null,
    };
  }

  crearEvento(_datos: DatosCrearEvento): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  cambiarEstado(): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  marcarComoEnviada(): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  autorizarEvento(): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  bloquearPorCortePendiente(): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  desbloquearEvento(): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  buscarSesionPorId(): Promise<SesionConteo | null> {
    throw new Error('no usado en esta prueba');
  }
  guardarItems(_sesionId: string, _items: ItemAGuardar[]): Promise<void> {
    throw new Error('no usado en esta prueba');
  }
  finalizarSesion(): Promise<SesionConteo> {
    throw new Error('no usado en esta prueba');
  }
  listarItemsDeSesion(): Promise<ItemCapturado[]> {
    throw new Error('no usado en esta prueba');
  }
  guardarDiscrepancias(
    _eventoId: string,
    _discrepancias: DiscrepanciaAGuardar[],
  ): Promise<void> {
    throw new Error('no usado en esta prueba');
  }
  listarDiscrepancias(): Promise<Discrepancia[]> {
    throw new Error('no usado en esta prueba');
  }
  actualizarDiscrepancia(
    _eventoId: string,
    _productoCode: string,
    _datos: DatosActualizarDiscrepancia,
  ): Promise<Discrepancia> {
    throw new Error('no usado en esta prueba');
  }
  reabrirDiscrepancia(): Promise<Discrepancia> {
    throw new Error('no usado en esta prueba');
  }
}

function exigirExito(
  resultado: ResultadoAbrirSesion,
): Extract<ResultadoAbrirSesion, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

/**
 * Doble de la verificacion de corte: se le fija si el vendedor tiene la ruta
 * anterior sin liquidar y registra cada llamada.
 */
class FakeVerificarCorte implements Pick<
  VerificarCortePendienteUseCase,
  'ejecutar'
> {
  rutaSinLiquidar = false;
  readonly llamadas: string[] = [];

  async ejecutar(entrada: {
    eventoId: string;
  }): Promise<ResultadoVerificarCortePendiente> {
    this.llamadas.push(entrada.eventoId);
    if (!this.rutaSinLiquidar) {
      return { exito: true, bloqueado: false };
    }
    return {
      exito: true,
      bloqueado: true,
      evento: eventoDePrueba({ estado: 'BLOQUEADA_CORTE_PENDIENTE' }),
      rutaHandyId: 'handy-ruta-99',
      generarAlertaMedia: true,
    };
  }
}

describe('AbrirSesionUseCase', () => {
  let cargas: FakeCargaRepository;
  let verificarCorte: FakeVerificarCorte;
  let useCase: AbrirSesionUseCase;

  beforeEach(() => {
    cargas = new FakeCargaRepository();
    verificarCorte = new FakeVerificarCorte();
    useCase = new AbrirSesionUseCase(cargas, verificarCorte);
  });

  it('devuelve EVENTO_NO_ENCONTRADO y no crea nada si el evento no existe', async () => {
    cargas.evento = null;

    const resultado = await useCase.ejecutar(
      {
        eventoId: 'ev-inexistente',
        usuarioAppId: 'v1',
        tipo: 'VENDEDOR',
      },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'EVENTO_NO_ENCONTRADO' });
    expect(cargas.sesionesCreadas).toHaveLength(0);
  });

  it('rechaza YA_TIENE_SESION_EN_ESTE_EVENTO si el usuario ya tiene una sesion abierta ahi', async () => {
    cargas.sesionesExistentes = [
      sesionDePrueba({ usuarioAppId: 'v1', estado: 'ABIERTA' }),
    ];

    const resultado = await useCase.ejecutar(
      {
        eventoId: 'ev-1',
        usuarioAppId: 'v1',
        tipo: 'VENDEDOR',
      },
      AHORA,
    );

    expect(resultado).toEqual({
      exito: false,
      motivo: 'YA_TIENE_SESION_EN_ESTE_EVENTO',
    });
    expect(cargas.sesionesCreadas).toHaveLength(0);
  });

  it('rechaza YA_TIENE_SESION_EN_ESTE_EVENTO aunque la sesion previa ya este CERRADA', async () => {
    cargas.sesionesExistentes = [
      sesionDePrueba({ usuarioAppId: 'v1', estado: 'CERRADA' }),
    ];

    const resultado = await useCase.ejecutar(
      {
        eventoId: 'ev-1',
        usuarioAppId: 'v1',
        tipo: 'VENDEDOR',
      },
      AHORA,
    );

    expect(resultado).toEqual({
      exito: false,
      motivo: 'YA_TIENE_SESION_EN_ESTE_EVENTO',
    });
    expect(cargas.sesionesCreadas).toHaveLength(0);
  });

  it('permite abrir la sesion del CONTADOR aunque el VENDEDOR ya tenga la suya', async () => {
    cargas.sesionesExistentes = [
      sesionDePrueba({ usuarioAppId: 'v1', tipo: 'VENDEDOR' }),
    ];

    const resultado = exigirExito(
      await useCase.ejecutar(
        {
          eventoId: 'ev-1',
          usuarioAppId: 'c1',
          tipo: 'CONTADOR',
        },
        AHORA,
      ),
    );

    expect(resultado.sesion.usuarioAppId).toBe('c1');
    expect(resultado.sesion.tipo).toBe('CONTADOR');
    expect(cargas.sesionesCreadas).toEqual([
      {
        eventoId: 'ev-1',
        tipo: 'CONTADOR',
        usuarioAppId: 'c1',
        ubicacion: undefined,
      },
    ]);
  });

  it('crea la sesion cuando el usuario no tiene ninguna previa en ese evento', async () => {
    const resultado = exigirExito(
      await useCase.ejecutar(
        {
          eventoId: 'ev-1',
          usuarioAppId: 'v1',
          tipo: 'VENDEDOR',
        },
        AHORA,
      ),
    );

    expect(resultado.sesion.eventoCargaId).toBe('ev-1');
    expect(resultado.sesion.usuarioAppId).toBe('v1');
    expect(resultado.sesion.estado).toBe('ABIERTA');
  });

  it('propaga la ubicacion recibida a la sesion creada', async () => {
    const resultado = exigirExito(
      await useCase.ejecutar(
        {
          eventoId: 'ev-1',
          usuarioAppId: 'c1',
          tipo: 'CONTADOR',
          ubicacion: 'CALLE',
        },
        AHORA,
      ),
    );

    expect(resultado.sesion.ubicacion).toBe('CALLE');
    expect(cargas.sesionesCreadas).toEqual([
      {
        eventoId: 'ev-1',
        tipo: 'CONTADOR',
        usuarioAppId: 'c1',
        ubicacion: 'CALLE',
      },
    ]);
  });

  describe('bloqueo por ruta anterior sin liquidar', () => {
    it('el VENDEDOR abre su sesion sin revisar la liquidacion, aunque tenga ruta sin liquidar', async () => {
      verificarCorte.rutaSinLiquidar = true;
      cargas.evento = eventoDePrueba({ estado: 'BORRADOR' });

      const resultado = exigirExito(
        await useCase.ejecutar(
          { eventoId: 'ev-1', usuarioAppId: 'v1', tipo: 'VENDEDOR' },
          AHORA,
        ),
      );

      expect(verificarCorte.llamadas).toEqual([]);
      expect(resultado.sesion.tipo).toBe('VENDEDOR');
    });

    it('el CONTADOR revisa la liquidacion y, si esta liquidada, abre su sesion', async () => {
      const resultado = exigirExito(
        await useCase.ejecutar(
          { eventoId: 'ev-1', usuarioAppId: 'c1', tipo: 'CONTADOR' },
          AHORA,
        ),
      );

      expect(verificarCorte.llamadas).toEqual(['ev-1']);
      expect(resultado.sesion.tipo).toBe('CONTADOR');
    });

    it('el CONTADOR con la ruta anterior sin liquidar recibe CORTE_PENDIENTE y no abre sesion', async () => {
      verificarCorte.rutaSinLiquidar = true;

      const resultado = await useCase.ejecutar(
        { eventoId: 'ev-1', usuarioAppId: 'c1', tipo: 'CONTADOR' },
        AHORA,
      );

      expect(resultado).toEqual({ exito: false, motivo: 'CORTE_PENDIENTE' });
      expect(cargas.sesionesCreadas).toHaveLength(0);
    });

    it('el CONTADOR tampoco abre sesion sobre una carga que ya estaba bloqueada', async () => {
      cargas.evento = eventoDePrueba({ estado: 'BLOQUEADA_CORTE_PENDIENTE' });

      const resultado = await useCase.ejecutar(
        { eventoId: 'ev-1', usuarioAppId: 'c1', tipo: 'CONTADOR' },
        AHORA,
      );

      expect(resultado).toEqual({ exito: false, motivo: 'CORTE_PENDIENTE' });
      expect(cargas.sesionesCreadas).toHaveLength(0);
    });
  });
});

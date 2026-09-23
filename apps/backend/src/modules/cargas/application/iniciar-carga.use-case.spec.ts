import type { TipoSesion, UbicacionConteo } from '@prisma/client';

import {
  HandyErrorServidorError,
  HandyGateway,
  HandySinRespuestaError,
  type RutaHandy,
} from '../../sincronizacion/application/handy.gateway';
import type {
  AsignacionRepository,
  AsignacionVigente,
} from './asignacion.repository';
import {
  CargaInicialDuplicadaError,
  PermisoCargaNoDisponibleError,
  type CargaRepository,
  type DatosCrearEvento,
  type Discrepancia,
  type DatosActualizarDiscrepancia,
  type DiscrepanciaAGuardar,
  type EventoCarga,
  type ItemAGuardar,
  type ItemCapturado,
  type SesionConteo,
} from './carga.repository';
import {
  IniciarCargaUseCase,
  type ResultadoIniciarCarga,
} from './iniciar-carga.use-case';
import type {
  PermisoCargaRepository,
  PermisoCargaSinLiquidar,
} from './permiso-carga.repository';

/**
 * Pruebas del caso de uso "iniciar carga" (RF-12). Sin base de datos: dobles en
 * memoria de los puertos `CargaRepository`, `AsignacionRepository`,
 * `HandyGateway` y `PermisoCargaRepository`.
 */

const AHORA = new Date('2026-09-08T07:30:00-06:00');
const HOY = new Date('2026-09-08T00:00:00-06:00');
const MANANA = new Date('2026-09-09T00:00:00-06:00');
const AYER = new Date('2026-09-07T00:00:00-06:00');

/**
 * Doble del repositorio de cargas: solo implementa lo que este caso de uso usa
 * (`crearEvento`, `crearSesion`, `buscarCargaInicialDeFecha`) y registra sus
 * llamadas. El resto lanza para que una prueba falle si el caso de uso empieza
 * a depender de mas.
 */
class FakeCargaRepository implements CargaRepository {
  listarCapturasDeSesion(): never {
    throw new Error('no usado en esta prueba');
  }
  readonly eventosCreados: DatosCrearEvento[] = [];
  readonly sesionesCreadas: Array<{
    eventoId: string;
    tipo: TipoSesion;
    usuarioAppId: string;
    dispositivoId?: string;
  }> = [];
  /** Todos los eventos que "existen" en la base, creados aqui o sembrados. */
  readonly eventos: EventoCarga[] = [];
  /**
   * Simula la carrera: otra solicitud crea este evento justo antes que el
   * nuestro y la base de datos rechaza el alta por el indice unico.
   */
  ganadorDeCarrera: EventoCarga | null = null;
  /**
   * Permisos que "existen" en la base. `crearEvento` consume el recibido con la
   * misma condicion que el adaptador real (sin usar y sin vencer).
   */
  permisos: PermisoCargaSinLiquidar[] = [];
  private secuencia = 0;

  async buscarCargaInicialDeFecha(
    rutaId: string,
    fechaOperativa: Date,
  ): Promise<EventoCarga | null> {
    return (
      this.eventos.find(
        (e) =>
          e.tipo === 'INICIAL' &&
          e.rutaId === rutaId &&
          e.fechaOperativa.getTime() === fechaOperativa.getTime(),
      ) ?? null
    );
  }

  async crearEvento(datos: DatosCrearEvento): Promise<EventoCarga> {
    if (this.ganadorDeCarrera !== null) {
      this.eventos.push(this.ganadorDeCarrera);
      this.ganadorDeCarrera = null;
      throw new CargaInicialDuplicadaError();
    }
    const permisoId = datos.permisoSinLiquidar?.permisoId;
    const permiso = this.permisos.find((p) => p.id === permisoId);
    if (
      permisoId !== undefined &&
      (permiso === undefined ||
        permiso.usado ||
        permiso.fechaExpiracion.getTime() <= datos.fechaConteo.getTime())
    ) {
      throw new PermisoCargaNoDisponibleError();
    }
    this.secuencia += 1;
    this.eventosCreados.push(datos);
    const evento: EventoCarga = {
      id: `ev-${this.secuencia}`,
      rutaId: datos.rutaId,
      plantillaId: datos.plantillaId,
      tipo: datos.tipo,
      tipoOperacion: datos.tipoOperacion,
      usuarioHandyId: datos.usuarioHandyId,
      // Invariante de alta que el adaptador real garantiza por el default del esquema.
      estado: 'BORRADOR',
      fechaConteo: datos.fechaConteo,
      fechaOperativa: datos.fechaOperativa,
      autorizadaPorId: null,
      fechaAutorizacion: null,
      fechaBloqueoCortePendiente: null,
      fechaDesbloqueo: null,
      rutaHandySinLiquidarId: datos.permisoSinLiquidar?.rutaHandyId ?? null,
      liquidacionNoVerificada: datos.liquidacionNoVerificada ?? false,
      creadoEn: datos.fechaConteo,
    };
    if (permiso !== undefined) {
      permiso.usado = true;
      permiso.eventoCargaId = evento.id;
    }
    this.eventos.push(evento);
    return evento;
  }

  async crearSesion(
    eventoId: string,
    tipo: TipoSesion,
    usuarioAppId: string,
    dispositivoId?: string,
    ubicacion?: UbicacionConteo,
  ): Promise<SesionConteo> {
    this.secuencia += 1;
    this.sesionesCreadas.push({ eventoId, tipo, usuarioAppId, dispositivoId });
    return {
      id: `se-${this.secuencia}`,
      eventoCargaId: eventoId,
      tipo,
      usuarioAppId,
      dispositivoId: dispositivoId ?? null,
      ubicacion: ubicacion ?? null,
      estado: 'ABIERTA',
      iniciadaEn: AHORA,
      finalizadaEn: null,
    };
  }

  buscarEventoPorId(): Promise<EventoCarga | null> {
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
  listarSesionesDeEvento(): Promise<SesionConteo[]> {
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

/** Doble de la asignacion: se le fija a mano lo que devuelve. */
class FakeAsignacionRepository implements AsignacionRepository {
  vigente: AsignacionVigente | null = null;
  readonly consultas: string[] = [];

  async buscarAsignacionVigente(
    usuarioAppId: string,
  ): Promise<AsignacionVigente | null> {
    this.consultas.push(usuarioAppId);
    return this.vigente;
  }
}

/**
 * Doble de Handy: solo `consultarRutaAbierta`. `rutaAbierta = null` es el 404
 * de Handy (sin ruta abierta); `falla` simula que Handy no responde.
 */
class FakeHandyGateway implements Pick<HandyGateway, 'consultarRutaAbierta'> {
  rutaAbierta: RutaHandy | null = null;
  falla: Error | null = null;
  readonly consultas: number[] = [];

  async consultarRutaAbierta(
    usuarioHandyId: number,
  ): Promise<RutaHandy | null> {
    this.consultas.push(usuarioHandyId);
    if (this.falla !== null) {
      throw this.falla;
    }
    return this.rutaAbierta;
  }
}

/** Doble de permisos: lee de la misma lista que consume `FakeCargaRepository`. */
class FakePermisoCargaRepository implements Pick<
  PermisoCargaRepository,
  'buscarVigente'
> {
  constructor(private readonly cargas: FakeCargaRepository) {}

  async buscarVigente(
    rutaId: string,
    ahora: Date,
  ): Promise<PermisoCargaSinLiquidar | null> {
    return (
      this.cargas.permisos.find(
        (p) =>
          p.rutaId === rutaId &&
          !p.usado &&
          p.fechaExpiracion.getTime() > ahora.getTime(),
      ) ?? null
    );
  }
}

function permiso(
  datos: Partial<PermisoCargaSinLiquidar> = {},
): PermisoCargaSinLiquidar {
  return {
    id: 'permiso-1',
    rutaId: 'ruta-7',
    otorgadoPorId: 'sup-1',
    motivo: 'Liquida mañana junto con hoy',
    fechaOtorgado: new Date(AHORA.getTime() - 60 * 60 * 1000),
    fechaExpiracion: new Date(AHORA.getTime() + 23 * 60 * 60 * 1000),
    usado: false,
    eventoCargaId: null,
    ...datos,
  };
}

function exigirExito(
  resultado: ResultadoIniciarCarga,
): Extract<ResultadoIniciarCarga, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('IniciarCargaUseCase', () => {
  let cargas: FakeCargaRepository;
  let asignaciones: FakeAsignacionRepository;
  let handy: FakeHandyGateway;
  let useCase: IniciarCargaUseCase;

  beforeEach(() => {
    cargas = new FakeCargaRepository();
    asignaciones = new FakeAsignacionRepository();
    handy = new FakeHandyGateway();
    useCase = new IniciarCargaUseCase(
      cargas,
      asignaciones,
      handy as unknown as HandyGateway,
      new FakePermisoCargaRepository(cargas) as unknown as PermisoCargaRepository,
    );
  });

  it('sin asignacion vigente: devuelve SIN_RUTA_ASIGNADA y no crea nada', async () => {
    asignaciones.vigente = null;

    const resultado = await useCase.ejecutar(
      { usuarioAppId: 'v1', tipo: 'INICIAL', usuarioHandyId: 42, fechaOperativa: HOY },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'SIN_RUTA_ASIGNADA' });
    expect(cargas.eventosCreados).toHaveLength(0);
    expect(cargas.sesionesCreadas).toHaveLength(0);
  });

  it('crea el evento en BORRADOR con ruta y plantilla de la asignacion como snapshot', async () => {
    asignaciones.vigente = { rutaId: 'ruta-7', plantillaId: 'plantilla-3' };

    const resultado = exigirExito(
      await useCase.ejecutar(
        { usuarioAppId: 'v1', tipo: 'INICIAL', usuarioHandyId: 42, fechaOperativa: HOY },
        AHORA,
      ),
    );

    expect(asignaciones.consultas).toEqual(['v1']);
    expect(cargas.eventosCreados).toEqual([
      {
        rutaId: 'ruta-7',
        plantillaId: 'plantilla-3',
        tipo: 'INICIAL',
        usuarioHandyId: 42,
        tipoOperacion: 'AUTOVENTA',
        fechaConteo: AHORA,
        fechaOperativa: HOY,
      },
    ]);
    expect(resultado.evento.estado).toBe('BORRADOR');
    expect(resultado.evento.rutaId).toBe('ruta-7');
    expect(resultado.evento.plantillaId).toBe('plantilla-3');
  });

  it('crea la sesion del primer conteo (VENDEDOR, ABIERTA) para ese usuario y evento', async () => {
    asignaciones.vigente = { rutaId: 'ruta-7', plantillaId: 'plantilla-3' };

    const resultado = exigirExito(
      await useCase.ejecutar(
        { usuarioAppId: 'v1', tipo: 'INICIAL', usuarioHandyId: 42, fechaOperativa: HOY },
        AHORA,
      ),
    );

    expect(cargas.sesionesCreadas).toEqual([
      {
        eventoId: resultado.evento.id,
        tipo: 'VENDEDOR',
        usuarioAppId: 'v1',
        dispositivoId: undefined,
      },
    ]);
    expect(resultado.sesion.tipo).toBe('VENDEDOR');
    expect(resultado.sesion.estado).toBe('ABIERTA');
    expect(resultado.sesion.usuarioAppId).toBe('v1');
    expect(resultado.sesion.eventoCargaId).toBe(resultado.evento.id);
  });

  it('propaga plantillaId null cuando la ruta no tiene plantilla', async () => {
    asignaciones.vigente = { rutaId: 'ruta-9', plantillaId: null };

    const resultado = exigirExito(
      await useCase.ejecutar(
        { usuarioAppId: 'v2', tipo: 'RECARGA', usuarioHandyId: 7, fechaOperativa: HOY },
        AHORA,
      ),
    );

    expect(cargas.eventosCreados[0].plantillaId).toBeNull();
    expect(resultado.evento.plantillaId).toBeNull();
  });

  it('respeta el tipo RECARGA recibido', async () => {
    asignaciones.vigente = { rutaId: 'ruta-9', plantillaId: null };

    const resultado = exigirExito(
      await useCase.ejecutar(
        { usuarioAppId: 'v2', tipo: 'RECARGA', usuarioHandyId: 7, fechaOperativa: HOY },
        AHORA,
      ),
    );

    expect(cargas.eventosCreados[0].tipo).toBe('RECARGA');
    expect(resultado.evento.tipo).toBe('RECARGA');
  });

  describe('fecha operativa', () => {
    beforeEach(() => {
      asignaciones.vigente = { rutaId: 'ruta-7', plantillaId: 'plantilla-3' };
    });

    it('guarda la fecha operativa elegida (mañana), distinta de la fecha de conteo', async () => {
      const tarde = new Date('2026-09-08T18:00:00-06:00');

      const resultado = exigirExito(
        await useCase.ejecutar(
          { usuarioAppId: 'v1', tipo: 'INICIAL', usuarioHandyId: 42, fechaOperativa: MANANA },
          tarde,
        ),
      );

      expect(cargas.eventosCreados[0].fechaConteo).toEqual(tarde);
      expect(cargas.eventosCreados[0].fechaOperativa).toEqual(MANANA);
      expect(resultado.evento.fechaOperativa).toEqual(MANANA);
    });

    it('normaliza la fecha operativa al inicio del dia en Mexico', async () => {
      await useCase.ejecutar(
        {
          usuarioAppId: 'v1',
          tipo: 'INICIAL',
          usuarioHandyId: 42,
          fechaOperativa: new Date('2026-09-09T15:45:00-06:00'),
        },
        AHORA,
      );

      expect(cargas.eventosCreados[0].fechaOperativa).toEqual(MANANA);
    });

    it('rechaza un dia pasado con FECHA_OPERATIVA_INVALIDA y no crea nada', async () => {
      const resultado = await useCase.ejecutar(
        { usuarioAppId: 'v1', tipo: 'INICIAL', usuarioHandyId: 42, fechaOperativa: AYER },
        AHORA,
      );

      expect(resultado).toEqual({ exito: false, motivo: 'FECHA_OPERATIVA_INVALIDA' });
      expect(cargas.eventosCreados).toHaveLength(0);
      expect(cargas.sesionesCreadas).toHaveLength(0);
    });

    it('tambien rechaza un dia pasado en una RECARGA', async () => {
      const resultado = await useCase.ejecutar(
        { usuarioAppId: 'v1', tipo: 'RECARGA', usuarioHandyId: 42, fechaOperativa: AYER },
        AHORA,
      );

      expect(resultado).toEqual({ exito: false, motivo: 'FECHA_OPERATIVA_INVALIDA' });
    });
  });

  describe('una sola carga INICIAL por ruta y fecha operativa', () => {
    const entradaInicial = {
      usuarioAppId: 'v1',
      tipo: 'INICIAL' as const,
      usuarioHandyId: 42,
      fechaOperativa: MANANA,
    };

    beforeEach(() => {
      asignaciones.vigente = { rutaId: 'ruta-7', plantillaId: 'plantilla-3' };
    });

    it('una segunda INICIAL para la misma ruta y fecha devuelve YA_TIENE_CARGA_ABIERTA con el id existente', async () => {
      const primera = exigirExito(await useCase.ejecutar(entradaInicial, AHORA));

      const segunda = await useCase.ejecutar(entradaInicial, AHORA);

      expect(segunda).toEqual({
        exito: false,
        motivo: 'YA_TIENE_CARGA_ABIERTA',
        eventoId: primera.evento.id,
      });
      expect(cargas.eventosCreados).toHaveLength(1);
      expect(cargas.sesionesCreadas).toHaveLength(1);
    });

    it('bloquea aunque la carga existente ya este enviada', async () => {
      const primera = exigirExito(await useCase.ejecutar(entradaInicial, AHORA));
      primera.evento.estado = 'ENVIADA';

      const segunda = await useCase.ejecutar(entradaInicial, AHORA);

      expect(segunda).toMatchObject({ motivo: 'YA_TIENE_CARGA_ABIERTA' });
    });

    it('permite la INICIAL de otra fecha operativa', async () => {
      exigirExito(await useCase.ejecutar(entradaInicial, AHORA));

      exigirExito(
        await useCase.ejecutar({ ...entradaInicial, fechaOperativa: HOY }, AHORA),
      );

      expect(cargas.eventosCreados).toHaveLength(2);
    });

    it('permite la INICIAL de otra ruta en la misma fecha', async () => {
      exigirExito(await useCase.ejecutar(entradaInicial, AHORA));
      asignaciones.vigente = { rutaId: 'ruta-9', plantillaId: null };

      exigirExito(await useCase.ejecutar(entradaInicial, AHORA));

      expect(cargas.eventosCreados).toHaveLength(2);
    });

    it('permite varias RECARGAS el mismo dia, haya o no INICIAL', async () => {
      exigirExito(await useCase.ejecutar(entradaInicial, AHORA));
      const recarga = { ...entradaInicial, tipo: 'RECARGA' as const };

      exigirExito(await useCase.ejecutar(recarga, AHORA));
      exigirExito(await useCase.ejecutar(recarga, AHORA));

      expect(cargas.eventosCreados.map((e) => e.tipo)).toEqual([
        'INICIAL',
        'RECARGA',
        'RECARGA',
      ]);
    });

    it('si pierde la carrera contra otra solicitud (indice unico) devuelve la carga ganadora', async () => {
      cargas.ganadorDeCarrera = {
        id: 'ev-ganador',
        rutaId: 'ruta-7',
        plantillaId: 'plantilla-3',
        tipo: 'INICIAL',
        tipoOperacion: 'AUTOVENTA',
        usuarioHandyId: 42,
        estado: 'BORRADOR',
        fechaConteo: AHORA,
        fechaOperativa: MANANA,
        autorizadaPorId: null,
        fechaAutorizacion: null,
        fechaBloqueoCortePendiente: null,
        fechaDesbloqueo: null,
        rutaHandySinLiquidarId: null,
        liquidacionNoVerificada: false,
        creadoEn: AHORA,
      };

      const resultado = await useCase.ejecutar(entradaInicial, AHORA);

      expect(resultado).toEqual({
        exito: false,
        motivo: 'YA_TIENE_CARGA_ABIERTA',
        eventoId: 'ev-ganador',
      });
      expect(cargas.sesionesCreadas).toHaveLength(0);
    });
  });

  describe('ruta anterior sin liquidar en Handy', () => {
    const entradaInicial = {
      usuarioAppId: 'v1',
      tipo: 'INICIAL' as const,
      usuarioHandyId: 42,
      fechaOperativa: MANANA,
    };

    beforeEach(() => {
      asignaciones.vigente = { rutaId: 'ruta-7', plantillaId: 'plantilla-3' };
    });

    it('sin ruta abierta procede normal y consulta Handy con el id del vendedor', async () => {
      const resultado = exigirExito(
        await useCase.ejecutar(entradaInicial, AHORA),
      );

      expect(handy.consultas).toEqual([42]);
      expect(resultado.evento.rutaHandySinLiquidarId).toBeNull();
      expect(resultado.evento.liquidacionNoVerificada).toBe(false);
    });

    it('con ruta abierta y sin permiso devuelve RUTA_ANTERIOR_SIN_LIQUIDAR con el id de Handy y no crea nada', async () => {
      handy.rutaAbierta = { id: 'handy-ruta-99' };

      const resultado = await useCase.ejecutar(entradaInicial, AHORA);

      expect(resultado).toEqual({
        exito: false,
        motivo: 'RUTA_ANTERIOR_SIN_LIQUIDAR',
        rutaHandyId: 'handy-ruta-99',
      });
      expect(cargas.eventosCreados).toHaveLength(0);
      expect(cargas.sesionesCreadas).toHaveLength(0);
    });

    it('con ruta abierta y permiso vigente procede, consume el permiso y lo vincula al evento', async () => {
      handy.rutaAbierta = { id: 'handy-ruta-99' };
      cargas.permisos = [permiso()];

      const resultado = exigirExito(
        await useCase.ejecutar(entradaInicial, AHORA),
      );

      expect(cargas.eventosCreados[0].permisoSinLiquidar).toEqual({
        permisoId: 'permiso-1',
        rutaHandyId: 'handy-ruta-99',
      });
      expect(resultado.evento.rutaHandySinLiquidarId).toBe('handy-ruta-99');
      expect(cargas.permisos[0].usado).toBe(true);
      expect(cargas.permisos[0].eventoCargaId).toBe(resultado.evento.id);
    });

    it('el permiso es de un solo uso: la siguiente INICIAL sin liquidar vuelve a bloquearse', async () => {
      handy.rutaAbierta = { id: 'handy-ruta-99' };
      cargas.permisos = [permiso()];
      exigirExito(await useCase.ejecutar(entradaInicial, AHORA));

      const pasadoMañana = new Date('2026-09-10T00:00:00-06:00');
      const segunda = await useCase.ejecutar(
        { ...entradaInicial, fechaOperativa: pasadoMañana },
        AHORA,
      );

      expect(segunda).toMatchObject({ motivo: 'RUTA_ANTERIOR_SIN_LIQUIDAR' });
      expect(cargas.eventosCreados).toHaveLength(1);
    });

    it('un permiso vencido no cuenta', async () => {
      handy.rutaAbierta = { id: 'handy-ruta-99' };
      cargas.permisos = [permiso({ fechaExpiracion: AHORA })];

      const resultado = await useCase.ejecutar(entradaInicial, AHORA);

      expect(resultado).toMatchObject({ motivo: 'RUTA_ANTERIOR_SIN_LIQUIDAR' });
      expect(cargas.permisos[0].usado).toBe(false);
    });

    it('un permiso de otra ruta no cuenta', async () => {
      handy.rutaAbierta = { id: 'handy-ruta-99' };
      cargas.permisos = [permiso({ rutaId: 'ruta-9' })];

      const resultado = await useCase.ejecutar(entradaInicial, AHORA);

      expect(resultado).toMatchObject({ motivo: 'RUTA_ANTERIOR_SIN_LIQUIDAR' });
    });

    it('si otra solicitud gasta el permiso entre la consulta y el alta, bloquea sin crear nada', async () => {
      handy.rutaAbierta = { id: 'handy-ruta-99' };
      const elPermiso = permiso();
      cargas.permisos = [elPermiso];
      const crearOriginal = cargas.crearEvento.bind(cargas);
      jest
        .spyOn(cargas, 'crearEvento')
        .mockImplementationOnce(async (datos) => {
          elPermiso.usado = true;
          return crearOriginal(datos);
        });

      const resultado = await useCase.ejecutar(entradaInicial, AHORA);

      expect(resultado).toEqual({
        exito: false,
        motivo: 'RUTA_ANTERIOR_SIN_LIQUIDAR',
        rutaHandyId: 'handy-ruta-99',
      });
      expect(cargas.eventosCreados).toHaveLength(0);
      expect(cargas.sesionesCreadas).toHaveLength(0);
    });

    it.each([
      [
        'sin respuesta (red)',
        new HandySinRespuestaError('/user/42/route/current', null),
      ],
      [
        'error de servidor',
        new HandyErrorServidorError('/user/42/route/current', 503),
      ],
    ])(
      'si Handy falla (%s) NO bloquea: crea la carga marcada como no verificada',
      async (_caso, falla) => {
        handy.falla = falla;

        const resultado = exigirExito(
          await useCase.ejecutar(entradaInicial, AHORA),
        );

        expect(cargas.eventosCreados[0].liquidacionNoVerificada).toBe(true);
        expect(resultado.evento.liquidacionNoVerificada).toBe(true);
        expect(resultado.evento.rutaHandySinLiquidarId).toBeNull();
      },
    );

    it('un error que no es de Handy se propaga', async () => {
      handy.falla = new TypeError('defecto propio');

      await expect(useCase.ejecutar(entradaInicial, AHORA)).rejects.toThrow(
        TypeError,
      );
      expect(cargas.eventosCreados).toHaveLength(0);
    });

    it('las RECARGAS no consultan Handy ni se bloquean', async () => {
      handy.rutaAbierta = { id: 'handy-ruta-99' };

      exigirExito(
        await useCase.ejecutar({ ...entradaInicial, tipo: 'RECARGA' }, AHORA),
      );

      expect(handy.consultas).toEqual([]);
    });

    it('conviven las dos reglas: si ya hay INICIAL para esa fecha, ofrece continuarla sin consultar Handy', async () => {
      const primera = exigirExito(
        await useCase.ejecutar(entradaInicial, AHORA),
      );
      handy.consultas.length = 0;
      handy.rutaAbierta = { id: 'handy-ruta-99' };

      const segunda = await useCase.ejecutar(entradaInicial, AHORA);

      expect(segunda).toEqual({
        exito: false,
        motivo: 'YA_TIENE_CARGA_ABIERTA',
        eventoId: primera.evento.id,
      });
      expect(handy.consultas).toEqual([]);
    });
  });
});

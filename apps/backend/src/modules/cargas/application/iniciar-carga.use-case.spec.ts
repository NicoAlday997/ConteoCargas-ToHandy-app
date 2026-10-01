import type { EstadoCarga, TipoSesion, UbicacionConteo } from '@prisma/client';

import {
  HandyErrorServidorError,
  HandyGateway,
  HandyRespuestaNoOkError,
  HandySinRespuestaError,
  HandyTokenInvalidoError,
  type PaginaHandy,
  type RespuestaCrearRuta,
  type RutaHandy,
} from '../../sincronizacion/application/handy.gateway';
import type {
  AsignacionRepository,
  AsignacionVigente,
} from './asignacion.repository';
import {
  CargaInicialDuplicadaError,
  CargaInicialSinTerminarError,
  type CargaRepository,
  type DatosCambiarFechaOperativa,
  type DatosCrearEvento,
  type Discrepancia,
  type DatosActualizarDiscrepancia,
  type DiscrepanciaAGuardar,
  type EventoCarga,
  type ItemAGuardar,
  type ItemCapturado,
  type SesionConteo,
} from './carga.repository';
import type {
  ConsultasCargaRepository,
  InicialSinTerminar,
} from './consultas-carga.repository';
import type {
  DiaNoLaborable,
  DiaNoLaborableRepository,
} from './dia-no-laborable.repository';
import { CambiarFechaOperativaUseCase } from './cambiar-fecha-operativa.use-case';
import { CancelarCargaUseCase } from './cancelar-carga.use-case';
import {
  IniciarCargaUseCase,
  type ResultadoIniciarCarga,
} from './iniciar-carga.use-case';

/**
 * Pruebas del caso de uso "iniciar carga" (RF-12). Sin base de datos: dobles en
 * memoria de los puertos `CargaRepository`, `AsignacionRepository` y
 * `HandyGateway`. Handy solo se consulta en la RECARGA (que su ruta siga
 * abierta); la INICIAL nunca se bloquea por liquidacion.
 */

/** `idHandy` de la inicial ENVIADA sembrada; el doble de Handy la da por abierta. */
const ID_HANDY_INICIAL = 'ruta-handy-9001';

// Martes 8 de septiembre de 2026: hoy y mañana (miercoles) son las opciones.
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
  /** Que indice "salto" en la carrera: por defecto el de ruta + fecha. */
  errorDeCarrera: Error = new CargaInicialDuplicadaError();
  /**
   * Carrera en la que la ganadora ya no se encuentra al volver a buscar (se
   * cancelo o termino entretanto): el alta falla con esto y no deja nada.
   */
  fallaAlCrear: Error | null = null;
  private secuencia = 0;

  async buscarCargaInicialDeFecha(
    rutaId: string,
    fechaOperativa: Date,
  ): Promise<EventoCarga | null> {
    return (
      this.eventos.find(
        (e) =>
          e.tipo === 'INICIAL' &&
          // Igual que el adaptador real: las canceladas no cuentan.
          e.estado !== 'CANCELADA' &&
          e.rutaId === rutaId &&
          e.fechaOperativa.getTime() === fechaOperativa.getTime(),
      ) ?? null
    );
  }

  async crearEvento(datos: DatosCrearEvento): Promise<EventoCarga> {
    if (this.fallaAlCrear !== null) {
      const falla = this.fallaAlCrear;
      this.fallaAlCrear = null;
      throw falla;
    }
    if (this.ganadorDeCarrera !== null) {
      this.eventos.push(this.ganadorDeCarrera);
      this.ganadorDeCarrera = null;
      throw this.errorDeCarrera;
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
      idHandy: null,
      canceladaPorId: null,
      fechaCancelacion: null,
      motivoCancelacion: null,
      creadoEn: datos.fechaConteo,
    };
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

  // Para encadenar `CancelarCargaUseCase` y `CambiarFechaOperativaUseCase`
  // reales sobre los mismos eventos.
  async buscarEventoPorId(id: string): Promise<EventoCarga | null> {
    return this.eventos.find((e) => e.id === id) ?? null;
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
  async cambiarFechaOperativa(
    datos: DatosCambiarFechaOperativa,
  ): Promise<EventoCarga> {
    const evento = this.eventos.find((e) => e.id === datos.eventoId)!;
    evento.fechaOperativa = datos.fechaNueva;
    return evento;
  }
  async recorrerFechaOperativa(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async cancelarEvento(
    eventoId: string,
    usuarioAppId: string,
    motivo: string | null,
    ahora: Date,
  ): Promise<EventoCarga> {
    const evento = this.eventos.find((e) => e.id === eventoId)!;
    evento.estado = 'CANCELADA';
    evento.canceladaPorId = usuarioAppId;
    evento.motivoCancelacion = motivo;
    evento.fechaCancelacion = ahora;
    return evento;
  }
  reabrirDiscrepancia(): Promise<Discrepancia> {
    throw new Error('no usado en esta prueba');
  }
}

/** Carga INICIAL ya existente en la base, en el estado indicado. */
function inicialExistente(
  estado: EstadoCarga,
  parcial: Partial<EventoCarga> = {},
): EventoCarga {
  return {
    id: `ev-inicial-${estado}`,
    rutaId: 'ruta-7',
    plantillaId: 'plantilla-3',
    tipo: 'INICIAL',
    tipoOperacion: 'AUTOVENTA',
    usuarioHandyId: 42,
    estado,
    fechaConteo: AHORA,
    fechaOperativa: HOY,
    autorizadaPorId: null,
    fechaAutorizacion: null,
    fechaBloqueoCortePendiente: null,
    fechaDesbloqueo: null,
    idHandy: estado === 'ENVIADA' ? ID_HANDY_INICIAL : null,
    canceladaPorId: null,
    fechaCancelacion: null,
    motivoCancelacion: null,
    creadoEn: AHORA,
    ...parcial,
  };
}

/**
 * Doble del puerto de consultas: lee los mismos eventos que el doble de cargas,
 * con el criterio del indice parcial (INICIAL ni ENVIADA ni CANCELADA). Solo
 * implementa lo que este caso de uso usa.
 */
class FakeConsultasCarga implements ConsultasCargaRepository {
  readonly consultas: string[] = [];
  constructor(private readonly cargas: FakeCargaRepository) {}

  async buscarInicialSinTerminarPorRuta(
    rutaId: string,
  ): Promise<InicialSinTerminar | null> {
    this.consultas.push(rutaId);
    const e = this.cargas.eventos.find(
      (e) =>
        e.rutaId === rutaId &&
        e.tipo === 'INICIAL' &&
        e.estado !== 'ENVIADA' &&
        e.estado !== 'CANCELADA',
    );
    return e ? { id: e.id, fechaOperativa: e.fechaOperativa, estado: e.estado } : null;
  }
  listarCargasDeFecha(): Promise<never> {
    throw new Error('no usado en esta prueba');
  }
  listarPendientesVerificacion(): Promise<never> {
    throw new Error('no usado en esta prueba');
  }
  listarConflictosDeParticipante(): Promise<never> {
    throw new Error('no usado en esta prueba');
  }
  obtenerContextoResolucion(): Promise<never> {
    throw new Error('no usado en esta prueba');
  }
  listarDiscrepanciasDetalle(): Promise<never> {
    throw new Error('no usado en esta prueba');
  }
  listarInicialesEnviadasDesde(): Promise<never> {
    throw new Error('no usado en esta prueba');
  }
  buscarInicialEnviadaPorIdHandy(): Promise<never> {
    throw new Error('no usado en esta prueba');
  }
}

/** Dias no laborables en memoria; `listarEntre` respeta el rango. */
class FakeDiasNoLaborables implements DiaNoLaborableRepository {
  dias: Date[] = [];

  async listarEntre(desde: Date, hasta: Date): Promise<DiaNoLaborable[]> {
    return this.dias
      .filter((d) => d >= desde && d <= hasta)
      .map((fecha) => ({
        fecha,
        motivo: 'festivo',
        creadoPorId: null,
        creadoPorNombre: null,
        creadoEn: fecha,
      }));
  }
  marcar(): Promise<DiaNoLaborable> {
    throw new Error('no usado en esta prueba');
  }
  quitar(): Promise<boolean> {
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
 * Doble de Handy. Por defecto la ruta abierta es la de la inicial sembrada, asi
 * que las recargas "normales" pasan; cada prueba de la regla lo cambia.
 */
class FakeHandyGateway extends HandyGateway {
  /** `null` = sin ruta abierta (404 verificado). */
  rutaAbierta: RutaHandy | null = { id: ID_HANDY_INICIAL };
  /** Si se fija, `consultarRutaAbierta` lo lanza. */
  falla: Error | null = null;
  readonly consultas: number[] = [];

  async consultarRutaAbierta(
    usuarioHandyId: number,
  ): Promise<RutaHandy | null> {
    this.consultas.push(usuarioHandyId);
    if (this.falla) throw this.falla;
    return this.rutaAbierta;
  }
  listarProductos(): Promise<PaginaHandy<never>> {
    throw new Error('no usado en esta prueba');
  }
  listarVendedores(): Promise<PaginaHandy<never>> {
    throw new Error('no usado en esta prueba');
  }
  crearRuta(): Promise<RespuestaCrearRuta> {
    throw new Error('no usado en esta prueba');
  }
  recargarRuta(): Promise<RespuestaCrearRuta> {
    throw new Error('no usado en esta prueba');
  }
  cancelarRuta(): Promise<boolean> {
    throw new Error('no usado en esta prueba');
  }
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
  let noLaborables: FakeDiasNoLaborables;
  let consultas: FakeConsultasCarga;
  let useCase: IniciarCargaUseCase;

  beforeEach(() => {
    cargas = new FakeCargaRepository();
    asignaciones = new FakeAsignacionRepository();
    handy = new FakeHandyGateway();
    noLaborables = new FakeDiasNoLaborables();
    consultas = new FakeConsultasCarga(cargas);
    useCase = new IniciarCargaUseCase(
      cargas,
      asignaciones,
      handy,
      noLaborables,
      consultas,
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
        { usuarioAppId: 'v2', tipo: 'INICIAL', usuarioHandyId: 7, fechaOperativa: HOY },
        AHORA,
      ),
    );

    expect(cargas.eventosCreados[0].plantillaId).toBeNull();
    expect(resultado.evento.plantillaId).toBeNull();
  });

  it('respeta el tipo RECARGA recibido', async () => {
    asignaciones.vigente = { rutaId: 'ruta-9', plantillaId: null };
    cargas.eventos.push(inicialExistente('ENVIADA', { rutaId: 'ruta-9' }));

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

  describe('calendario laboral: hoy (si se trabaja) o la siguiente salida', () => {
    const entrada = (fechaOperativa: Date) => ({
      usuarioAppId: 'v1',
      tipo: 'INICIAL' as const,
      usuarioHandyId: 42,
      fechaOperativa,
    });
    const SABADO = new Date('2026-09-12T17:00:00-06:00');
    const DOMINGO = new Date('2026-09-13T10:00:00-06:00');
    const INICIO_SABADO = new Date('2026-09-12T00:00:00-06:00');
    const INICIO_DOMINGO = new Date('2026-09-13T00:00:00-06:00');
    const INICIO_LUNES = new Date('2026-09-14T00:00:00-06:00');

    beforeEach(() => {
      asignaciones.vigente = { rutaId: 'ruta-7', plantillaId: 'plantilla-3' };
    });

    it('rechaza una carga para dentro de 6 dias con FECHA_NO_DISPONIBLE y no crea nada', async () => {
      const resultado = await useCase.ejecutar(
        entrada(new Date('2026-09-14T00:00:00-06:00')),
        AHORA,
      );

      expect(resultado).toEqual({ exito: false, motivo: 'FECHA_NO_DISPONIBLE' });
      expect(cargas.eventosCreados).toHaveLength(0);
      expect(cargas.sesionesCreadas).toHaveLength(0);
    });

    it('rechaza un domingo', async () => {
      const resultado = await useCase.ejecutar(entrada(INICIO_DOMINGO), SABADO);

      expect(resultado).toEqual({ exito: false, motivo: 'FECHA_NO_DISPONIBLE' });
    });

    it('el sabado acepta el sabado y el lunes', async () => {
      const sabado = exigirExito(await useCase.ejecutar(entrada(INICIO_SABADO), SABADO));
      // Ya salio: si no, la del lunes chocaria con una inicial sin terminar.
      sabado.evento.estado = 'ENVIADA';
      exigirExito(await useCase.ejecutar(entrada(INICIO_LUNES), SABADO));
    });

    it('el domingo no acepta hoy, pero si el lunes', async () => {
      expect(await useCase.ejecutar(entrada(INICIO_DOMINGO), DOMINGO)).toEqual({
        exito: false,
        motivo: 'FECHA_NO_DISPONIBLE',
      });
      exigirExito(await useCase.ejecutar(entrada(INICIO_LUNES), DOMINGO));
    });

    it('un dia marcado como no laborable no se puede elegir y recorre la siguiente salida', async () => {
      noLaborables.dias = [MANANA];

      expect(await useCase.ejecutar(entrada(MANANA), AHORA)).toEqual({
        exito: false,
        motivo: 'FECHA_NO_DISPONIBLE',
      });
      exigirExito(
        await useCase.ejecutar(entrada(new Date('2026-09-10T00:00:00-06:00')), AHORA),
      );
    });

    it('tambien aplica a la RECARGA', async () => {
      const resultado = await useCase.ejecutar(
        { ...entrada(INICIO_DOMINGO), tipo: 'RECARGA' },
        SABADO,
      );

      expect(resultado).toEqual({ exito: false, motivo: 'FECHA_NO_DISPONIBLE' });
    });

    it('un dia pasado sigue siendo FECHA_OPERATIVA_INVALIDA', async () => {
      expect(await useCase.ejecutar(entrada(AYER), AHORA)).toEqual({
        exito: false,
        motivo: 'FECHA_OPERATIVA_INVALIDA',
      });
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

    it('permite la INICIAL de otra fecha operativa si la primera ya se envio', async () => {
      const primera = exigirExito(await useCase.ejecutar(entradaInicial, AHORA));
      primera.evento.estado = 'ENVIADA';

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

    it('permite varias RECARGAS el mismo dia sobre la INICIAL enviada', async () => {
      const inicial = exigirExito(await useCase.ejecutar(entradaInicial, AHORA));
      inicial.evento.estado = 'ENVIADA';
      inicial.evento.idHandy = ID_HANDY_INICIAL;
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
        idHandy: null,
        canceladaPorId: null,
        fechaCancelacion: null,
        motivoCancelacion: null,
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
  describe('una sola carga INICIAL sin terminar por ruta, de la fecha que sea', () => {
    // Jueves 10: ni hoy ni mañana. Las cargas sembradas ahi solo existen para
    // chocar; el vendedor no podria crearlas hoy.
    const JUEVES = new Date('2026-09-10T00:00:00-06:00');
    const inicialHoy = {
      usuarioAppId: 'v1',
      tipo: 'INICIAL' as const,
      usuarioHandyId: 42,
      fechaOperativa: HOY,
    };

    beforeEach(() => {
      asignaciones.vigente = { rutaId: 'ruta-7', plantillaId: 'plantilla-3' };
    });

    it('sin otra inicial abierta en la ruta, la crea', async () => {
      exigirExito(await useCase.ejecutar(inicialHoy, AHORA));

      expect(consultas.consultas).toEqual(['ruta-7']);
      expect(cargas.eventosCreados).toHaveLength(1);
    });

    it('con otra en EN_ESPERA_CONTADOR para otra fecha devuelve CARGA_INICIAL_SIN_TERMINAR y no crea nada', async () => {
      // El bug: la de mañana esperaba al contador y dejaba abrir la de hoy.
      cargas.eventos.push(
        inicialExistente('EN_ESPERA_CONTADOR', { id: 'ev-manana', fechaOperativa: MANANA }),
      );

      const resultado = await useCase.ejecutar(inicialHoy, AHORA);

      expect(resultado).toEqual({
        exito: false,
        motivo: 'CARGA_INICIAL_SIN_TERMINAR',
        cargaEnConflicto: {
          id: 'ev-manana',
          fechaOperativa: MANANA,
          estado: 'EN_ESPERA_CONTADOR',
        },
      });
      expect(cargas.eventosCreados).toHaveLength(0);
      expect(cargas.sesionesCreadas).toHaveLength(0);
    });

    it.each<EstadoCarga>([
      'BORRADOR',
      'EN_ESPERA_CONTADOR',
      'BLOQUEADA_CORTE_PENDIENTE',
      'EN_COMPARACION',
      'CONFLICTOS_PENDIENTES',
      'EN_ESPERA_AUTORIZACION',
      'LISTA_PARA_ENVIAR',
      'ERROR_ENVIO',
      'ENVIO_INCIERTO',
    ])('una inicial en %s de otra fecha tambien estorba', async (estado) => {
      cargas.eventos.push(inicialExistente(estado, { fechaOperativa: JUEVES }));

      const resultado = await useCase.ejecutar(inicialHoy, AHORA);

      expect(resultado).toMatchObject({
        exito: false,
        motivo: 'CARGA_INICIAL_SIN_TERMINAR',
        cargaEnConflicto: { estado },
      });
    });

    it('con otra ENVIADA de otra fecha, la crea', async () => {
      cargas.eventos.push(inicialExistente('ENVIADA', { fechaOperativa: AYER }));

      exigirExito(await useCase.ejecutar(inicialHoy, AHORA));
    });

    it('con otra CANCELADA de otra fecha, la crea', async () => {
      cargas.eventos.push(inicialExistente('CANCELADA', { fechaOperativa: MANANA }));

      exigirExito(await useCase.ejecutar(inicialHoy, AHORA));
    });

    it('si la que estorba es del mismo dia gana YA_TIENE_CARGA_ABIERTA, que deja continuarla', async () => {
      cargas.eventos.push(inicialExistente('EN_ESPERA_CONTADOR', { id: 'ev-hoy' }));

      expect(await useCase.ejecutar(inicialHoy, AHORA)).toEqual({
        exito: false,
        motivo: 'YA_TIENE_CARGA_ABIERTA',
        eventoId: 'ev-hoy',
      });
    });

    it('una RECARGA pasa aunque la ruta tenga una inicial sin terminar de otro dia', async () => {
      cargas.eventos.push(
        inicialExistente('ENVIADA', { id: 'ev-hoy' }),
        inicialExistente('EN_ESPERA_CONTADOR', { id: 'ev-manana', fechaOperativa: MANANA }),
      );

      exigirExito(await useCase.ejecutar({ ...inicialHoy, tipo: 'RECARGA' }, AHORA));

      // La regla ni se consulta para la RECARGA.
      expect(consultas.consultas).toHaveLength(0);
    });

    it('con la inicial ENVIADA y dos recargas abiertas, ni otra recarga ni la inicial de mañana chocan', async () => {
      const recargaAbierta = (id: string, estado: EstadoCarga): EventoCarga => ({
        ...inicialExistente(estado),
        id,
        tipo: 'RECARGA',
      });
      cargas.eventos.push(
        inicialExistente('ENVIADA', { id: 'ev-hoy' }),
        recargaAbierta('rec-1', 'EN_ESPERA_CONTADOR'),
        recargaAbierta('rec-2', 'BORRADOR'),
      );

      exigirExito(await useCase.ejecutar({ ...inicialHoy, tipo: 'RECARGA' }, AHORA));
      exigirExito(
        await useCase.ejecutar({ ...inicialHoy, fechaOperativa: MANANA }, AHORA),
      );

      expect(cargas.eventosCreados.map((e) => e.tipo)).toEqual(['RECARGA', 'INICIAL']);
    });

    it('al cancelar la que estorba, el vendedor puede empezar otra enseguida', async () => {
      const cancelar = new CancelarCargaUseCase(cargas);
      const manana = exigirExito(
        await useCase.ejecutar({ ...inicialHoy, fechaOperativa: MANANA }, AHORA),
      );
      expect(await useCase.ejecutar(inicialHoy, AHORA)).toMatchObject({
        motivo: 'CARGA_INICIAL_SIN_TERMINAR',
      });

      const cancelada = await cancelar.ejecutar(
        {
          eventoId: manana.evento.id,
          usuarioAppId: 'v1',
          rolApp: 'VENDEDOR',
          usuarioHandyId: 42,
        },
        AHORA,
      );
      expect(cancelada).toMatchObject({ exito: true, evento: { estado: 'CANCELADA' } });

      const hoy = exigirExito(await useCase.ejecutar(inicialHoy, AHORA));
      expect(hoy.evento.fechaOperativa).toEqual(HOY);
    });

    it('cambiarle la fecha a la que estorba sigue funcionando, y la regla la sigue a su fecha nueva', async () => {
      const cambiarFecha = new CambiarFechaOperativaUseCase(cargas, handy, noLaborables);
      const manana = exigirExito(
        await useCase.ejecutar({ ...inicialHoy, fechaOperativa: MANANA }, AHORA),
      );

      const cambio = await cambiarFecha.ejecutar(
        {
          eventoId: manana.evento.id,
          usuarioAppId: 'v1',
          rolApp: 'VENDEDOR',
          usuarioHandyId: 42,
          fechaOperativa: HOY,
        },
        AHORA,
      );

      expect(cambio).toMatchObject({ exito: true, evento: { fechaOperativa: HOY } });
      // Sigue sin terminar: hoy se continua, mañana todavia no se abre otra.
      expect(await useCase.ejecutar(inicialHoy, AHORA)).toEqual({
        exito: false,
        motivo: 'YA_TIENE_CARGA_ABIERTA',
        eventoId: manana.evento.id,
      });
      expect(
        await useCase.ejecutar({ ...inicialHoy, fechaOperativa: MANANA }, AHORA),
      ).toMatchObject({ motivo: 'CARGA_INICIAL_SIN_TERMINAR' });
    });

    it('carrera: si la base rechaza el alta por el indice nuevo, nombra la carga ganadora', async () => {
      cargas.ganadorDeCarrera = inicialExistente('BORRADOR', {
        id: 'ev-ganador',
        fechaOperativa: MANANA,
      });
      cargas.errorDeCarrera = new CargaInicialSinTerminarError();

      expect(await useCase.ejecutar(inicialHoy, AHORA)).toEqual({
        exito: false,
        motivo: 'CARGA_INICIAL_SIN_TERMINAR',
        cargaEnConflicto: {
          id: 'ev-ganador',
          fechaOperativa: MANANA,
          estado: 'BORRADOR',
        },
      });
      expect(cargas.sesionesCreadas).toHaveLength(0);
    });

    it('carrera: si la ganadora ya no se encuentra, responde sin datos en vez de inventarlos', async () => {
      cargas.fallaAlCrear = new CargaInicialSinTerminarError();

      expect(await useCase.ejecutar(inicialHoy, AHORA)).toEqual({
        exito: false,
        motivo: 'CARGA_INICIAL_SIN_TERMINAR',
        cargaEnConflicto: null,
      });
    });
  });

  describe('la RECARGA exige una salida ENVIADA de la ruta ese dia', () => {
    const recarga = {
      usuarioAppId: 'v1',
      tipo: 'RECARGA' as const,
      usuarioHandyId: 42,
      fechaOperativa: HOY,
    };

    beforeEach(() => {
      asignaciones.vigente = { rutaId: 'ruta-7', plantillaId: 'plantilla-3' };
    });

    it('con la INICIAL de la ruta y fecha ENVIADA, crea la recarga', async () => {
      cargas.eventos.push(inicialExistente('ENVIADA'));

      const resultado = exigirExito(await useCase.ejecutar(recarga, AHORA));

      expect(resultado.evento.tipo).toBe('RECARGA');
      expect(resultado.evento.fechaOperativa).toEqual(HOY);
      expect(cargas.sesionesCreadas).toHaveLength(1);
    });

    it('sin INICIAL ese dia devuelve SIN_SALIDA_ENVIADA y no crea nada', async () => {
      const resultado = await useCase.ejecutar(recarga, AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'SIN_SALIDA_ENVIADA' });
      expect(cargas.eventosCreados).toHaveLength(0);
      expect(cargas.sesionesCreadas).toHaveLength(0);
    });

    const estadosSinSalida: EstadoCarga[] = [
      'BORRADOR',
      'EN_ESPERA_CONTADOR',
      'BLOQUEADA_CORTE_PENDIENTE',
      'EN_COMPARACION',
      'CONFLICTOS_PENDIENTES',
      'EN_ESPERA_AUTORIZACION',
      'LISTA_PARA_ENVIAR',
      'ERROR_ENVIO',
      'ENVIO_INCIERTO',
      'CANCELADA',
    ];

    it.each(estadosSinSalida)(
      'con la INICIAL en %s devuelve SIN_SALIDA_ENVIADA y no crea nada',
      async (estado) => {
        cargas.eventos.push(inicialExistente(estado));

        const resultado = await useCase.ejecutar(recarga, AHORA);

        expect(resultado).toEqual({ exito: false, motivo: 'SIN_SALIDA_ENVIADA' });
        expect(cargas.eventosCreados).toHaveLength(0);
        expect(cargas.sesionesCreadas).toHaveLength(0);
      },
    );

    it('la INICIAL ENVIADA de otra fecha no habilita la recarga', async () => {
      cargas.eventos.push(inicialExistente('ENVIADA', { fechaOperativa: MANANA }));

      const resultado = await useCase.ejecutar(recarga, AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'SIN_SALIDA_ENVIADA' });
    });

    it('la INICIAL ENVIADA de otra ruta no habilita la recarga', async () => {
      cargas.eventos.push(inicialExistente('ENVIADA', { rutaId: 'ruta-9' }));

      const resultado = await useCase.ejecutar(recarga, AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'SIN_SALIDA_ENVIADA' });
    });

    it('una INICIAL nueva no depende de esta regla: se crea sin ninguna salida previa', async () => {
      const resultado = exigirExito(
        await useCase.ejecutar({ ...recarga, tipo: 'INICIAL' }, AHORA),
      );

      expect(resultado.evento.tipo).toBe('INICIAL');
      expect(resultado.evento.estado).toBe('BORRADOR');
    });

    it('una INICIAL nueva tras cancelar la del dia se crea aunque no haya salida', async () => {
      cargas.eventos.push(inicialExistente('CANCELADA'));

      exigirExito(await useCase.ejecutar({ ...recarga, tipo: 'INICIAL' }, AHORA));

      expect(cargas.eventosCreados.map((e) => e.tipo)).toEqual(['INICIAL']);
    });
  });

  describe('la RECARGA exige que Handy tenga ABIERTA la ruta de esa inicial', () => {
    const recarga = {
      usuarioAppId: 'v1',
      tipo: 'RECARGA' as const,
      usuarioHandyId: 42,
      fechaOperativa: HOY,
    };

    beforeEach(() => {
      asignaciones.vigente = { rutaId: 'ruta-7', plantillaId: 'plantilla-3' };
      cargas.eventos.push(inicialExistente('ENVIADA'));
    });

    it('le pregunta a Handy por la ruta abierta del vendedor y, si es la de la inicial, crea la recarga', async () => {
      exigirExito(await useCase.ejecutar(recarga, AHORA));

      expect(handy.consultas).toEqual([42]);
    });

    it('sin ruta abierta en Handy (liquido o cancelo) devuelve SIN_RUTA_ABIERTA_EN_HANDY y no crea nada', async () => {
      handy.rutaAbierta = null;

      const resultado = await useCase.ejecutar(recarga, AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'SIN_RUTA_ABIERTA_EN_HANDY' });
      expect(cargas.eventosCreados).toHaveLength(0);
      expect(cargas.sesionesCreadas).toHaveLength(0);
    });

    it('con otra ruta abierta en Handy (ruta fantasma en nuestra tabla) tambien falla', async () => {
      handy.rutaAbierta = { id: 'otra-ruta-handy' };

      const resultado = await useCase.ejecutar(recarga, AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'SIN_RUTA_ABIERTA_EN_HANDY' });
      expect(cargas.eventosCreados).toHaveLength(0);
    });

    it.each([
      ['token invalido', new HandyTokenInvalidoError('/x')],
      ['5xx', new HandyErrorServidorError('/x', 503)],
      ['sin respuesta', new HandySinRespuestaError('/x', null)],
      ['estado inesperado', new HandyRespuestaNoOkError('/x', 418)],
    ])('Handy no disponible (%s): deja pasar con la regla local', async (_n, falla) => {
      handy.falla = falla;

      const resultado = exigirExito(await useCase.ejecutar(recarga, AHORA));

      expect(resultado.evento.tipo).toBe('RECARGA');
    });

    it('un error que no es de Handy se propaga', async () => {
      handy.falla = new TypeError('bug');

      await expect(useCase.ejecutar(recarga, AHORA)).rejects.toThrow(TypeError);
    });

    it('sin salida ENVIADA ni siquiera se le pregunta a Handy', async () => {
      cargas.eventos.length = 0;

      const resultado = await useCase.ejecutar(recarga, AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'SIN_SALIDA_ENVIADA' });
      expect(handy.consultas).toHaveLength(0);
    });

    it('una INICIAL nunca consulta Handy', async () => {
      await useCase.ejecutar({ ...recarga, tipo: 'INICIAL', fechaOperativa: MANANA }, AHORA);

      expect(handy.consultas).toHaveLength(0);
    });
  });
});

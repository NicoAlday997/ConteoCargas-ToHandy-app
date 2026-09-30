import type { EstadoCarga } from '@prisma/client';

import {
  HandyGateway,
  type PaginaHandy,
  type RespuestaCrearRuta,
  type RutaHandy,
} from '../../sincronizacion/application/handy.gateway';
import type { CargaRepository, EventoCarga } from './carga.repository';
import type {
  ConsultasCargaRepository,
  DiaRecargable,
} from './consultas-carga.repository';
import {
  VerificarCortePendienteUseCase,
  type ResultadoVerificarCortePendiente,
} from './verificar-corte-pendiente.use-case';

/**
 * Pruebas del caso de uso "verificar corte de venta pendiente" (RF-13, docs/01
 * seccion 6 regla 2). Sin red ni base de datos: dobles en memoria de
 * `CargaRepository` y `HandyGateway`.
 *
 * Cubre: sin ruta abierta (no bloquea); ruta abierta comparada por DIA contra
 * la fecha operativa de la carga (mismo dia bloquea, un dia antes pasa y
 * reporta rezago, dos dias antes bloquea); ruta no reconocida (bloquea);
 * RECARGA (no consulta Handy); y estado invalido que no toca Handy ni persiste.
 */

const AHORA = new Date('2026-09-17T18:00:00-06:00');
/** Dn: la carga que se verifica sale mañana (se cuenta hoy en la tarde). */
const FECHA_OPERATIVA_CARGA = new Date('2026-09-18T00:00:00-06:00');
const USUARIO_HANDY_ID = 42;
const EVENTO_ID = 'ev-1';

class FakeCargaRepository implements CargaRepository {
  listarCapturasDeSesion(): never {
    throw new Error('no usado en esta prueba');
  }
  buscarCargaInicialDeFecha(): never {
    throw new Error('no usado en esta prueba');
  }
  private readonly eventos = new Map<string, EventoCarga>();

  readonly bloqueos: Array<{ eventoId: string; ahora: Date }> = [];

  sembrarEvento(evento: EventoCarga): void {
    this.eventos.set(evento.id, { ...evento });
  }

  async buscarEventoPorId(id: string): Promise<EventoCarga | null> {
    const evento = this.eventos.get(id);
    return evento ? { ...evento } : null;
  }

  async bloquearPorCortePendiente(
    eventoId: string,
    ahora: Date,
  ): Promise<EventoCarga> {
    const evento = this.eventos.get(eventoId);
    if (!evento) {
      throw new Error(`evento ${eventoId} inexistente`);
    }
    evento.fechaBloqueoCortePendiente = ahora;
    evento.estado = 'BLOQUEADA_CORTE_PENDIENTE';
    this.bloqueos.push({ eventoId, ahora });
    return { ...evento };
  }

  // --- Metodos del puerto que este caso de uso no usa. ----------------------
  async crearEvento(): Promise<EventoCarga> {
    throw new Error('no usado en estas pruebas');
  }
  async cambiarEstado(): Promise<EventoCarga> {
    throw new Error('no usado en estas pruebas');
  }
  async marcarComoEnviada(): Promise<EventoCarga> {
    throw new Error('no usado en estas pruebas');
  }
  async autorizarEvento(): Promise<EventoCarga> {
    throw new Error('no usado en estas pruebas');
  }
  async desbloquearEvento(): Promise<EventoCarga> {
    throw new Error('no usado en estas pruebas');
  }
  async crearSesion(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async buscarSesionPorId(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async guardarItems(): Promise<void> {
    throw new Error('no usado en estas pruebas');
  }
  async finalizarSesion(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async listarItemsDeSesion(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async listarSesionesDeEvento(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async guardarDiscrepancias(): Promise<void> {
    throw new Error('no usado en estas pruebas');
  }
  async listarDiscrepancias(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async actualizarDiscrepancia(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async cambiarFechaOperativa(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async recorrerFechaOperativa(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async cancelarEvento(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async reabrirDiscrepancia(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
}

class FakeConsultas implements Pick<
  ConsultasCargaRepository,
  'buscarInicialEnviadaPorIdHandy'
> {
  /** Iniciales ENVIADAS de esta app, por `rutaId|idHandy`. */
  readonly enviadas = new Map<string, DiaRecargable>();
  readonly llamadas: Array<{ rutaId: string; idHandy: string }> = [];

  sembrarInicialEnviada(
    rutaId: string,
    idHandy: string,
    fechaOperativa: Date,
  ): void {
    this.enviadas.set(`${rutaId}|${idHandy}`, {
      fechaOperativa,
      eventoInicialId: `inicial-${idHandy}`,
    });
  }

  async buscarInicialEnviadaPorIdHandy(
    rutaId: string,
    idHandy: string,
  ): Promise<DiaRecargable | null> {
    this.llamadas.push({ rutaId, idHandy });
    return this.enviadas.get(`${rutaId}|${idHandy}`) ?? null;
  }
}

class FakeHandyGateway extends HandyGateway {
  /** `null` = sin ruta abierta (404 verificado). */
  rutaAbierta: RutaHandy | null = null;

  readonly llamadas: { consultarRutaAbierta: number[] } = {
    consultarRutaAbierta: [],
  };

  async consultarRutaAbierta(
    usuarioHandyId: number,
  ): Promise<RutaHandy | null> {
    this.llamadas.consultarRutaAbierta.push(usuarioHandyId);
    return this.rutaAbierta;
  }

  listarProductos(): Promise<PaginaHandy<never>> {
    throw new Error('no usado en estas pruebas');
  }
  listarVendedores(): Promise<PaginaHandy<never>> {
    throw new Error('no usado en estas pruebas');
  }
  crearRuta(): Promise<RespuestaCrearRuta> {
    throw new Error('no usado en estas pruebas');
  }
  recargarRuta(): Promise<RespuestaCrearRuta> {
    throw new Error('no usado en estas pruebas');
  }
  cancelarRuta(): Promise<boolean> {
    throw new Error('no usado en estas pruebas');
  }
}

function nuevoEvento(parcial: Partial<EventoCarga> = {}): EventoCarga {
  return {
    id: EVENTO_ID,
    rutaId: 'ruta-1',
    plantillaId: 'plantilla-1',
    tipo: 'INICIAL',
    tipoOperacion: 'AUTOVENTA',
    usuarioHandyId: USUARIO_HANDY_ID,
    estado: 'EN_ESPERA_CONTADOR',
    fechaConteo: AHORA,
    fechaOperativa: FECHA_OPERATIVA_CARGA,
    autorizadaPorId: null,
    fechaAutorizacion: null,
    fechaBloqueoCortePendiente: null,
    fechaDesbloqueo: null,
    idHandy: null,
    canceladaPorId: null,
    fechaCancelacion: null,
    motivoCancelacion: null,
    creadoEn: AHORA,
    ...parcial,
  };
}

function exigirExito(
  resultado: ResultadoVerificarCortePendiente,
): Extract<ResultadoVerificarCortePendiente, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('VerificarCortePendienteUseCase', () => {
  let cargas: FakeCargaRepository;
  let consultas: FakeConsultas;
  let handy: FakeHandyGateway;
  let useCase: VerificarCortePendienteUseCase;

  beforeEach(() => {
    cargas = new FakeCargaRepository();
    consultas = new FakeConsultas();
    handy = new FakeHandyGateway();
    useCase = new VerificarCortePendienteUseCase(
      cargas,
      consultas as unknown as ConsultasCargaRepository,
      handy,
    );
  });

  /** Siembra una ruta abierta en Handy que salio de esta app con fecha `fecha`. */
  function rutaAbiertaDelDia(fecha: string, idHandy = 'ruta-abierta-7'): void {
    handy.rutaAbierta = { id: idHandy };
    consultas.sembrarInicialEnviada(
      'ruta-1',
      idHandy,
      new Date(`${fecha}T00:00:00-06:00`),
    );
  }

  function exigirBloqueo(
    resultado: ResultadoVerificarCortePendiente,
  ): Extract<ResultadoVerificarCortePendiente, { bloqueado: true }> {
    const exito = exigirExito(resultado);
    if (!exito.bloqueado) {
      throw new Error('se esperaba bloqueo');
    }
    return exito;
  }

  it('sin ruta abierta: no bloquea nada y devuelve bloqueado=false', async () => {
    cargas.sembrarEvento(nuevoEvento());
    handy.rutaAbierta = null;

    const resultado = exigirExito(
      await useCase.ejecutar({ eventoId: EVENTO_ID }, AHORA),
    );

    expect(resultado).toEqual({ exito: true, bloqueado: false });
    expect(handy.llamadas.consultarRutaAbierta).toEqual([USUARIO_HANDY_ID]);
    expect(consultas.llamadas).toEqual([]);
    expect(cargas.bloqueos).toEqual([]);
    const evento = await cargas.buscarEventoPorId(EVENTO_ID);
    expect(evento?.estado).toBe('EN_ESPERA_CONTADOR');
  });

  it('ruta abierta del dia anterior (sale hoy, liquida mañana): NO bloquea y reporta la liquidacion rezagada', async () => {
    cargas.sembrarEvento(nuevoEvento());
    rutaAbiertaDelDia('2026-09-17');

    const resultado = await useCase.ejecutar({ eventoId: EVENTO_ID }, AHORA);

    expect(resultado).toEqual({
      exito: true,
      bloqueado: false,
      liquidacionRezagada: {
        rutaHandyId: 'ruta-abierta-7',
        diasDeRetraso: 1,
      },
    });
    expect(consultas.llamadas).toEqual([
      { rutaId: 'ruta-1', idHandy: 'ruta-abierta-7' },
    ]);
    expect(cargas.bloqueos).toEqual([]);
    const evento = await cargas.buscarEventoPorId(EVENTO_ID);
    expect(evento?.estado).toBe('EN_ESPERA_CONTADOR');
  });

  it('ruta abierta del MISMO dia que la carga: bloquea (segunda salida con la primera sin cerrar)', async () => {
    cargas.sembrarEvento(nuevoEvento());
    rutaAbiertaDelDia('2026-09-18');

    const resultado = exigirBloqueo(
      await useCase.ejecutar({ eventoId: EVENTO_ID }, AHORA),
    );

    expect(resultado).toEqual({
      exito: true,
      bloqueado: true,
      evento: expect.objectContaining({ estado: 'BLOQUEADA_CORTE_PENDIENTE' }),
      rutaHandyId: 'ruta-abierta-7',
      causa: 'MISMA_SALIDA',
      generarAlertaMedia: true,
    });
    expect(cargas.bloqueos).toEqual([{ eventoId: EVENTO_ID, ahora: AHORA }]);
    const evento = await cargas.buscarEventoPorId(EVENTO_ID);
    expect(evento?.estado).toBe('BLOQUEADA_CORTE_PENDIENTE');
    expect(evento?.fechaBloqueoCortePendiente).toEqual(AHORA);
  });

  it('ruta abierta de un dia POSTERIOR a la carga: bloquea', async () => {
    cargas.sembrarEvento(nuevoEvento());
    rutaAbiertaDelDia('2026-09-19');

    const resultado = exigirBloqueo(
      await useCase.ejecutar({ eventoId: EVENTO_ID }, AHORA),
    );

    expect(resultado.causa).toBe('MISMA_SALIDA');
    expect(cargas.bloqueos).toHaveLength(1);
  });

  it('ruta abierta de DOS dias antes: bloquea (el vendedor no esta liquidando)', async () => {
    cargas.sembrarEvento(nuevoEvento());
    rutaAbiertaDelDia('2026-09-16');

    const resultado = exigirBloqueo(
      await useCase.ejecutar({ eventoId: EVENTO_ID }, AHORA),
    );

    expect(resultado.causa).toBe('LIQUIDACION_VENCIDA');
    expect(resultado.generarAlertaMedia).toBe(true);
    expect(cargas.bloqueos).toEqual([{ eventoId: EVENTO_ID, ahora: AHORA }]);
  });

  it('ruta abierta que no salio de esta app: bloquea (no se puede saber de que dia es)', async () => {
    cargas.sembrarEvento(nuevoEvento());
    handy.rutaAbierta = { id: 'ruta-creada-en-handy-a-mano' };

    const resultado = exigirBloqueo(
      await useCase.ejecutar({ eventoId: EVENTO_ID }, AHORA),
    );

    expect(resultado.causa).toBe('RUTA_NO_RECONOCIDA');
    expect(resultado.rutaHandyId).toBe('ruta-creada-en-handy-a-mano');
    expect(cargas.bloqueos).toHaveLength(1);
  });

  it('la ruta abierta se busca en la ruta de la carga: una inicial de OTRA ruta con ese id no cuenta', async () => {
    cargas.sembrarEvento(nuevoEvento());
    handy.rutaAbierta = { id: 'ruta-abierta-7' };
    consultas.sembrarInicialEnviada(
      'otra-ruta',
      'ruta-abierta-7',
      new Date('2026-09-17T00:00:00-06:00'),
    );

    const resultado = exigirBloqueo(
      await useCase.ejecutar({ eventoId: EVENTO_ID }, AHORA),
    );

    expect(resultado.causa).toBe('RUTA_NO_RECONOCIDA');
  });

  it('compara en dia de Mexico: carga del 18 contra ruta del 17 guardada como instante UTC del 17', async () => {
    cargas.sembrarEvento(nuevoEvento());
    handy.rutaAbierta = { id: 'ruta-abierta-7' };
    // 06:00Z del 17 = 00:00 del 17 en Mexico.
    consultas.sembrarInicialEnviada(
      'ruta-1',
      'ruta-abierta-7',
      new Date('2026-09-17T06:00:00Z'),
    );

    const resultado = exigirExito(
      await useCase.ejecutar({ eventoId: EVENTO_ID }, AHORA),
    );

    expect(resultado.bloqueado).toBe(false);
  });

  it('RECARGA con ruta abierta en Handy: no bloquea y NO consulta Handy (la ruta abierta es la que se recarga)', async () => {
    cargas.sembrarEvento(nuevoEvento({ tipo: 'RECARGA' }));
    handy.rutaAbierta = { id: 'ruta-del-dia-que-se-recarga' };

    const resultado = await useCase.ejecutar({ eventoId: EVENTO_ID }, AHORA);

    expect(resultado).toEqual({ exito: true, bloqueado: false });
    expect(handy.llamadas.consultarRutaAbierta).toEqual([]);
    expect(consultas.llamadas).toEqual([]);
    expect(cargas.bloqueos).toEqual([]);
    const evento = await cargas.buscarEventoPorId(EVENTO_ID);
    expect(evento?.estado).toBe('EN_ESPERA_CONTADOR');
  });

  it('rechaza ESTADO_INVALIDO si el evento no existe y no consulta Handy', async () => {
    const resultado = await useCase.ejecutar(
      { eventoId: 'ev-fantasma' },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
    expect(handy.llamadas.consultarRutaAbierta).toEqual([]);
  });

  it.each<EstadoCarga>([
    'BORRADOR',
    'BLOQUEADA_CORTE_PENDIENTE',
    'EN_COMPARACION',
    'CONFLICTOS_PENDIENTES',
    'EN_ESPERA_AUTORIZACION',
    'LISTA_PARA_ENVIAR',
    'ENVIADA',
  ])(
    'rechaza ESTADO_INVALIDO si el evento esta en %s (no EN_ESPERA_CONTADOR) y no consulta Handy',
    async (estado) => {
      cargas.sembrarEvento(nuevoEvento({ estado }));

      const resultado = await useCase.ejecutar({ eventoId: EVENTO_ID }, AHORA);

      expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
      expect(handy.llamadas.consultarRutaAbierta).toEqual([]);
      expect(cargas.bloqueos).toEqual([]);
    },
  );
});

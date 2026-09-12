import type {
  EstadoCarga,
  EstadoSesion,
  TipoCarga,
  TipoSesion,
} from '@prisma/client';

import {
  HandyGateway,
  HandySinRespuestaError,
  HandyTokenInvalidoError,
  type ItemRutaHandy,
  type PaginaHandy,
  type PayloadCrearRuta,
  type RespuestaCrearRuta,
  type RutaHandy,
} from '../../sincronizacion/application/handy.gateway';
import type {
  CargaRepository,
  Discrepancia,
  EventoCarga,
  ItemCapturado,
  SesionConteo,
} from './carga.repository';
import {
  EnviarCargaUseCase,
  type ResultadoEnviarCarga,
} from './enviar-carga.use-case';

/**
 * Pruebas del caso de uso "enviar carga a Handy". Sin red ni base de datos:
 * dobles en memoria de `CargaRepository` y `HandyGateway`.
 *
 * Cubre: envio exitoso de carga inicial, recarga por el endpoint de recharge,
 * `ENVIO_INCIERTO` con y sin ruta ya creada (defensa anti-duplicado), estado
 * invalido, aislamiento de inventario insuficiente, token invalido y timeout.
 */

const AHORA = new Date('2026-09-08T22:00:00-06:00');
const INICIADA_EN = new Date('2026-09-08T20:00:00-06:00');
const USUARIO_HANDY_ID = 42;

class FakeCargaRepository implements CargaRepository {
  private readonly eventos = new Map<string, EventoCarga>();
  private readonly sesionesPorEvento = new Map<string, SesionConteo[]>();
  private readonly itemsPorSesion = new Map<string, ItemCapturado[]>();
  private readonly discrepanciasPorEvento = new Map<string, Discrepancia[]>();

  /** Bitacora de estados aplicados, en orden (cambiarEstado + marcarComoEnviada). */
  readonly transiciones: EstadoCarga[] = [];
  readonly envios: Array<{ eventoId: string; idHandy: string; ahora: Date }> = [];

  sembrarEvento(evento: EventoCarga): void {
    this.eventos.set(evento.id, { ...evento });
  }

  sembrarSesiones(eventoId: string, sesiones: SesionConteo[]): void {
    this.sesionesPorEvento.set(
      eventoId,
      sesiones.map((s) => ({ ...s })),
    );
  }

  sembrarItems(sesionId: string, items: ItemCapturado[]): void {
    this.itemsPorSesion.set(
      sesionId,
      items.map((i) => ({ ...i })),
    );
  }

  sembrarDiscrepancias(eventoId: string, discrepancias: Discrepancia[]): void {
    this.discrepanciasPorEvento.set(
      eventoId,
      discrepancias.map((d) => ({ ...d })),
    );
  }

  async buscarEventoPorId(id: string): Promise<EventoCarga | null> {
    const evento = this.eventos.get(id);
    return evento ? { ...evento } : null;
  }

  async cambiarEstado(
    eventoId: string,
    nuevoEstado: EstadoCarga,
  ): Promise<EventoCarga> {
    const evento = this.eventos.get(eventoId);
    if (!evento) {
      throw new Error(`evento ${eventoId} inexistente`);
    }
    evento.estado = nuevoEstado;
    this.transiciones.push(nuevoEstado);
    return { ...evento };
  }

  async marcarComoEnviada(
    eventoId: string,
    idHandy: string,
    ahora: Date,
  ): Promise<EventoCarga> {
    const evento = this.eventos.get(eventoId);
    if (!evento) {
      throw new Error(`evento ${eventoId} inexistente`);
    }
    evento.estado = 'ENVIADA';
    this.transiciones.push('ENVIADA');
    this.envios.push({ eventoId, idHandy, ahora });
    return { ...evento };
  }

  async listarSesionesDeEvento(eventoId: string): Promise<SesionConteo[]> {
    return (this.sesionesPorEvento.get(eventoId) ?? []).map((s) => ({ ...s }));
  }

  async listarItemsDeSesion(sesionId: string): Promise<ItemCapturado[]> {
    return (this.itemsPorSesion.get(sesionId) ?? []).map((i) => ({ ...i }));
  }

  async listarDiscrepancias(eventoId: string): Promise<Discrepancia[]> {
    return (this.discrepanciasPorEvento.get(eventoId) ?? []).map((d) => ({
      ...d,
    }));
  }

  // --- Metodos del puerto que este caso de uso no usa. ----------------------
  async crearEvento(): Promise<EventoCarga> {
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
  async guardarDiscrepancias(): Promise<void> {
    throw new Error('no usado en estas pruebas');
  }
  async actualizarDiscrepancia(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
  async autorizarEvento(): Promise<EventoCarga> {
    throw new Error('no usado en estas pruebas');
  }
  async reabrirDiscrepancia(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
}

class FakeHandyGateway extends HandyGateway {
  /** Ruta que `consultarRutaAbierta` devuelve; `null` = sin ruta abierta (404). */
  rutaAbierta: RutaHandy | null = null;
  errorConsultarRuta: Error | null = null;

  /** Cola de respuestas de crearRuta/recargarRuta; al agotarse usa la de defecto. */
  readonly respuestasEnvio: RespuestaCrearRuta[] = [];
  respuestaEnvioPorDefecto: RespuestaCrearRuta = {
    estado: 'CREADA',
    idHandy: 'ruta-handy-1',
  };
  errorEnvio: Error | null = null;

  readonly llamadas = {
    consultarRutaAbierta: [] as number[],
    crearRuta: [] as Array<{ usuarioHandyId: number; payload: PayloadCrearRuta }>,
    recargarRuta: [] as Array<{
      usuarioHandyId: number;
      items: ItemRutaHandy[];
    }>,
    cancelarRuta: [] as string[],
  };

  async consultarRutaAbierta(
    usuarioHandyId: number,
  ): Promise<RutaHandy | null> {
    this.llamadas.consultarRutaAbierta.push(usuarioHandyId);
    if (this.errorConsultarRuta) {
      throw this.errorConsultarRuta;
    }
    return this.rutaAbierta;
  }

  async crearRuta(
    usuarioHandyId: number,
    payload: PayloadCrearRuta,
  ): Promise<RespuestaCrearRuta> {
    this.llamadas.crearRuta.push({ usuarioHandyId, payload });
    return this.siguienteRespuestaEnvio();
  }

  async recargarRuta(
    usuarioHandyId: number,
    items: ItemRutaHandy[],
  ): Promise<RespuestaCrearRuta> {
    this.llamadas.recargarRuta.push({ usuarioHandyId, items });
    return this.siguienteRespuestaEnvio();
  }

  async cancelarRuta(rutaId: string): Promise<boolean> {
    this.llamadas.cancelarRuta.push(rutaId);
    return true;
  }

  private siguienteRespuestaEnvio(): RespuestaCrearRuta {
    if (this.errorEnvio) {
      throw this.errorEnvio;
    }
    return this.respuestasEnvio.shift() ?? this.respuestaEnvioPorDefecto;
  }

  listarProductos(): Promise<PaginaHandy<never>> {
    throw new Error('no usado en estas pruebas');
  }
  listarVendedores(): Promise<PaginaHandy<never>> {
    throw new Error('no usado en estas pruebas');
  }
}

function sesionCerrada(
  id: string,
  eventoCargaId: string,
  tipo: TipoSesion,
  usuarioAppId: string,
  estado: EstadoSesion = 'CERRADA',
): SesionConteo {
  return {
    id,
    eventoCargaId,
    tipo,
    usuarioAppId,
    dispositivoId: null,
    ubicacion: null,
    estado,
    iniciadaEn: INICIADA_EN,
    finalizadaEn: estado === 'CERRADA' ? AHORA : null,
  };
}

interface OpcionesSiembra {
  estado?: EstadoCarga;
  tipo?: TipoCarga;
  itemsVendedor?: ItemCapturado[];
  itemsContador?: ItemCapturado[];
  discrepancias?: Discrepancia[];
}

const EVENTO_ID = 'ev-1';

function sembrarCargaLista(
  repo: FakeCargaRepository,
  opciones: OpcionesSiembra = {},
): void {
  const itemsVendedor = opciones.itemsVendedor ?? [
    { productoCode: 'P1', cantidad: 10 },
  ];
  const itemsContador = opciones.itemsContador ?? itemsVendedor;

  repo.sembrarEvento({
    id: EVENTO_ID,
    rutaId: 'ruta-1',
    plantillaId: 'plantilla-1',
    tipo: opciones.tipo ?? 'INICIAL',
    tipoOperacion: 'AUTOVENTA',
    usuarioHandyId: USUARIO_HANDY_ID,
    estado: opciones.estado ?? 'LISTA_PARA_ENVIAR',
    fechaConteo: INICIADA_EN,
    autorizadaPorId: null,
    fechaAutorizacion: null,
    creadoEn: INICIADA_EN,
  });
  repo.sembrarSesiones(EVENTO_ID, [
    sesionCerrada('se-v', EVENTO_ID, 'VENDEDOR', 'vendedor-1'),
    sesionCerrada('se-c', EVENTO_ID, 'CONTADOR', 'contador-1'),
  ]);
  repo.sembrarItems('se-v', itemsVendedor);
  repo.sembrarItems('se-c', itemsContador);
  if (opciones.discrepancias && opciones.discrepancias.length > 0) {
    repo.sembrarDiscrepancias(EVENTO_ID, opciones.discrepancias);
  }
}

function exigirExito(
  resultado: ResultadoEnviarCarga,
): Extract<ResultadoEnviarCarga, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('EnviarCargaUseCase', () => {
  let cargas: FakeCargaRepository;
  let handy: FakeHandyGateway;
  let useCase: EnviarCargaUseCase;

  beforeEach(() => {
    cargas = new FakeCargaRepository();
    handy = new FakeHandyGateway();
    useCase = new EnviarCargaUseCase(cargas, handy);
  });

  const entrada = { eventoId: EVENTO_ID, usuarioAppId: 'supervisor-1' };

  it('envia una carga inicial: crea la ruta y deja el evento ENVIADA con su idHandy', async () => {
    sembrarCargaLista(cargas, {
      itemsVendedor: [
        { productoCode: 'P1', cantidad: 10 },
        { productoCode: 'P2', cantidad: 4 },
      ],
    });
    handy.respuestaEnvioPorDefecto = { estado: 'CREADA', idHandy: 'r-abc' };

    const resultado = exigirExito(await useCase.ejecutar(entrada, AHORA));

    expect(resultado).toEqual({
      exito: true,
      idHandy: 'r-abc',
      yaExistia: false,
      productosRechazados: [],
      generarAlertaInventario: false,
    });
    expect(handy.llamadas.crearRuta).toEqual([
      {
        usuarioHandyId: USUARIO_HANDY_ID,
        payload: {
          products: [
            { product: 'P1', quantity: 10 },
            { product: 'P2', quantity: 4 },
          ],
          salesOrders: [],
        },
      },
    ]);
    expect(handy.llamadas.recargarRuta).toEqual([]);
    expect(cargas.envios).toEqual([
      { eventoId: EVENTO_ID, idHandy: 'r-abc', ahora: AHORA },
    ]);
    expect(cargas.transiciones).toEqual(['ENVIADA']);
    const evento = await cargas.buscarEventoPorId(EVENTO_ID);
    expect(evento?.estado).toBe('ENVIADA');
  });

  it('usa la cantidad final acordada cuando hubo discrepancia resuelta', async () => {
    sembrarCargaLista(cargas, {
      estado: 'LISTA_PARA_ENVIAR',
      itemsVendedor: [
        { productoCode: 'P1', cantidad: 10 },
        { productoCode: 'P2', cantidad: 6 },
      ],
      itemsContador: [
        { productoCode: 'P1', cantidad: 10 },
        { productoCode: 'P2', cantidad: 8 },
      ],
      discrepancias: [
        {
          productoCode: 'P2',
          cantidadVendedorOriginal: 6,
          cantidadContadorOriginal: 8,
          cantidadFinal: 7,
          capturadaPor: 'vendedor-1',
          fechaCaptura: AHORA,
          confirmadaPor: 'contador-1',
          fechaConfirmacion: AHORA,
        },
      ],
    });

    await useCase.ejecutar(entrada, AHORA);

    expect(handy.llamadas.crearRuta[0].payload.products).toEqual([
      { product: 'P1', quantity: 10 },
      { product: 'P2', quantity: 7 },
    ]);
  });

  it('una recarga usa el endpoint de recharge, no el de crear ruta', async () => {
    sembrarCargaLista(cargas, {
      tipo: 'RECARGA',
      itemsVendedor: [{ productoCode: 'P9', cantidad: 3 }],
    });
    handy.respuestaEnvioPorDefecto = { estado: 'CREADA', idHandy: 'r-recarga' };

    const resultado = exigirExito(await useCase.ejecutar(entrada, AHORA));

    expect(resultado.idHandy).toBe('r-recarga');
    expect(handy.llamadas.recargarRuta).toEqual([
      {
        usuarioHandyId: USUARIO_HANDY_ID,
        items: [{ product: 'P9', quantity: 3 }],
      },
    ]);
    expect(handy.llamadas.crearRuta).toEqual([]);
  });

  it('ENVIO_INCIERTO con ruta ya existente: NO reenvia y concilia el evento como ENVIADA', async () => {
    sembrarCargaLista(cargas, { estado: 'ENVIO_INCIERTO' });
    handy.rutaAbierta = { id: 'ruta-del-intento-previo' };

    const resultado = exigirExito(await useCase.ejecutar(entrada, AHORA));

    expect(resultado).toEqual({
      exito: true,
      idHandy: 'ruta-del-intento-previo',
      yaExistia: true,
      productosRechazados: [],
      generarAlertaInventario: false,
    });
    expect(handy.llamadas.consultarRutaAbierta).toEqual([USUARIO_HANDY_ID]);
    expect(handy.llamadas.crearRuta).toEqual([]);
    expect(handy.llamadas.recargarRuta).toEqual([]);
    expect(cargas.envios).toEqual([
      { eventoId: EVENTO_ID, idHandy: 'ruta-del-intento-previo', ahora: AHORA },
    ]);
    expect(cargas.transiciones).toEqual(['LISTA_PARA_ENVIAR', 'ENVIADA']);
  });

  it('ENVIO_INCIERTO sin ruta existente: si reenvia y crea la ruta', async () => {
    sembrarCargaLista(cargas, { estado: 'ENVIO_INCIERTO' });
    handy.rutaAbierta = null;
    handy.respuestaEnvioPorDefecto = { estado: 'CREADA', idHandy: 'r-nueva' };

    const resultado = exigirExito(await useCase.ejecutar(entrada, AHORA));

    expect(handy.llamadas.consultarRutaAbierta).toEqual([USUARIO_HANDY_ID]);
    expect(handy.llamadas.crearRuta).toHaveLength(1);
    expect(resultado).toMatchObject({
      exito: true,
      idHandy: 'r-nueva',
      yaExistia: false,
    });
    expect(cargas.transiciones).toEqual(['LISTA_PARA_ENVIAR', 'ENVIADA']);
  });

  it('rechaza ESTADO_INVALIDO si el evento no esta listo para enviar y no toca Handy', async () => {
    sembrarCargaLista(cargas, { estado: 'CONFLICTOS_PENDIENTES' });

    const resultado = await useCase.ejecutar(entrada, AHORA);

    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
    expect(handy.llamadas.crearRuta).toEqual([]);
    expect(handy.llamadas.consultarRutaAbierta).toEqual([]);
    expect(cargas.transiciones).toEqual([]);
  });

  it('rechaza ESTADO_INVALIDO si el evento no existe', async () => {
    const resultado = await useCase.ejecutar(
      { eventoId: 'ev-fantasma', usuarioAppId: 'supervisor-1' },
      AHORA,
    );
    expect(resultado).toEqual({ exito: false, motivo: 'ESTADO_INVALIDO' });
  });

  it('inventario insuficiente: aisla los productos rechazados y envia el resto sin bloquearlo', async () => {
    sembrarCargaLista(cargas, {
      itemsVendedor: [
        { productoCode: 'P1', cantidad: 10 },
        { productoCode: 'P2', cantidad: 5 },
        { productoCode: 'P3', cantidad: 8 },
      ],
    });
    handy.respuestasEnvio.push(
      { estado: 'INVENTARIO_INSUFICIENTE', productosRechazados: ['P2'] },
      { estado: 'CREADA', idHandy: 'r-parcial' },
    );

    const resultado = exigirExito(await useCase.ejecutar(entrada, AHORA));

    expect(resultado).toEqual({
      exito: true,
      idHandy: 'r-parcial',
      yaExistia: false,
      productosRechazados: ['P2'],
      generarAlertaInventario: true,
    });
    // Primer intento con los tres; reintento sin el producto aislado.
    expect(handy.llamadas.crearRuta.map((l) => l.payload.products)).toEqual([
      [
        { product: 'P1', quantity: 10 },
        { product: 'P2', quantity: 5 },
        { product: 'P3', quantity: 8 },
      ],
      [
        { product: 'P1', quantity: 10 },
        { product: 'P3', quantity: 8 },
      ],
    ]);
    const evento = await cargas.buscarEventoPorId(EVENTO_ID);
    expect(evento?.estado).toBe('ENVIADA');
  });

  it('inventario insuficiente en TODOS los productos: no crea ruta y el evento sigue LISTA_PARA_ENVIAR', async () => {
    sembrarCargaLista(cargas, {
      itemsVendedor: [{ productoCode: 'P1', cantidad: 10 }],
    });
    handy.respuestasEnvio.push({
      estado: 'INVENTARIO_INSUFICIENTE',
      productosRechazados: ['P1'],
    });

    const resultado = await useCase.ejecutar(entrada, AHORA);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'INVENTARIO_INSUFICIENTE_TOTAL',
      productosRechazados: ['P1'],
      generarAlertaInventario: true,
    });
    expect(handy.llamadas.crearRuta).toHaveLength(1);
    expect(cargas.envios).toEqual([]);
    const evento = await cargas.buscarEventoPorId(EVENTO_ID);
    expect(evento?.estado).toBe('LISTA_PARA_ENVIAR');
  });

  it('token de Handy invalido: transiciona a ERROR_ENVIO con alerta alta', async () => {
    sembrarCargaLista(cargas, { estado: 'LISTA_PARA_ENVIAR' });
    handy.errorEnvio = new HandyTokenInvalidoError('/user/42/route');

    const resultado = await useCase.ejecutar(entrada, AHORA);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'ERROR_ENVIO',
      generarAlertaAlta: true,
    });
    expect(cargas.transiciones).toEqual(['ERROR_ENVIO']);
    expect(cargas.envios).toEqual([]);
  });

  it('timeout / sin respuesta de Handy: transiciona a ENVIO_INCIERTO con alerta alta', async () => {
    sembrarCargaLista(cargas, { estado: 'LISTA_PARA_ENVIAR' });
    handy.errorEnvio = new HandySinRespuestaError('/user/42/route', new Error('ETIMEDOUT'));

    const resultado = await useCase.ejecutar(entrada, AHORA);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'ENVIO_INCIERTO',
      generarAlertaAlta: true,
    });
    expect(cargas.transiciones).toEqual(['ENVIO_INCIERTO']);
  });
});

import type {
  EstadoCarga,
  TipoCarga,
  TipoSesion,
  UbicacionConteo,
} from '@prisma/client';

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
import {
  FinalizarSesionUseCase,
  type ResultadoFinalizarSesion,
} from './finalizar-sesion.use-case';

/**
 * Pruebas del caso de uso "finalizar sesion" (RF-14). Sin base de datos: doble
 * en memoria del puerto `CargaRepository`.
 *
 * Cubre: sesion ajena rechazada, primera sesion -> EN_ESPERA_CONTADOR, segunda
 * sesion con conteos identicos -> EN_ESPERA_AUTORIZACION, segunda sesion con
 * discrepancias -> CONFLICTOS_PENDIENTES, y el guardarraiil de `puedeTransicionar`.
 */

const AHORA = new Date('2026-09-08T09:00:00-06:00');
const INICIADA_EN = new Date('2026-09-08T08:00:00-06:00');

class FakeCargaRepository implements CargaRepository {
  private readonly eventos = new Map<string, EventoCarga>();
  private readonly sesiones = new Map<string, SesionConteo>();
  private readonly items = new Map<string, ItemCapturado[]>();
  private readonly discrepancias = new Map<string, Discrepancia[]>();
  private secuencia = 0;

  /** Bitacora de transiciones aplicadas, en orden. */
  readonly transiciones: Array<{ eventoId: string; estado: EstadoCarga }> = [];

  private nuevoId(prefijo: string): string {
    this.secuencia += 1;
    return `${prefijo}-${this.secuencia}`;
  }

  async crearEvento(datos: DatosCrearEvento): Promise<EventoCarga> {
    const evento: EventoCarga = {
      id: this.nuevoId('ev'),
      rutaId: datos.rutaId,
      plantillaId: datos.plantillaId,
      tipo: datos.tipo,
      tipoOperacion: datos.tipoOperacion,
      usuarioHandyId: datos.usuarioHandyId,
      estado: 'BORRADOR',
      fechaConteo: datos.fechaConteo,
      autorizadaPorId: null,
      fechaAutorizacion: null,
      creadoEn: datos.fechaConteo,
    };
    this.eventos.set(evento.id, evento);
    return { ...evento };
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
    this.transiciones.push({ eventoId, estado: nuevoEstado });
    return { ...evento };
  }

  async marcarComoEnviada(): Promise<EventoCarga> {
    throw new Error('no usado en estas pruebas');
  }

  async autorizarEvento(): Promise<EventoCarga> {
    throw new Error('no usado en estas pruebas');
  }

  async crearSesion(
    eventoId: string,
    tipo: TipoSesion,
    usuarioAppId: string,
    dispositivoId?: string,
    ubicacion?: UbicacionConteo,
  ): Promise<SesionConteo> {
    const sesion: SesionConteo = {
      id: this.nuevoId('se'),
      eventoCargaId: eventoId,
      tipo,
      usuarioAppId,
      dispositivoId: dispositivoId ?? null,
      ubicacion: ubicacion ?? null,
      estado: 'ABIERTA',
      iniciadaEn: INICIADA_EN,
      finalizadaEn: null,
    };
    this.sesiones.set(sesion.id, sesion);
    return { ...sesion };
  }

  async buscarSesionPorId(sesionId: string): Promise<SesionConteo | null> {
    const sesion = this.sesiones.get(sesionId);
    return sesion ? { ...sesion } : null;
  }

  async guardarItems(sesionId: string, items: ItemAGuardar[]): Promise<void> {
    this.items.set(
      sesionId,
      items.map((i) => ({ ...i })),
    );
  }

  async finalizarSesion(sesionId: string, ahora: Date): Promise<SesionConteo> {
    const sesion = this.sesiones.get(sesionId);
    if (!sesion) {
      throw new Error(`sesion ${sesionId} inexistente`);
    }
    sesion.estado = 'CERRADA';
    sesion.finalizadaEn = ahora;
    return { ...sesion };
  }

  async listarItemsDeSesion(sesionId: string): Promise<ItemCapturado[]> {
    return (this.items.get(sesionId) ?? []).map((i) => ({ ...i }));
  }

  async listarSesionesDeEvento(eventoId: string): Promise<SesionConteo[]> {
    return [...this.sesiones.values()]
      .filter((s) => s.eventoCargaId === eventoId)
      .map((s) => ({ ...s }));
  }

  async guardarDiscrepancias(
    eventoId: string,
    discrepancias: DiscrepanciaAGuardar[],
  ): Promise<void> {
    const previas = this.discrepancias.get(eventoId) ?? [];
    this.discrepancias.set(
      eventoId,
      discrepancias.map((d) => {
        const previa = previas.find((p) => p.productoCode === d.productoCode);
        return {
          productoCode: d.productoCode,
          cantidadVendedorOriginal: d.cantidadVendedorOriginal,
          cantidadContadorOriginal: d.cantidadContadorOriginal,
          cantidadFinal: previa?.cantidadFinal ?? null,
          capturadaPor: previa?.capturadaPor ?? null,
          fechaCaptura: previa?.fechaCaptura ?? null,
          confirmadaPor: previa?.confirmadaPor ?? null,
          fechaConfirmacion: previa?.fechaConfirmacion ?? null,
        };
      }),
    );
  }

  async listarDiscrepancias(eventoId: string): Promise<Discrepancia[]> {
    return (this.discrepancias.get(eventoId) ?? []).map((d) => ({ ...d }));
  }

  async actualizarDiscrepancia(
    eventoId: string,
    productoCode: string,
    datos: DatosActualizarDiscrepancia,
  ): Promise<Discrepancia> {
    const lista = this.discrepancias.get(eventoId) ?? [];
    const discrepancia = lista.find((d) => d.productoCode === productoCode);
    if (!discrepancia) {
      throw new Error(`discrepancia ${productoCode} inexistente`);
    }
    Object.assign(discrepancia, datos);
    return { ...discrepancia };
  }

  async reabrirDiscrepancia(): Promise<never> {
    throw new Error('no usado en estas pruebas');
  }
}

/** Arma un evento con su sesion de vendedor ya lista para las pruebas. */
async function sembrarEvento(
  repo: FakeCargaRepository,
  opciones: {
    tipo?: TipoCarga;
    estado?: EstadoCarga;
    vendedorId?: string;
    itemsVendedor?: ItemCapturado[];
  } = {},
): Promise<{ evento: EventoCarga; sesionVendedor: SesionConteo }> {
  const evento = await repo.crearEvento({
    rutaId: 'ruta-1',
    plantillaId: 'plantilla-1',
    tipo: opciones.tipo ?? 'INICIAL',
    usuarioHandyId: 42,
    tipoOperacion: 'AUTOVENTA',
    fechaConteo: AHORA,
  });
  const sesionVendedor = await repo.crearSesion(
    evento.id,
    'VENDEDOR',
    opciones.vendedorId ?? 'vendedor-1',
  );
  if (opciones.itemsVendedor) {
    await repo.guardarItems(sesionVendedor.id, opciones.itemsVendedor);
  }
  if (opciones.estado && opciones.estado !== 'BORRADOR') {
    await repo.cambiarEstado(evento.id, opciones.estado);
  }
  return { evento, sesionVendedor };
}

function exigirExito(
  resultado: ResultadoFinalizarSesion,
): Extract<ResultadoFinalizarSesion, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('FinalizarSesionUseCase', () => {
  let repo: FakeCargaRepository;
  let useCase: FinalizarSesionUseCase;

  beforeEach(() => {
    repo = new FakeCargaRepository();
    useCase = new FinalizarSesionUseCase(repo);
  });

  it('rechaza SESION_NO_ENCONTRADA si la sesion no existe', async () => {
    const resultado = await useCase.ejecutar('se-fantasma', 'quien-sea', AHORA);
    expect(resultado).toEqual({ exito: false, motivo: 'SESION_NO_ENCONTRADA' });
  });

  it('rechaza SESION_AJENA y NO cierra la sesion de otro usuario', async () => {
    const { sesionVendedor } = await sembrarEvento(repo);

    const resultado = await useCase.ejecutar(
      sesionVendedor.id,
      'otro-usuario',
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'SESION_AJENA' });
    const sinTocar = await repo.buscarSesionPorId(sesionVendedor.id);
    expect(sinTocar?.estado).toBe('ABIERTA');
    expect(sinTocar?.finalizadaEn).toBeNull();
  });

  it('primera sesion cerrada: pasa el evento a EN_ESPERA_CONTADOR', async () => {
    const { evento, sesionVendedor } = await sembrarEvento(repo, {
      itemsVendedor: [{ productoCode: 'A', cantidad: 5 }],
    });

    const resultado = exigirExito(
      await useCase.ejecutar(sesionVendedor.id, 'vendedor-1', AHORA),
    );

    expect(resultado.evento.estado).toBe('EN_ESPERA_CONTADOR');
    expect(resultado.sesion.estado).toBe('CERRADA');
    expect(resultado.sesion.finalizadaEn).toEqual(AHORA);
    expect(resultado.discrepancias).toEqual([]);
    expect(repo.transiciones).toEqual([
      { eventoId: evento.id, estado: 'EN_ESPERA_CONTADOR' },
    ]);
  });

  it('segunda sesion con conteos identicos: pasa por EN_COMPARACION y termina en EN_ESPERA_AUTORIZACION', async () => {
    const { evento, sesionVendedor } = await sembrarEvento(repo, {
      estado: 'EN_ESPERA_CONTADOR',
      itemsVendedor: [
        { productoCode: 'A', cantidad: 5 },
        { productoCode: 'B', cantidad: 3 },
      ],
    });
    await repo.finalizarSesion(sesionVendedor.id, AHORA);

    const sesionContador = await repo.crearSesion(
      evento.id,
      'CONTADOR',
      'contador-1',
    );
    await repo.guardarItems(sesionContador.id, [
      { productoCode: 'A', cantidad: 5 },
      { productoCode: 'B', cantidad: 3 },
    ]);

    const resultado = exigirExito(
      await useCase.ejecutar(sesionContador.id, 'contador-1', AHORA),
    );

    // Aunque todo coincidio, NO se envia directo: falta la autorizacion del
    // supervisor, el tercer par de ojos (CLAUDE.md).
    expect(resultado.evento.estado).toBe('EN_ESPERA_AUTORIZACION');
    expect(resultado.discrepancias).toEqual([]);
    expect(repo.transiciones).toEqual([
      { eventoId: evento.id, estado: 'EN_ESPERA_CONTADOR' },
      { eventoId: evento.id, estado: 'EN_COMPARACION' },
      { eventoId: evento.id, estado: 'EN_ESPERA_AUTORIZACION' },
    ]);
  });

  it('segunda sesion con discrepancias: pasa por EN_COMPARACION y termina en CONFLICTOS_PENDIENTES', async () => {
    const { evento, sesionVendedor } = await sembrarEvento(repo, {
      estado: 'EN_ESPERA_CONTADOR',
      itemsVendedor: [
        { productoCode: 'A', cantidad: 5 },
        { productoCode: 'B', cantidad: 3 },
      ],
    });
    await repo.finalizarSesion(sesionVendedor.id, AHORA);

    const sesionContador = await repo.crearSesion(
      evento.id,
      'CONTADOR',
      'contador-1',
    );
    await repo.guardarItems(sesionContador.id, [
      { productoCode: 'A', cantidad: 5 },
      { productoCode: 'B', cantidad: 99 },
    ]);

    const resultado = exigirExito(
      await useCase.ejecutar(sesionContador.id, 'contador-1', AHORA),
    );

    expect(resultado.evento.estado).toBe('CONFLICTOS_PENDIENTES');
    expect(resultado.discrepancias).toEqual([
      {
        productoCode: 'B',
        cantidadVendedorOriginal: 3,
        cantidadContadorOriginal: 99,
        cantidadFinal: null,
        capturadaPor: null,
        fechaCaptura: null,
        confirmadaPor: null,
        fechaConfirmacion: null,
      },
    ]);
    expect(repo.transiciones.map((t) => t.estado)).toEqual([
      'EN_ESPERA_CONTADOR',
      'EN_COMPARACION',
      'CONFLICTOS_PENDIENTES',
    ]);
  });

  it('usa puedeTransicionar: si el evento ya no admite la transicion, devuelve TRANSICION_INVALIDA', async () => {
    const { evento, sesionVendedor } = await sembrarEvento(repo, {
      estado: 'LISTA_PARA_ENVIAR',
    });

    const resultado = await useCase.ejecutar(
      sesionVendedor.id,
      'vendedor-1',
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'TRANSICION_INVALIDA' });
    // La maquina de estados nunca permite volver a EN_ESPERA_CONTADOR desde
    // LISTA_PARA_ENVIAR: la unica transicion registrada es la de la siembra.
    expect(repo.transiciones).toEqual([
      { eventoId: evento.id, estado: 'LISTA_PARA_ENVIAR' },
    ]);
  });
});

import type { TipoCarga } from '../api/cargas';
import type {
  CargaHistorialApi,
  DetalleHistorialApi,
  EstadoCargaApi,
  ProductoConsolidadoApi,
} from '../api/historial';
import { modalidadDesdeApi, type ProductoConteo } from '../conteo/estado-conteo.ts';
import { diaDesdeApi } from '../conteo/fecha-operativa.ts';

/**
 * Lo que las pantallas de historial muestran, ya validado: la respuesta del
 * servidor se lee a la defensiva para que un campo raro no rompa la lista.
 */

/** El color comunica estado (docs/06 §1): verde listo, ámbar atención, rojo falla, gris en espera. */
export type TonoEstado = 'exito' | 'atencion' | 'error' | 'neutro';

export const ESTADOS_CARGA: Record<EstadoCargaApi, { etiqueta: string; tono: TonoEstado }> = {
  BORRADOR: { etiqueta: 'Contando', tono: 'neutro' },
  EN_ESPERA_CONTADOR: { etiqueta: 'Espera verificación', tono: 'neutro' },
  BLOQUEADA_CORTE_PENDIENTE: { etiqueta: 'Bloqueada: corte pendiente', tono: 'atencion' },
  EN_COMPARACION: { etiqueta: 'En verificación', tono: 'neutro' },
  CONFLICTOS_PENDIENTES: { etiqueta: 'Discrepancias por resolver', tono: 'atencion' },
  EN_ESPERA_AUTORIZACION: { etiqueta: 'Espera autorización', tono: 'atencion' },
  LISTA_PARA_ENVIAR: { etiqueta: 'Lista para enviar', tono: 'exito' },
  ENVIADA: { etiqueta: 'Enviada a Handy', tono: 'exito' },
  ERROR_ENVIO: { etiqueta: 'Error al enviar', tono: 'error' },
  ENVIO_INCIERTO: { etiqueta: 'Envío sin confirmar', tono: 'atencion' },
};

export function estadoDeCarga(estado: EstadoCargaApi | null): { etiqueta: string; tono: TonoEstado } {
  return (estado && ESTADOS_CARGA[estado]) || { etiqueta: 'Estado desconocido', tono: 'neutro' };
}

const texto = (valor: string | null | undefined): string | null => valor?.trim() || null;
const entero = (valor: unknown): number | null =>
  typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 ? valor : null;

// ---------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------

export interface FilaHistorial {
  id: string;
  rutaNombre: string;
  tipo: TipoCarga | null;
  estado: EstadoCargaApi | null;
  /** `aaaa-mm-dd`; `null` si el servidor no la mandó bien. */
  dia: string | null;
  vendedorNombre: string | null;
  contadorNombre: string | null;
  totalProductos: number | null;
  /** Productos que tuvieron discrepancia, resuelta o no. */
  discrepancias: number;
}

export interface GrupoDia {
  dia: string | null;
  data: FilaHistorial[];
}

/** `null` si la fila no trae una carga identificable. */
export function normalizarFila(fila: CargaHistorialApi): FilaHistorial | null {
  const id = texto(fila.id);
  if (!id) return null;
  return {
    id,
    rutaNombre: texto(fila.rutaNombre) ?? 'Ruta sin nombre',
    tipo: fila.tipo,
    estado: fila.estado,
    dia: diaDesdeApi(fila.fechaOperativa),
    vendedorNombre: texto(fila.vendedorNombre),
    contadorNombre: texto(fila.contadorNombre),
    totalProductos: entero(fila.totalProductos),
    discrepancias: entero(fila.productosConDiscrepancia) ?? 0,
  };
}

/**
 * Une las páginas y agrupa por fecha operativa, del día más reciente al más
 * viejo. Una carga creada mientras se pagina recorre las filas y puede llegar
 * repetida en la página siguiente: cuenta una sola vez. Dentro del día se
 * respeta el orden del servidor.
 */
export function agruparPorDia(paginas: readonly (readonly CargaHistorialApi[])[]): GrupoDia[] {
  const vistas = new Set<string>();
  const grupos = new Map<string | null, FilaHistorial[]>();
  for (const pagina of paginas) {
    for (const api of pagina) {
      const fila = normalizarFila(api);
      if (!fila || vistas.has(fila.id)) continue;
      vistas.add(fila.id);
      const grupo = grupos.get(fila.dia);
      if (grupo) grupo.push(fila);
      else grupos.set(fila.dia, [fila]);
    }
  }
  // aaaa-mm-dd se ordena bien como texto. Sin fecha, al final.
  return [...grupos.entries()]
    .sort(([a], [b]) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? 1 : -1))
    .map(([dia, data]) => ({ dia, data }));
}

// ---------------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------------

export interface DiscrepanciaDetalle {
  /** Primer conteo (vendedor), en piezas. */
  vendedor: number | null;
  /** Segundo conteo (contador), en piezas. */
  contador: number | null;
  capturadaPor: string | null;
  confirmadaPor: string | null;
}

/**
 * Con la forma de `ProductoConteo`: el factor se muestra y se usa igual que al
 * contar (`factorEfectivo`, `EtiquetaFactor`).
 */
export interface ProductoDetalle extends ProductoConteo {
  /** Piezas. `null` si hubo discrepancia y aún nadie captura la final. */
  cantidadFinal: number | null;
  discrepancia: DiscrepanciaDetalle | null;
}

export interface FamiliaDetalle {
  familia: string;
  productos: ProductoDetalle[];
  conDiscrepancia: number;
}

export interface EventoDetalle {
  id: string;
  rutaNombre: string;
  tipo: TipoCarga | null;
  estado: EstadoCargaApi | null;
  dia: string | null;
  vendedorNombre: string | null;
  contadorNombre: string | null;
  autorizadaPorNombre: string | null;
}

export interface CargaDetalle {
  evento: EventoDetalle;
  familias: FamiliaDetalle[];
  totalProductos: number;
  totalDiscrepancias: number;
  /** Suma de las cantidades finales, en piezas: lo que se sube al camión. */
  totalPiezas: number;
  /** Productos con discrepancia aún sin cantidad final: no entran en `totalPiezas`. */
  sinResolver: number;
}

function normalizarProducto(p: ProductoConsolidadoApi): ProductoDetalle | null {
  const code = texto(p.productoCode);
  if (!code) return null;
  return {
    code,
    nombre: texto(p.nombre) ?? code,
    familia: texto(p.familia),
    unidadDescripcion: texto(p.unidadDescripcion) ?? '',
    modalidadVenta: modalidadDesdeApi(p.modalidadVenta),
    piezasPorPaquete: typeof p.piezasPorPaquete === 'number' ? p.piezasPorPaquete : null,
    factorConfirmado: p.factorConfirmado === true,
    cantidadFinal: entero(p.cantidadFinal),
    discrepancia:
      p.tuvoDiscrepancia === true
        ? {
            vendedor: entero(p.cantidadVendedor),
            contador: entero(p.cantidadContador),
            capturadaPor: texto(p.capturadaPorNombre),
            confirmadaPor: texto(p.confirmadaPorNombre),
          }
        : null,
  };
}

/** `null` si la respuesta no trae una carga identificable. */
export function normalizarDetalle(api: DetalleHistorialApi | null): CargaDetalle | null {
  const evento = api?.evento;
  const id = texto(evento?.id);
  if (!evento || !id) return null;

  const familias: FamiliaDetalle[] = [];
  let totalProductos = 0;
  let totalDiscrepancias = 0;
  let totalPiezas = 0;
  let sinResolver = 0;
  for (const grupo of api.familias ?? []) {
    const productos = (grupo.productos ?? []).map(normalizarProducto).filter((p): p is ProductoDetalle => p !== null);
    if (productos.length === 0) continue;
    const conDiscrepancia = productos.filter((p) => p.discrepancia !== null).length;
    familias.push({ familia: texto(grupo.familia) ?? 'Sin familia', productos, conDiscrepancia });
    totalProductos += productos.length;
    totalDiscrepancias += conDiscrepancia;
    for (const p of productos) {
      if (p.cantidadFinal === null) sinResolver += 1;
      else totalPiezas += p.cantidadFinal;
    }
  }

  return {
    evento: {
      id,
      rutaNombre: texto(evento.rutaNombre) ?? 'Ruta sin nombre',
      tipo: evento.tipo,
      estado: evento.estado,
      dia: diaDesdeApi(evento.fechaOperativa),
      vendedorNombre: texto(evento.vendedorNombre),
      contadorNombre: texto(evento.contadorNombre),
      autorizadaPorNombre: texto(evento.autorizadaPorNombre),
    },
    familias,
    totalProductos,
    totalDiscrepancias,
    totalPiezas,
    sinResolver,
  };
}

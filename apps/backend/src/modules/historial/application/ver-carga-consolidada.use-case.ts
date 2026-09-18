import type {
  EventoConsolidado,
  HistorialRepository,
  ProductoConsolidado,
} from './historial.repository';

/**
 * Caso de uso: arma la vista de detalle de una carga para el supervisor
 * (RF-23, docs/04 `GET /historial/:id`).
 *
 * El puerto devuelve los productos en una lista plana; agruparlos por familia
 * (Dulces, Cigarros, Bebidas, etc.) es responsabilidad de este caso de uso, no
 * de la persistencia: es asi como el supervisor la compara contra lo que ve
 * fisicamente al subirse al camion, no por como se guarda en la base de datos.
 * Dentro de cada familia los productos quedan ordenados por nombre; las
 * familias, alfabeticamente (un producto sin familia asignada en el catalogo
 * cae en el grupo "Sin familia").
 *
 * No hay restriccion de acceso por si la carga tuvo o no discrepancia
 * (CLAUDE.md, docs/01 seccion 6 regla 4): cualquier carga con `EventoCarga`
 * existente se puede consultar aca con el mismo nivel de detalle.
 */

const SIN_FAMILIA = 'Sin familia';

export interface FamiliaConsolidada {
  familia: string;
  productos: ProductoConsolidado[];
}

export type ResultadoVerCargaConsolidada =
  | { exito: true; evento: EventoConsolidado; familias: FamiliaConsolidada[] }
  | { exito: false; motivo: 'CARGA_NO_ENCONTRADA' };

export class VerCargaConsolidadaUseCase {
  constructor(private readonly historial: HistorialRepository) {}

  async ejecutar(eventoId: string): Promise<ResultadoVerCargaConsolidada> {
    const consolidada = await this.historial.obtenerCargaConsolidada(eventoId);
    if (consolidada === null) {
      return { exito: false, motivo: 'CARGA_NO_ENCONTRADA' };
    }

    return {
      exito: true,
      evento: consolidada.evento,
      familias: this.agruparPorFamilia(consolidada.productos),
    };
  }

  private agruparPorFamilia(
    productos: ProductoConsolidado[],
  ): FamiliaConsolidada[] {
    const grupos = new Map<string, ProductoConsolidado[]>();
    for (const producto of productos) {
      const familia = producto.familia ?? SIN_FAMILIA;
      const lista = grupos.get(familia);
      if (lista) {
        lista.push(producto);
      } else {
        grupos.set(familia, [producto]);
      }
    }

    return [...grupos.entries()]
      .map(([familia, productosDeFamilia]) => ({
        familia,
        productos: [...productosDeFamilia].sort((a, b) =>
          a.nombre.localeCompare(b.nombre),
        ),
      }))
      .sort((a, b) => a.familia.localeCompare(b.familia));
  }
}

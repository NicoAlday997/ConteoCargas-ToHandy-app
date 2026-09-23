import type { CargaRepository } from './carga.repository';
import type {
  ProductoConteoRepository,
  ProductoDeConteo,
} from './producto-conteo.repository';

/**
 * Caso de uso: productos que la app muestra en el grid de conteo de un evento
 * (`GET /eventos-carga/:id/productos`).
 *
 * Usa la plantilla SNAPSHOT del evento (la vigente al iniciar la carga), no la
 * asignacion actual de la ruta. Si el evento no tiene plantilla, devuelve todo
 * el catalogo activo.
 *
 * Orden operativo: agrupados por familia (el contador recorre el camion por
 * familia) y, dentro de cada familia, por nombre. Muchos productos son la
 * misma marca en distintas presentaciones (BIG COLA 1.5L, 2L, 3L): el orden
 * alfabetico —con comparacion numerica— los deja juntos y en orden de tamano.
 * Las familias van en orden alfabetico; los productos sin familia, al final.
 *
 * Capa de aplicacion: solo depende de los puertos.
 */

export interface GrupoFamilia {
  /** `null` agrupa los productos sin familia en el catalogo. */
  familia: string | null;
  productos: ProductoDeConteo[];
}

export type ResultadoListarProductosDePlantilla =
  | { exito: true; plantillaId: string | null; familias: GrupoFamilia[] }
  | { exito: false; motivo: 'EVENTO_NO_ENCONTRADO' };

const comparador = new Intl.Collator('es', {
  sensitivity: 'base',
  numeric: true,
});

/** Familias en orden alfabetico, `null` (sin familia) al final. */
function compararFamilias(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return comparador.compare(a, b);
}

export class ListarProductosDePlantillaUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly productos: ProductoConteoRepository,
  ) {}

  async ejecutar(entrada: {
    eventoId: string;
  }): Promise<ResultadoListarProductosDePlantilla> {
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento === null) {
      return { exito: false, motivo: 'EVENTO_NO_ENCONTRADO' };
    }

    const productos = await this.productos.listarActivos(evento.plantillaId);

    const porFamilia = new Map<string | null, ProductoDeConteo[]>();
    for (const producto of productos) {
      const grupo = porFamilia.get(producto.familia);
      if (grupo === undefined) {
        porFamilia.set(producto.familia, [producto]);
      } else {
        grupo.push(producto);
      }
    }

    const familias: GrupoFamilia[] = [...porFamilia.entries()]
      .sort(([a], [b]) => compararFamilias(a, b))
      .map(([familia, grupo]) => ({
        familia,
        productos: grupo.sort(
          (a, b) =>
            comparador.compare(a.nombre, b.nombre) ||
            comparador.compare(a.code, b.code),
        ),
      }));

    return { exito: true, plantillaId: evento.plantillaId, familias };
  }
}

/**
 * Reglas de la administracion de plantillas de carga. Funciones puras: sin
 * Prisma, sin HTTP, sin NestJS.
 *
 * Una plantilla decide que productos ve el vendedor en su grid de conteo: si
 * un producto no esta en la plantilla de su ruta, el vendedor nunca lo cuenta.
 */

export type MotivoRechazoDesactivacion = 'PLANTILLA_EN_USO';

export type ResultadoDesactivacion =
  | { permitido: true }
  | { permitido: false; motivo: MotivoRechazoDesactivacion };

/**
 * Una plantilla asignada a alguna ruta vigente no se desactiva: el vendedor de
 * esa ruta se quedaria con una plantilla que ya no se administra. Primero se
 * asigna otra plantilla a esas rutas.
 */
export function puedeDesactivar(rutasVigentes: number): ResultadoDesactivacion {
  if (rutasVigentes > 0) {
    return { permitido: false, motivo: 'PLANTILLA_EN_USO' };
  }
  return { permitido: true };
}

/** Codigos sin espacios en los extremos, sin vacios y sin repetidos, en el orden recibido. */
export function normalizarCodigos(codes: readonly string[]): string[] {
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const code of codes) {
    const limpio = code.trim();
    if (limpio === '' || vistos.has(limpio)) continue;
    vistos.add(limpio);
    resultado.push(limpio);
  }
  return resultado;
}

/**
 * Clave para comparar nombres de plantilla: sin mayusculas, acentos ni
 * espacios repetidos. "Dulces  y Abarrotes" y "dulces y abarrotes" chocan.
 */
export function claveNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface GrupoFamilia<T> {
  /** `null` agrupa los productos sin familia en el catalogo. */
  familia: string | null;
  productos: T[];
}

const comparador = new Intl.Collator('es', {
  sensitivity: 'base',
  numeric: true,
});

/**
 * Agrupa por familia en el mismo orden que el grid de conteo: familias en
 * orden alfabetico (sin familia al final) y, dentro, por nombre con
 * comparacion numerica (BIG COLA 2L antes que 10L).
 */
export function agruparPorFamilia<
  T extends { code: string; nombre: string; familia: string | null },
>(productos: readonly T[]): GrupoFamilia<T>[] {
  const porFamilia = new Map<string | null, T[]>();
  for (const producto of productos) {
    const grupo = porFamilia.get(producto.familia);
    if (grupo === undefined) porFamilia.set(producto.familia, [producto]);
    else grupo.push(producto);
  }
  return [...porFamilia.entries()]
    .sort(([a], [b]) => {
      if (a === b) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return comparador.compare(a, b);
    })
    .map(([familia, grupo]) => ({
      familia,
      productos: [...grupo].sort(
        (a, b) =>
          comparador.compare(a.nombre, b.nombre) ||
          comparador.compare(a.code, b.code),
      ),
    }));
}

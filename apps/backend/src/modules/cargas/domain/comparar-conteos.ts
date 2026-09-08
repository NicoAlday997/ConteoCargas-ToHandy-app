/**
 * Comparacion de conteos fisicos. Es la logica que detecta discrepancias entre
 * dos conteos independientes de la misma carga (RF-14, RF-15). Funciones puras:
 * sin Prisma, sin HTTP, sin NestJS, sin `new Date()` ni nada del entorno.
 *
 * El "primer" y el "segundo" conteo son neutrales e intercambiables. Hoy, en
 * autoventa, corresponden al conteo del vendedor y al del contador; cuando el
 * negocio migre a preventa seran el del bodeguero y el del repartidor. Esta
 * funcion no asume quien es quien ni en que orden llegan.
 *
 * Tercer parametro `esperado` (opcional): en preventa existe una cantidad
 * esperada por producto — la suma de los pedidos levantados. Cuando se pasa:
 *   - cada discrepancia incluye `cantidadEsperada`;
 *   - se detecta ademas el caso en que los dos conteos coinciden entre si pero
 *     difieren de lo esperado. Eso no es un error de conteo de una persona: es
 *     un faltante (o sobrante) de bodega. Se reporta igual como discrepancia
 *     porque necesita resolucion, solo que de otra naturaleza.
 * En autoventa `esperado` va `undefined` y la funcion compara unicamente los
 * dos conteos entre si. Un `esperado` `[]` NO es lo mismo que `undefined`:
 * activa el modo preventa con cantidad esperada 0 para todo producto.
 */

export interface ItemConteo {
  productoCode: string;
  cantidad: number;
}

export interface Discrepancia {
  productoCode: string;
  /** Cantidad del primer conteo (0 si el producto no aparece en el). */
  cantidadA: number;
  /** Cantidad del segundo conteo (0 si el producto no aparece en el). */
  cantidadB: number;
  /** Solo presente cuando se comparo contra una cantidad esperada (preventa). */
  cantidadEsperada?: number;
}

export interface ResultadoComparacion {
  coinciden: boolean;
  discrepancias: Discrepancia[];
  /** Union de codigos de producto de todos los conteos recibidos. */
  totalProductos: number;
}

/**
 * Indexa un conteo como `productoCode -> cantidad` sin mutar el arreglo de
 * entrada. Un mismo producto en varias lineas del conteo se acumula. Valida
 * cada item: la cantidad debe ser un numero finito no negativo y el
 * `productoCode` una cadena no vacia.
 */
function indexar(conteo: ItemConteo[], nombre: string): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const item of conteo) {
    if (typeof item?.productoCode !== 'string' || item.productoCode.length === 0) {
      throw new TypeError(
        `compararConteos: ${nombre} tiene un item con productoCode invalido: ${JSON.stringify(item)}`,
      );
    }
    if (!Number.isFinite(item.cantidad) || item.cantidad < 0) {
      throw new TypeError(
        `compararConteos: ${nombre} tiene una cantidad invalida para ${item.productoCode}: ${item.cantidad}`,
      );
    }
    mapa.set(item.productoCode, (mapa.get(item.productoCode) ?? 0) + item.cantidad);
  }
  return mapa;
}

/**
 * Compara dos conteos de la misma carga y, opcionalmente, una cantidad
 * esperada por producto. No muta los arreglos recibidos.
 *
 * @param primerConteo  primer conteo independiente (vendedor / bodeguero).
 * @param segundoConteo segundo conteo independiente (contador / repartidor).
 * @param esperado       cantidad esperada por producto (preventa). `undefined`
 *                       => se comparan solo los dos conteos entre si.
 */
export function compararConteos(
  primerConteo: ItemConteo[],
  segundoConteo: ItemConteo[],
  esperado?: ItemConteo[],
): ResultadoComparacion {
  const mapaA = indexar(primerConteo, 'el primer conteo');
  const mapaB = indexar(segundoConteo, 'el segundo conteo');
  const mapaEsperado = esperado ? indexar(esperado, 'el esperado') : undefined;

  // Union de codigos preservando el orden de primera aparicion:
  // primero los del primer conteo, luego los nuevos del segundo, luego los
  // nuevos del esperado.
  const codigos: string[] = [];
  const vistos = new Set<string>();
  for (const code of [
    ...mapaA.keys(),
    ...mapaB.keys(),
    ...(mapaEsperado?.keys() ?? []),
  ]) {
    if (!vistos.has(code)) {
      vistos.add(code);
      codigos.push(code);
    }
  }

  const discrepancias: Discrepancia[] = [];
  for (const productoCode of codigos) {
    const cantidadA = mapaA.get(productoCode) ?? 0;
    const cantidadB = mapaB.get(productoCode) ?? 0;

    if (mapaEsperado === undefined) {
      // Autoventa: solo comparamos los dos conteos entre si.
      if (cantidadA !== cantidadB) {
        discrepancias.push({ productoCode, cantidadA, cantidadB });
      }
      continue;
    }

    // Preventa: hay discrepancia si los tres valores no son iguales. Esto cubre
    // tanto el desacuerdo entre personas (A !== B) como el faltante/sobrante de
    // bodega (A === B pero difieren de lo esperado).
    const cantidadEsperada = mapaEsperado.get(productoCode) ?? 0;
    if (cantidadA !== cantidadB || cantidadA !== cantidadEsperada) {
      discrepancias.push({ productoCode, cantidadA, cantidadB, cantidadEsperada });
    }
  }

  return {
    coinciden: discrepancias.length === 0,
    discrepancias,
    totalProductos: codigos.length,
  };
}

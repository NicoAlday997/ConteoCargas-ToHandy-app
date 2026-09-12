import { puedeTransicionar, requiereAutorizacion } from '../domain/estados-carga';
import type { CargaRepository, EventoCarga } from './carga.repository';

/**
 * Caso de uso: el supervisor rechaza productos puntuales durante la
 * autorizacion (CLAUDE.md: "si el supervisor detecta un error, NO se devuelve
 * la carga completa a recontar: se marcan solo los productos especificos").
 * Recontar toda la carga por un solo producto mal convertiria el sistema en un
 * castigo y la gente evitaria reportar errores — por eso esto SOLO reabre los
 * productos senalados, no la carga entera.
 *
 * Cada producto rechazado vuelve a quedar SIN resolver (aunque ya tuviera una
 * discrepancia capturada y confirmada antes de llegar a autorizacion): alguien
 * debe volver a capturar su cantidad final y una persona DISTINTA confirmarla
 * con su propio PIN, exactamente como cualquier otra discrepancia. Eso lo
 * garantiza `CargaRepository.reabrirDiscrepancia`, que siempre limpia
 * `confirmadaPor`.
 *
 * El motivo que da el supervisor por producto es informativo para quien
 * invoque este caso de uso (p. ej. para una alerta o bitacora); el modelo de
 * `DiscrepanciaResuelta` no tiene hoy una columna para guardarlo.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos, nunca de
 * infraestructura (Prisma, HTTP, NestJS).
 */

export interface ProductoRechazado {
  productoCode: string;
  /** Motivo del supervisor para rechazar este producto puntual. */
  motivo: string;
}

/** Datos que el controlador extrae del request y del JWT. */
export interface EntradaRechazarProductos {
  eventoId: string;
  /** Id del supervisor que rechaza (viaja en el JWT). */
  usuarioAppId: string;
  productosRechazados: ProductoRechazado[];
}

/**
 * Resultado como union discriminada por `exito`.
 *
 * En exito, `productosPendientes` es el total de discrepancias del evento que
 * quedaron sin `cantidadFinal` tras el rechazo (incluye los productos recien
 * reabiertos; en la practica, en `EN_ESPERA_AUTORIZACION` no puede haber otras
 * discrepancias sin resolver, asi que hoy coincide con
 * `productosRechazados.length`, pero se recalcula por si eso cambia).
 *
 * Motivos de rechazo:
 * - `ESTADO_INVALIDO`: el evento no existe o no esta en `EN_ESPERA_AUTORIZACION`.
 * - `SIN_PRODUCTOS`: el arreglo de productos rechazados vino vacio.
 * - `PRODUCTO_NO_ENCONTRADO`: algun `productoCode` no forma parte de esta
 *   carga (no aparece en ninguno de los dos conteos cerrados). Se valida TODO
 *   el arreglo antes de reabrir nada: o se aplican todos los rechazos, o
 *   ninguno.
 */
export type ResultadoRechazarProductos =
  | { exito: true; evento: EventoCarga; productosPendientes: number }
  | {
      exito: false;
      motivo: 'ESTADO_INVALIDO' | 'SIN_PRODUCTOS' | 'PRODUCTO_NO_ENCONTRADO';
    };

export class RechazarProductosUseCase {
  constructor(private readonly cargas: CargaRepository) {}

  async ejecutar(
    entrada: EntradaRechazarProductos,
    ahora: Date,
  ): Promise<ResultadoRechazarProductos> {
    // 1. El evento debe existir y estar en EN_ESPERA_AUTORIZACION.
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento === null || !requiereAutorizacion(evento.estado)) {
      return { exito: false, motivo: 'ESTADO_INVALIDO' };
    }

    // 2. El arreglo no puede venir vacio.
    if (entrada.productosRechazados.length === 0) {
      return { exito: false, motivo: 'SIN_PRODUCTOS' };
    }

    // 3. Cada productoCode debe pertenecer a esta carga. Se valida TODO el
    //    arreglo antes de tocar la persistencia.
    const cantidadesActuales = await this.cantidadesActuales(entrada.eventoId);
    for (const producto of entrada.productosRechazados) {
      if (!cantidadesActuales.has(producto.productoCode)) {
        return { exito: false, motivo: 'PRODUCTO_NO_ENCONTRADO' };
      }
    }

    // 4. Reabrir (o crear) la discrepancia de cada producto rechazado con la
    //    cantidad actualmente acordada en ambos lados y sin resolucion.
    for (const producto of entrada.productosRechazados) {
      await this.cargas.reabrirDiscrepancia(entrada.eventoId, {
        productoCode: producto.productoCode,
        cantidadVendedorOriginal: cantidadesActuales.get(producto.productoCode)!,
        cantidadContadorOriginal: cantidadesActuales.get(producto.productoCode)!,
      });
    }

    // 5. Transicionar; la maquina de estados del dominio decide.
    if (!puedeTransicionar(evento.estado, 'CONFLICTOS_PENDIENTES')) {
      // Inalcanzable mientras EN_ESPERA_AUTORIZACION -> CONFLICTOS_PENDIENTES
      // siga declarada en el dominio; guardarrail defensivo.
      throw new Error(
        `RechazarProductosUseCase: transicion invalida ${evento.estado} -> CONFLICTOS_PENDIENTES`,
      );
    }
    const actualizado = await this.cargas.cambiarEstado(
      entrada.eventoId,
      'CONFLICTOS_PENDIENTES',
    );

    const discrepancias = await this.cargas.listarDiscrepancias(entrada.eventoId);
    const productosPendientes = discrepancias.filter(
      (d) => d.cantidadFinal === null,
    ).length;

    return { exito: true, evento: actualizado, productosPendientes };
  }

  /**
   * Cantidad actualmente acordada por producto: la `cantidadFinal` de su
   * discrepancia resuelta si la tuvo, o la cantidad de los conteos cerrados
   * (vendedor/segundo conteo, que coinciden si nunca hubo discrepancia). Mismo
   * criterio que `EnviarCargaUseCase.construirProductos`.
   */
  private async cantidadesActuales(
    eventoId: string,
  ): Promise<Map<string, number>> {
    const cantidades = new Map<string, number>();
    for (const sesion of await this.cargas.listarSesionesDeEvento(eventoId)) {
      if (sesion.estado !== 'CERRADA') {
        continue;
      }
      for (const item of await this.cargas.listarItemsDeSesion(sesion.id)) {
        if (!cantidades.has(item.productoCode)) {
          cantidades.set(item.productoCode, item.cantidad);
        }
      }
    }
    for (const d of await this.cargas.listarDiscrepancias(eventoId)) {
      if (d.cantidadFinal !== null) {
        cantidades.set(d.productoCode, d.cantidadFinal);
      }
    }
    return cantidades;
  }
}

import { puedeTransicionar, requiereAutorizacion } from '../domain/estados-carga';
import type { CargaRepository, Discrepancia, EventoCarga } from './carga.repository';

/**
 * Caso de uso: el supervisor modifica la cantidad de un producto durante la
 * autorizacion (p. ej. subir de 14 a 16 porque hay que cargar mas) (CLAUDE.md:
 * "esa modificacion NO puede quedar solo con su palabra: requiere la misma
 * confirmacion cruzada que cualquier discrepancia. Nadie, ni el supervisor,
 * cambia una cantidad sin que dos personas lo respalden").
 *
 * Por eso este caso de uso NO marca la cantidad como resuelta: crea (o
 * reabre) una discrepancia con la cantidad nueva propuesta por el supervisor
 * ya CAPTURADA (`capturadaPorId` = el supervisor), pero sin confirmar. El
 * vendedor o el contador tienen que confirmarla despues con su propio PIN vía
 * `ConfirmarCantidadFinalUseCase`, y la regla de autoconfirmacion del dominio
 * (`confirmarCantidadFinal`) sigue aplicando tal cual: el supervisor no puede
 * confirmar su propia modificacion.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos, nunca de
 * infraestructura (Prisma, HTTP, NestJS).
 */

/** Datos que el controlador extrae del request y del JWT. */
export interface EntradaModificarCantidadSupervisor {
  eventoId: string;
  productoCode: string;
  cantidadNueva: number;
  /** Id del supervisor que propone la cantidad nueva (viaja en el JWT). */
  usuarioAppId: string;
  /** Motivo de la modificacion (p. ej. "hay que cargar mas para la ruta"). */
  motivo: string;
}

/**
 * Resultado como union discriminada por `exito`.
 *
 * En exito, la discrepancia devuelta tiene `cantidadFinal` y `capturadaPor`
 * puestos, pero `confirmadaPor` en `null`: falta la confirmacion cruzada.
 *
 * Motivos de rechazo:
 * - `ESTADO_INVALIDO`: el evento no existe o no esta en `EN_ESPERA_AUTORIZACION`.
 * - `CANTIDAD_INVALIDA`: `cantidadNueva` no es un entero >= 0.
 * - `PRODUCTO_NO_ENCONTRADO`: el `productoCode` no forma parte de esta carga
 *   (no aparece en ninguno de los dos conteos cerrados).
 */
export type ResultadoModificarCantidadSupervisor =
  | { exito: true; evento: EventoCarga; discrepancia: Discrepancia }
  | {
      exito: false;
      motivo: 'ESTADO_INVALIDO' | 'CANTIDAD_INVALIDA' | 'PRODUCTO_NO_ENCONTRADO';
    };

export class ModificarCantidadSupervisorUseCase {
  constructor(private readonly cargas: CargaRepository) {}

  async ejecutar(
    entrada: EntradaModificarCantidadSupervisor,
    ahora: Date,
  ): Promise<ResultadoModificarCantidadSupervisor> {
    // 1. El evento debe existir y estar en EN_ESPERA_AUTORIZACION.
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento === null || !requiereAutorizacion(evento.estado)) {
      return { exito: false, motivo: 'ESTADO_INVALIDO' };
    }

    // 2. La cantidad nueva debe ser un entero >= 0 (incluye negativos,
    //    decimales, NaN e Infinity).
    if (
      !Number.isInteger(entrada.cantidadNueva) ||
      entrada.cantidadNueva < 0
    ) {
      return { exito: false, motivo: 'CANTIDAD_INVALIDA' };
    }

    // 3. El producto debe pertenecer a esta carga.
    const cantidadesActuales = await this.cantidadesActuales(entrada.eventoId);
    const cantidadActual = cantidadesActuales.get(entrada.productoCode);
    if (cantidadActual === undefined) {
      return { exito: false, motivo: 'PRODUCTO_NO_ENCONTRADO' };
    }

    // 4. Reabrir (o crear) la discrepancia: cantidad actual en ambos lados
    //    "originales", cantidadFinal = la propuesta del supervisor, capturada
    //    por el supervisor, SIN confirmar.
    const discrepancia = await this.cargas.reabrirDiscrepancia(
      entrada.eventoId,
      {
        productoCode: entrada.productoCode,
        cantidadVendedorOriginal: cantidadActual,
        cantidadContadorOriginal: cantidadActual,
        cantidadFinal: entrada.cantidadNueva,
        capturadaPor: entrada.usuarioAppId,
        fechaCaptura: ahora,
      },
    );

    // 5. Transicionar; la maquina de estados del dominio decide.
    if (!puedeTransicionar(evento.estado, 'CONFLICTOS_PENDIENTES')) {
      // Inalcanzable mientras EN_ESPERA_AUTORIZACION -> CONFLICTOS_PENDIENTES
      // siga declarada en el dominio; guardarrail defensivo.
      throw new Error(
        `ModificarCantidadSupervisorUseCase: transicion invalida ${evento.estado} -> CONFLICTOS_PENDIENTES`,
      );
    }
    const actualizado = await this.cargas.cambiarEstado(
      entrada.eventoId,
      'CONFLICTOS_PENDIENTES',
    );

    return { exito: true, evento: actualizado, discrepancia };
  }

  /**
   * Cantidad actualmente acordada por producto: la `cantidadFinal` de su
   * discrepancia resuelta si la tuvo, o la cantidad de los conteos cerrados
   * (vendedor/segundo conteo, que coinciden si nunca hubo discrepancia). Mismo
   * criterio que `RechazarProductosUseCase`.
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

import {
  capturarCantidadFinal,
  esCantidadAtipica,
  type EstadoDiscrepancia,
} from '../domain/resolver-discrepancia';
import type { CargaRepository, Discrepancia } from './carga.repository';

/**
 * Caso de uso: paso 1 de la resolucion de una discrepancia (RF-15, docs/04
 * `PATCH /eventos-carga/:id/discrepancias/:productoCode`). Una persona captura la
 * cantidad final acordada para un producto en conflicto.
 *
 * Este caso de uso SOLO orquesta: la logica de que es una captura valida vive en
 * `domain/resolver-discrepancia.ts` (`capturarCantidadFinal`). Aca se anaden el
 * guardarrail de estado del evento y la persistencia.
 *
 * La confirmacion cruzada obligatoria (una persona distinta cierra la captura con
 * su propio PIN) es responsabilidad de `ConfirmarCantidadFinalUseCase`; aca solo
 * se registra quien capturo.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos, nunca de
 * infraestructura (Prisma, HTTP, NestJS).
 */

/** Datos que el controlador extrae del request y del JWT. */
export interface EntradaCapturarCantidadFinal {
  eventoId: string;
  productoCode: string;
  cantidadFinal: number;
  /** Id del usuario de la app que captura la cantidad (viaja en el JWT). */
  usuarioAppId: string;
}

/**
 * Resultado como union discriminada por `exito`.
 *
 * En exito se devuelve la discrepancia ya persistida y `generarAlertaMedia`:
 * `true` cuando la cantidad final no coincide con ninguno de los dos conteos
 * originales (cantidad atipica). Segun `docs/05-estrategia-pruebas.md` ese caso
 * debe disparar una alerta de urgencia media; emitirla es responsabilidad de
 * quien invoca este caso de uso.
 *
 * Motivos de rechazo:
 * - `ESTADO_INVALIDO`: el evento no existe o no esta en `CONFLICTOS_PENDIENTES`.
 *   Solo se captura sobre un evento con conflictos abiertos.
 * - `DISCREPANCIA_NO_ENCONTRADA`: el evento no tiene una discrepancia para ese
 *   `productoCode`.
 * - `CANTIDAD_INVALIDA`: `cantidadFinal` no es un entero >= 0 (lo decide el
 *   dominio).
 * - `YA_CONFIRMADA`: la discrepancia ya quedo confirmada; recapturar obligaria a
 *   una segunda confirmacion que se perderia (lo decide el dominio).
 */
export type ResultadoCapturarCantidadFinal =
  | { exito: true; discrepancia: Discrepancia; generarAlertaMedia: boolean }
  | {
      exito: false;
      motivo:
        | 'ESTADO_INVALIDO'
        | 'DISCREPANCIA_NO_ENCONTRADA'
        | 'CANTIDAD_INVALIDA'
        | 'YA_CONFIRMADA';
    };

/** Traduce la fila persistida al modelo puro del dominio. */
function aEstadoDiscrepancia(d: Discrepancia): EstadoDiscrepancia {
  return {
    productoCode: d.productoCode,
    cantidadPrimerConteo: d.cantidadVendedorOriginal,
    cantidadSegundoConteo: d.cantidadContadorOriginal,
    cantidadFinal: d.cantidadFinal ?? undefined,
    capturadaPorId: d.capturadaPor ?? undefined,
    confirmadaPorId: d.confirmadaPor ?? undefined,
  };
}

export class CapturarCantidadFinalUseCase {
  constructor(private readonly cargas: CargaRepository) {}

  async ejecutar(
    entrada: EntradaCapturarCantidadFinal,
    ahora: Date,
  ): Promise<ResultadoCapturarCantidadFinal> {
    // 1. El evento debe existir y estar en CONFLICTOS_PENDIENTES. Un evento
    //    inexistente cae aca tambien: no hay conflicto que resolver.
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento === null || evento.estado !== 'CONFLICTOS_PENDIENTES') {
      return { exito: false, motivo: 'ESTADO_INVALIDO' };
    }

    // 2. La discrepancia concreta tiene que existir dentro del evento.
    const discrepancias = await this.cargas.listarDiscrepancias(
      entrada.eventoId,
    );
    const discrepancia = discrepancias.find(
      (d) => d.productoCode === entrada.productoCode,
    );
    if (discrepancia === undefined) {
      return { exito: false, motivo: 'DISCREPANCIA_NO_ENCONTRADA' };
    }

    // 3. El dominio decide si la captura es valida. Nada se persiste si rechaza.
    const resolucion = capturarCantidadFinal(
      aEstadoDiscrepancia(discrepancia),
      entrada.cantidadFinal,
      entrada.usuarioAppId,
    );
    if (!resolucion.exito) {
      // `capturarCantidadFinal` solo rechaza por estos dos motivos; el resto de
      // `MotivoRechazo` pertenece al paso de confirmacion.
      if (
        resolucion.motivo === 'CANTIDAD_INVALIDA' ||
        resolucion.motivo === 'YA_CONFIRMADA'
      ) {
        return { exito: false, motivo: resolucion.motivo };
      }
      throw new Error(
        `capturarCantidadFinal devolvio un motivo inesperado: ${resolucion.motivo}`,
      );
    }

    // 4. Persistir la captura (paso 1). La confirmacion cruzada va aparte.
    const actualizada = await this.cargas.actualizarDiscrepancia(
      entrada.eventoId,
      entrada.productoCode,
      {
        cantidadFinal: entrada.cantidadFinal,
        capturadaPor: entrada.usuarioAppId,
        fechaCaptura: ahora,
      },
    );

    return {
      exito: true,
      discrepancia: actualizada,
      generarAlertaMedia: esCantidadAtipica(resolucion.estado),
    };
  }
}

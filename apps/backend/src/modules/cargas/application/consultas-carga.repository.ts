/**
 * Puerto de LECTURA del modulo de cargas: las vistas que arma la app para que
 * cada persona encuentre lo que le toca (cola del contador, cargas con
 * conflictos donde participo, discrepancias con nombre de producto y de quien
 * capturo). Va aparte de `CargaRepository` porque son vistas con JOINs a ruta,
 * usuarios y productos, no el agregado que modifican los casos de uso.
 *
 * Capa de aplicacion: describe QUE se necesita, no COMO. El adaptador Prisma
 * vive en `infrastructure/`.
 */

import type { EstadoSesion, TipoCarga, TipoSesion } from '@prisma/client';

import type { Discrepancia } from './carga.repository';
import type { ModalidadVenta } from '../domain/conversion-empaque';

/** Una carga que el vendedor ya conto y espera el segundo conteo. */
export interface CargaPendienteVerificacion {
  id: string;
  rutaNombre: string;
  /** Nombre en la app de quien hizo el primer conteo; `null` si no se encuentra. */
  vendedorNombre: string | null;
  tipo: TipoCarga;
  fechaConteo: Date | null;
  /** Productos que registro el primer conteo (solo el numero, nunca cantidades). */
  totalProductos: number;
  bloqueadaPorCorte: boolean;
  fechaBloqueoCortePendiente: Date | null;
  /** Sesion de segundo conteo ya abierta sobre el evento, si alguien empezo. */
  sesionContador: {
    id: string;
    usuarioAppId: string;
    usuarioNombre: string;
    estado: EstadoSesion;
  } | null;
}

/** Una carga en `CONFLICTOS_PENDIENTES` donde el usuario conto. */
export interface CargaConConflictos {
  id: string;
  rutaNombre: string;
  tipo: TipoCarga;
  fechaConteo: Date | null;
  totalDiscrepancias: number;
  /** Discrepancias ya capturadas y confirmadas por dos personas distintas. */
  resueltas: number;
}

/**
 * Un lado de la discrepancia tal como se conto. La app lo etiqueta por el tipo
 * de sesion (hoy vendedor y contador; en preventa, bodeguero y repartidor),
 * nunca por el nombre de la persona.
 */
export interface LadoDiscrepancia {
  /** Tipo de la sesion que hizo este conteo; `null` si ya no se encuentra. */
  tipoSesion: TipoSesion | null;
  /**
   * Lo que se tecleo en bodega. `null` si la sesion no tiene ese item o sus
   * piezas ya no coinciden con la cantidad original de la discrepancia (una
   * reapertura del supervisor la fija a la cantidad acordada, no a un conteo).
   */
  paquetes: number | null;
  sueltas: number | null;
}

/** Discrepancia con lo que la pantalla de resolucion necesita mostrar. */
export interface DiscrepanciaDetalle extends Discrepancia {
  productoNombre: string;
  /** Nombre de la unidad en Handy: rotula lo que se vende completo. */
  unidadDescripcion: string;
  modalidadVenta: ModalidadVenta;
  piezasPorPaquete: number | null;
  factorConfirmado: boolean;
  capturadaPorNombre: string | null;
  confirmadaPorNombre: string | null;
  primerConteo: LadoDiscrepancia;
  segundoConteo: LadoDiscrepancia;
}

export abstract class ConsultasCargaRepository {
  /**
   * Eventos en `EN_ESPERA_CONTADOR` o `BLOQUEADA_CORTE_PENDIENTE`, del mas
   * antiguo al mas reciente por `fechaConteo`.
   */
  abstract listarPendientesVerificacion(): Promise<
    CargaPendienteVerificacion[]
  >;

  /** Eventos en `CONFLICTOS_PENDIENTES` donde el usuario tiene una sesion. */
  abstract listarConflictosDeParticipante(
    usuarioAppId: string,
  ): Promise<CargaConConflictos[]>;

  /** Discrepancias del evento, ordenadas por nombre de producto. */
  abstract listarDiscrepanciasDetalle(
    eventoId: string,
  ): Promise<DiscrepanciaDetalle[]>;
}

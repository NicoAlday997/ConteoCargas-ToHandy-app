/**
 * Alcance del historial segun el rol. Reglas puras: no conocen Prisma, HTTP ni
 * el reloj del sistema. El unico contacto con `@prisma/client` es el tipo
 * `RolApp`, importado solo como tipo.
 *
 * Decision del dueño del negocio:
 *  - VENDEDOR: solo SUS cargas (las que conto como vendedor), 2 semanas atras.
 *  - CONTADOR: cargas de TODOS los vendedores, 2 semanas atras.
 *  - SUPERVISOR: todo, sin limite de fecha.
 *
 * El alcance lo decide SIEMPRE esta politica a partir del JWT, nunca un
 * parametro del cliente: un vendedor no puede ver el historial de otro
 * cambiando un query param. Los filtros del cliente solo pueden ESTRECHAR el
 * alcance, jamas ampliarlo.
 *
 * Dentro del alcance no hay restriccion por si la carga "cuadro" o no
 * (CLAUDE.md, auditoria pareja).
 */

import type { RolApp } from '@prisma/client';

import { inicioDelDiaNegocio } from '../../sincronizacion/domain/fecha-handy';

/** Dias hacia atras que ven Vendedor y Contador. */
export const DIAS_HISTORIAL_LIMITADO = 14;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export interface AlcanceHistorial {
  /** Solo cargas contadas por este vendedor; `null` = de todos. */
  usuarioAppIdFiltro: string | null;
  /** Fecha operativa minima (inicio de dia de negocio); `null` = sin limite. */
  fechaMinima: Date | null;
}

/** Inicio del dia de negocio de hace `DIAS_HISTORIAL_LIMITADO` dias. */
function haceCatorceDias(ahora: Date): Date {
  return inicioDelDiaNegocio(
    new Date(ahora.getTime() - DIAS_HISTORIAL_LIMITADO * MS_POR_DIA),
  );
}

export function alcanceHistorial(
  rol: RolApp,
  usuarioAppId: string,
  ahora: Date,
): AlcanceHistorial {
  switch (rol) {
    case 'VENDEDOR':
      return { usuarioAppIdFiltro: usuarioAppId, fechaMinima: haceCatorceDias(ahora) };
    case 'CONTADOR':
      return { usuarioAppIdFiltro: null, fechaMinima: haceCatorceDias(ahora) };
    case 'SUPERVISOR':
      return { usuarioAppIdFiltro: null, fechaMinima: null };
  }
}

/** Datos de una carga que decide si entra en un alcance. */
export interface CargaParaAlcance {
  /** Quien hizo el conteo del vendedor; `null` si aun no hay esa sesion. */
  vendedorUsuarioAppId: string | null;
  fechaOperativa: Date;
}

/** Si una carga concreta entra en el alcance (para el detalle de una carga). */
export function cargaDentroDeAlcance(
  alcance: AlcanceHistorial,
  carga: CargaParaAlcance,
): boolean {
  if (
    alcance.usuarioAppIdFiltro !== null &&
    carga.vendedorUsuarioAppId !== alcance.usuarioAppIdFiltro
  ) {
    return false;
  }
  if (
    alcance.fechaMinima !== null &&
    carga.fechaOperativa.getTime() < alcance.fechaMinima.getTime()
  ) {
    return false;
  }
  return true;
}

/**
 * Combina la fecha de inicio que pide el cliente con la minima del alcance: se
 * queda con la mas reciente, asi el cliente nunca puede ir mas atras.
 */
export function fechaInicioEfectiva(
  alcance: AlcanceHistorial,
  fechaInicioCliente: Date | undefined,
): Date | undefined {
  if (alcance.fechaMinima === null) {
    return fechaInicioCliente;
  }
  if (
    fechaInicioCliente === undefined ||
    fechaInicioCliente.getTime() < alcance.fechaMinima.getTime()
  ) {
    return alcance.fechaMinima;
  }
  return fechaInicioCliente;
}

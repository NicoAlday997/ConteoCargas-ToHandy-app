import type { EstadoCarga, RolApp, TipoCarga } from '@prisma/client';

import {
  alcanceHistorial,
  fechaInicioEfectiva,
} from '../domain/politica-historial';
import type {
  FiltrosHistorial,
  HistorialRepository,
  PaginaCargas,
} from './historial.repository';

/**
 * Caso de uso: consulta del historial de cargas con filtros (RF-23, docs/04
 * `GET /historial`), ordenado por fecha operativa.
 *
 * Lo que cada rol puede ver lo decide `alcanceHistorial` a partir de quien
 * pregunta (JWT), nunca de los filtros: el vendedor solo ve sus cargas y,
 * junto con el contador, solo 2 semanas hacia atras. Los filtros del cliente
 * solo estrechan ese alcance.
 *
 * No hay restriccion de acceso por si la carga "cuadro" o no (CLAUDE.md,
 * docs/01 seccion 6 regla 4): `conDiscrepancia` es solo un filtro mas, igual
 * que `rutaId`, `estado` o `tipo` — nunca una condicion que oculte resultados
 * por defecto.
 *
 * Unica normalizacion que aplica antes de tocar el puerto: resolver
 * `page`/`pageSize` a valores validos y acotar `pageSize` a un maximo, para
 * que un valor absurdo del cliente no dispare una consulta sin limite.
 */

const PAGE_POR_DEFECTO = 1;
const TAMANO_PAGINA_POR_DEFECTO = 20;
const TAMANO_PAGINA_MAXIMO = 100;

/** Quien consulta, tal como viene en el JWT. */
export interface SolicitanteHistorial {
  usuarioAppId: string;
  rolApp: RolApp;
}

/**
 * Filtros tal como llegan del controlador: `page`/`pageSize` opcionales.
 * `fechaInicio`/`fechaFin` se aplican sobre la fecha operativa.
 */
export interface EntradaConsultarHistorial {
  rutaId?: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  estado?: EstadoCarga;
  conDiscrepancia?: boolean;
  /** Solo las cargas que arrancaron con la ruta anterior sin liquidar. */
  sinLiquidar?: boolean;
  tipo?: TipoCarga;
  page?: number;
  pageSize?: number;
}

export class ConsultarHistorialUseCase {
  constructor(private readonly historial: HistorialRepository) {}

  async ejecutar(
    solicitante: SolicitanteHistorial,
    entrada: EntradaConsultarHistorial,
    ahora: Date,
  ): Promise<PaginaCargas> {
    const alcance = alcanceHistorial(
      solicitante.rolApp,
      solicitante.usuarioAppId,
      ahora,
    );

    const filtros: FiltrosHistorial = {
      rutaId: entrada.rutaId,
      vendedorUsuarioAppId: alcance.usuarioAppIdFiltro ?? undefined,
      fechaInicio: fechaInicioEfectiva(alcance, entrada.fechaInicio),
      fechaFin: entrada.fechaFin,
      estado: entrada.estado,
      conDiscrepancia: entrada.conDiscrepancia,
      sinLiquidar: entrada.sinLiquidar,
      tipo: entrada.tipo,
      page:
        entrada.page !== undefined && entrada.page > 0
          ? entrada.page
          : PAGE_POR_DEFECTO,
      pageSize:
        entrada.pageSize !== undefined && entrada.pageSize > 0
          ? Math.min(entrada.pageSize, TAMANO_PAGINA_MAXIMO)
          : TAMANO_PAGINA_POR_DEFECTO,
    };

    return this.historial.listarCargas(filtros);
  }
}

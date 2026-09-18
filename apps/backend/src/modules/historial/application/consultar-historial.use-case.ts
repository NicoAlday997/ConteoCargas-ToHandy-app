import type { EstadoCarga, TipoCarga } from '@prisma/client';

import type {
  FiltrosHistorial,
  HistorialRepository,
  PaginaCargas,
} from './historial.repository';

/**
 * Caso de uso: el supervisor consulta el historial de cargas con filtros
 * (RF-23, docs/04 `GET /historial`).
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

/** Filtros tal como llegan del controlador: `page`/`pageSize` opcionales. */
export interface EntradaConsultarHistorial {
  rutaId?: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  estado?: EstadoCarga;
  conDiscrepancia?: boolean;
  tipo?: TipoCarga;
  page?: number;
  pageSize?: number;
}

export class ConsultarHistorialUseCase {
  constructor(private readonly historial: HistorialRepository) {}

  async ejecutar(entrada: EntradaConsultarHistorial): Promise<PaginaCargas> {
    const filtros: FiltrosHistorial = {
      rutaId: entrada.rutaId,
      fechaInicio: entrada.fechaInicio,
      fechaFin: entrada.fechaFin,
      estado: entrada.estado,
      conDiscrepancia: entrada.conDiscrepancia,
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

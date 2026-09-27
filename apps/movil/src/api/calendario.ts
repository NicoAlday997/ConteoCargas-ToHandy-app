import { esDia } from '../conteo/fecha-operativa';
import { peticion } from './cliente';

/**
 * Días no laborables (docs/04, calendario laboral). Solo Supervisor. Los
 * domingos no se guardan: ya están fuera de la semana laboral.
 */

/** 409 al marcar un día que ya estaba marcado. */
export const CODIGO_YA_MARCADO = 'YA_MARCADO';

export interface DiaNoLaborable {
  /** `aaaa-mm-dd`. */
  fecha: string;
  motivo: string;
  creadoPorNombre: string | null;
}

interface DiaNoLaborableApi {
  fecha?: unknown;
  motivo?: unknown;
  creadoPorNombre?: unknown;
}

const base = '/admin/dias-no-laborables';

/** Descarta renglones sin día válido; en orden. */
export function normalizarDiasNoLaborables(filas: readonly DiaNoLaborableApi[] | null | undefined): DiaNoLaborable[] {
  return (filas ?? [])
    .flatMap((f) =>
      esDia(f.fecha)
        ? [
            {
              fecha: f.fecha,
              motivo: typeof f.motivo === 'string' ? f.motivo : '',
              creadoPorNombre: typeof f.creadoPorNombre === 'string' ? f.creadoPorNombre : null,
            },
          ]
        : [],
    )
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

/** De hoy en adelante (el servidor decide qué es hoy). */
export async function listarDiasNoLaborables(): Promise<DiaNoLaborable[]> {
  const respuesta = await peticion<{ dias: DiaNoLaborableApi[] | null } | null>(base);
  return normalizarDiasNoLaborables(respuesta?.dias);
}

export function marcarDiaNoLaborable(fecha: string, motivo: string): Promise<unknown> {
  return peticion(base, { method: 'POST', cuerpo: { fecha, motivo } });
}

export function quitarDiaNoLaborable(fecha: string): Promise<unknown> {
  return peticion(`${base}/${encodeURIComponent(fecha)}`, { method: 'DELETE' });
}

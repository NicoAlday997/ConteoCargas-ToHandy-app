import type { ResultadoSincronizacionApi } from '../api/sincronizacion';
import { diaNegocio, formatearFechaCorta, sumarDias } from '../conteo/fecha-operativa.ts';

/**
 * Textos de la sincronización con Handy: cuándo fue la última, qué trajo y qué
 * falló. Puro (sin React) para poder probarlo.
 */

/** Más de esto sin sincronizar y la fecha se marca: faltarán productos justo cuando el camión espera. */
export const DIAS_CATALOGO_VIEJO = 3;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Hora del negocio (UTC-6 fijo, ver `fecha-operativa.ts`) en 12 h: "5:00 a.m.". */
function horaDoce(instante: Date): string {
  const pared = new Date(instante.getTime() - 6 * 60 * 60 * 1000);
  const horas = pared.getUTCHours();
  const minutos = String(pared.getUTCMinutes()).padStart(2, '0');
  return `${horas % 12 || 12}:${minutos} ${horas < 12 ? 'a.m.' : 'p.m.'}`;
}

export interface UltimaSincronizacion {
  texto: string;
  /** Nunca sincronizado o hace más de 3 días: se muestra en color de aviso. */
  vieja: boolean;
}

/** "Última vez: hoy a las 5:00 a.m.", "…ayer a las 9:30 p.m." o "…el 24 sep a las 5:00 a.m.". */
export function textoUltimaSincronizacion(iso: string | null | undefined, ahora: Date): UltimaSincronizacion {
  const instante = iso ? new Date(iso) : null;
  if (!instante || Number.isNaN(instante.getTime())) {
    return { texto: 'Nunca se ha sincronizado', vieja: true };
  }
  const dia = diaNegocio(instante);
  const hoy = diaNegocio(ahora);
  const cuando =
    dia === hoy ? 'hoy' : dia === sumarDias(hoy, -1) ? 'ayer' : `el ${formatearFechaCorta(dia)}`;
  return {
    texto: `Última vez: ${cuando} a las ${horaDoce(instante)}`,
    vieja: ahora.getTime() - instante.getTime() > DIAS_CATALOGO_VIEJO * MS_POR_DIA,
  };
}

function cuenta(n: number | null | undefined, singular: string, plural: string, adjetivo: [string, string]): string | null {
  if (!n || n <= 0) return null;
  return n === 1 ? `1 ${singular} ${adjetivo[0]}` : `${n} ${plural} ${adjetivo[1]}`;
}

export interface ResumenSincronizacion {
  titulo: 'Todo al día' | 'Se actualizó el catálogo';
  /** Solo los renglones con algo que decir. Vacío: no había nada nuevo. */
  renglones: string[];
  sinConfirmarEmpaque: number;
  /** Los productos pasaron pero los vendedores no: el motivo. */
  errorVendedores: string | null;
}

export function resumirSincronizacion(r: ResultadoSincronizacionApi | null | undefined): ResumenSincronizacion {
  const p = r?.productos;
  const v = r?.vendedores;
  const renglones = [
    cuenta(p?.nuevos, 'producto', 'productos', ['nuevo', 'nuevos']),
    cuenta(p?.actualizados, 'producto', 'productos', ['actualizado', 'actualizados']),
    cuenta(p?.desactivados, 'producto', 'productos', ['dado de baja en Handy', 'dados de baja en Handy']),
    cuenta(v?.nuevos, 'vendedor', 'vendedores', ['nuevo', 'nuevos']),
    cuenta(v?.actualizados, 'vendedor', 'vendedores', ['actualizado', 'actualizados']),
    cuenta(v?.desactivados, 'vendedor', 'vendedores', ['dado de baja en Handy', 'dados de baja en Handy']),
  ].filter((renglon): renglon is string => renglon !== null);
  const errorVendedores = !v ? r?.errorVendedores?.trim() || 'No se pudieron actualizar los vendedores.' : null;
  return {
    titulo: renglones.length > 0 ? 'Se actualizó el catálogo' : 'Todo al día',
    renglones,
    sinConfirmarEmpaque: Math.max(0, p?.sinConfirmarEmpaque ?? 0),
    errorVendedores: r ? errorVendedores : null,
  };
}

/** "2 productos no se pueden contar hasta que confirmes cómo se venden." */
export function textoSinConfirmar(n: number): string {
  return n === 1
    ? '1 producto no se puede contar hasta que confirmes cómo se vende.'
    : `${n} productos no se pueden contar hasta que confirmes cómo se venden.`;
}

export interface FalloSincronizacion {
  titulo: string;
  detalle: string;
  /** El token inválido no se arregla reintentando. */
  reintentable: boolean;
}

/**
 * Lo que se le dice al supervisor si la sincronización no pasa. `estado` y
 * `codigo` vienen del error de la API; `sinRed` si ni siquiera llegó al servidor.
 */
export function falloSincronizacion(error: { sinRed: boolean; estado?: number; codigo?: string | null; mensaje?: string }): FalloSincronizacion {
  if (error.sinRed) {
    return {
      titulo: 'Sin conexión',
      detalle: 'Para sincronizar necesitas señal: revísala y vuelve a intentarlo. No se perdió nada.',
      reintentable: true,
    };
  }
  if (error.codigo === 'HANDY_TOKEN_INVALIDO') {
    return {
      titulo: 'Handy rechazó la conexión',
      detalle:
        'El token de integración con Handy no es válido o ya venció. No se arregla desde la app ni reintentando: avisa al administrador para que lo renueve en el servidor.',
      reintentable: false,
    };
  }
  if (error.estado === 502) {
    return {
      titulo: 'Handy no respondió',
      detalle: 'Vuelve a intentarlo en un momento; no se perdió nada.',
      reintentable: true,
    };
  }
  return {
    titulo: 'No se pudo sincronizar',
    detalle: error.mensaje || 'Vuelve a intentarlo en un momento; no se perdió nada.',
    reintentable: true,
  };
}

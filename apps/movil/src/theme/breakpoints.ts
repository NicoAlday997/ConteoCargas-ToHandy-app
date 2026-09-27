import { useWindowDimensions } from 'react-native';

/**
 * Tres tamaños de ventana (los de Material 3, que también sirven en iPad):
 * - compacto (< 600): celular. Una columna, teclado abajo, modales como hoja inferior.
 * - medio (600–839): tablet de 8" en vertical. Una columna más ancha, teclas
 *   grandes y diálogos centrados. El teclado sigue abajo: al lado dejaría la
 *   lista demasiado angosta para leer nombres.
 * - expandido (≥ 840): tablet grande o en horizontal. Lista y teclado lado a lado.
 */
export type ClaseVentana = 'compacto' | 'medio' | 'expandido';

const ANCHO_MEDIO = 600;
const ANCHO_EXPANDIDO = 840;

export interface InfoLayout {
  clase: ClaseVentana;
  /** Medio o expandido: teclas grandes, diálogos centrados. */
  esTablet: boolean;
  /** Solo expandido: el teclado de cantidad va en un panel lateral. */
  tecladoLateral: boolean;
  ancho: number;
  alto: number;
  columnas: number;
}

export function claseVentana(ancho: number): ClaseVentana {
  if (ancho >= ANCHO_EXPANDIDO) return 'expandido';
  if (ancho >= ANCHO_MEDIO) return 'medio';
  return 'compacto';
}

/** useWindowDimensions (no Dimensions.get) para reaccionar a rotación y a pantalla dividida. */
export function useLayout(): InfoLayout {
  const { width, height } = useWindowDimensions();
  const clase = claseVentana(width);

  return {
    clase,
    esTablet: clase !== 'compacto',
    tecladoLateral: clase === 'expandido',
    ancho: width,
    alto: height,
    columnas: clase === 'expandido' ? 2 : 1,
  };
}

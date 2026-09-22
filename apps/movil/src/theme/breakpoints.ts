import { useWindowDimensions } from 'react-native';

const ANCHO_MINIMO_TABLET = 768;

export interface InfoLayout {
  esTablet: boolean;
  ancho: number;
  columnas: number;
}

/**
 * useWindowDimensions (no Dimensions.get) para reaccionar a rotación:
 * vendedores usan celular, el contador usa tablet en bodega.
 */
export function useLayout(): InfoLayout {
  const { width } = useWindowDimensions();
  const esTablet = width > ANCHO_MINIMO_TABLET;

  return {
    esTablet,
    ancho: width,
    columnas: esTablet ? 2 : 1,
  };
}

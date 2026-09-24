import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORES, ESPACIADO, PESOS, RADIOS, RITMO, TIPOGRAFIA, TONOS } from '../../theme/tokens';
import { Boton } from './Boton';

interface Props {
  /** Qué pasó, en una frase: "No se pudo cargar el historial". */
  titulo: string;
  /** Por qué, y qué se puede hacer. */
  detalle?: string | null;
  /** Sin esto, el bloque solo explica (p. ej. la acción principal del modal ya es reintentar). */
  onReintentar?: () => void;
  textoReintentar?: string;
  reintentando?: boolean;
  /** Otra salida junto a reintentar (p. ej. "Volver"). */
  secundaria?: { texto: string; onPress: () => void };
  /**
   * - error: algo falló o se rechazó.
   * - atencion: no es una falla de nadie (sin señal); se resuelve solo o esperando.
   */
  tono?: 'error' | 'atencion';
  style?: StyleProp<ViewStyle>;
}

/**
 * Un error nunca es texto rojo suelto: es un bloque con qué pasó, por qué y
 * cómo seguir. Alineado a la izquierda, se lee como un aviso, no como un grito.
 */
export function BloqueError({
  titulo,
  detalle,
  onReintentar,
  textoReintentar = 'Reintentar',
  reintentando = false,
  secundaria,
  tono = 'error',
  style,
}: Props) {
  const colores = tono === 'error' ? TONOS.error : TONOS.discrepancia;
  return (
    <View style={[estilos.bloque, { backgroundColor: colores.fondo }, style]} accessibilityRole="alert">
      <View style={estilos.cabecera}>
        <View style={[estilos.signo, { backgroundColor: colores.solido }]}>
          <Text style={estilos.textoSigno}>!</Text>
        </View>
        <Text style={[estilos.titulo, { color: colores.texto }]}>{titulo}</Text>
      </View>
      {detalle ? <Text style={estilos.detalle}>{detalle}</Text> : null}
      {(onReintentar || secundaria) && (
        <View style={estilos.acciones}>
          {secundaria && (
            <Boton texto={secundaria.texto} variante="secundario" onPress={secundaria.onPress} style={estilos.boton} />
          )}
          {onReintentar && (
            <Boton
              texto={textoReintentar}
              variante="secundario"
              onPress={onReintentar}
              cargando={reintentando}
              textoCargando="Reintentando…"
              style={estilos.boton}
            />
          )}
        </View>
      )}
    </View>
  );
}

const TAMANO_SIGNO = ESPACIADO.xl;
/** Entre el signo y el texto: el texto queda en una columna propia. */
const HUECO_SIGNO = ESPACIADO.sm;

const estilos = StyleSheet.create({
  bloque: {
    width: '100%',
    gap: RITMO.interno,
    padding: RITMO.margen,
    borderRadius: RADIOS.medio,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: HUECO_SIGNO,
  },
  signo: {
    width: TAMANO_SIGNO,
    height: TAMANO_SIGNO,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
  },
  textoSigno: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.textoSobreColor,
  },
  titulo: {
    flex: 1,
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.negrita,
  },
  // Alineado con el título, no bajo el signo.
  detalle: {
    marginLeft: TAMANO_SIGNO + HUECO_SIGNO,
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  // Bajo el texto que explican, alineadas con él.
  acciones: {
    marginLeft: TAMANO_SIGNO + HUECO_SIGNO,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: RITMO.relacionado,
    // Otro grupo: lo que se puede hacer va aparte de lo que pasó.
    marginTop: ESPACIADO.md,
  },
  boton: {
    minWidth: ESPACIADO.xxxl * 3,
  },
});

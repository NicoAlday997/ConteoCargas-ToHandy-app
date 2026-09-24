import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORES, ESPACIADO, RITMO, TIPOGRAFIA, type ColorTono } from '../../theme/tokens';
import { Boton } from './Boton';
import { Icono, type NombreIcono } from './Icono';

/** Una línea de lectura cómoda: el detalle no se estira a lo ancho de una tablet. */
const ANCHO_MAXIMO = 480;

export interface AccionEstado {
  texto: string;
  onPress: () => void;
  cargando?: boolean;
  textoCargando?: string;
}

interface Props {
  icono: NombreIcono;
  /** Qué hay (o qué no hay), en una frase. */
  titulo: string;
  /** Por qué está así y qué va a pasar o qué hacer. */
  detalle?: string;
  accion?: AccionEstado;
  /** Una alternativa menor (p. ej. "Volver" junto a "Reintentar"). */
  secundaria?: AccionEstado;
  /** Verde cuando lo vacío es buena noticia (nada pendiente). */
  tono?: ColorTono;
  /** Dentro de una sección o un formulario: sin el aire de pantalla completa. */
  enLinea?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Una lista vacía o una pantalla sin contenido: explica por qué está así y
 * qué hacer, alineado a la izquierda como cualquier texto de lectura. Nunca un
 * "no hay datos" gris y suelto.
 */
export function EstadoVacio({ icono, titulo, detalle, accion, secundaria, tono = 'marca', enLinea = false, style }: Props) {
  return (
    <View style={[estilos.contenedor, enLinea ? estilos.enLinea : estilos.pantalla, style]}>
      <Icono nombre={icono} tono={tono} />
      <View style={estilos.textos}>
        <Text style={estilos.titulo} accessibilityRole="header">
          {titulo}
        </Text>
        {detalle ? <Text style={estilos.detalle}>{detalle}</Text> : null}
      </View>
      {(accion || secundaria) && (
        <View style={estilos.acciones}>
          {accion && (
            <Boton
              texto={accion.texto}
              onPress={accion.onPress}
              cargando={accion.cargando}
              textoCargando={accion.textoCargando}
              variante={enLinea ? 'secundario' : 'primario'}
              style={estilos.boton}
            />
          )}
          {secundaria && (
            <Boton
              texto={secundaria.texto}
              onPress={secundaria.onPress}
              cargando={secundaria.cargando}
              textoCargando={secundaria.textoCargando}
              variante="secundario"
              style={estilos.boton}
            />
          )}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO,
    alignItems: 'flex-start',
    gap: ESPACIADO.lg,
  },
  // Pantalla completa: arriba, con aire, donde empieza la lectura; no flotando al centro.
  pantalla: {
    alignSelf: 'center',
    paddingHorizontal: RITMO.margen,
    paddingTop: ESPACIADO.xxxl,
    paddingBottom: ESPACIADO.xxl,
  },
  enLinea: {
    paddingVertical: RITMO.interno,
  },
  textos: {
    gap: RITMO.interno,
  },
  titulo: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  detalle: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },
  acciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: RITMO.relacionado,
    marginTop: ESPACIADO.xs,
  },
  boton: {
    minWidth: ESPACIADO.xxxl * 4,
  },
});

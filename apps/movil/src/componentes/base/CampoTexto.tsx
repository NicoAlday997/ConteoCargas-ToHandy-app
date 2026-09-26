import { useState, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { BORDES, COLORES, ESPACIADO, ETIQUETA_DATO, FUENTE, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../../theme/tokens';

interface Props {
  /** Qué se escribe: rótulo arriba, pegado al campo. */
  etiqueta: string;
  valor: string;
  onCambiar: (texto: string) => void;
  /** Un ejemplo de lo que se espera, dentro del campo mientras está vacío. */
  ejemplo?: string;
  /** Debajo del campo, en secundario: un requisito ("Mínimo 3 caracteres"). */
  ayuda?: string | null;
  /** Reemplaza a la ayuda, en rojo y con el borde rojo: lo escrito no sirve así. */
  error?: string | null;
  /** Varias líneas: un motivo, una nota. */
  multilinea?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  deshabilitado?: boolean;
  onFocus?: () => void;
  accessibilityHint?: string;
  /** Para darle el foco desde fuera (p. ej. al pasar del teclado de cantidad al motivo). */
  ref?: Ref<TextInput>;
  /** Solo para acomodarlo (flex, márgenes); la apariencia la dan los tokens. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Campo de texto libre. Se ve como los demás controles: blanco, con contorno
 * que se distingue con poca luz y la marca al estar escribiendo. El error
 * nunca es solo el color: va con su texto debajo.
 */
export function CampoTexto({
  etiqueta,
  valor,
  onCambiar,
  ejemplo,
  ayuda,
  error,
  multilinea = false,
  maxLength,
  autoFocus,
  deshabilitado = false,
  onFocus,
  accessibilityHint,
  ref,
  style,
}: Props) {
  const [enfocado, setEnfocado] = useState(false);
  const pie = error ?? ayuda;

  return (
    <View style={[estilos.contenedor, style]}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        ref={ref}
        value={valor}
        onChangeText={onCambiar}
        placeholder={ejemplo}
        placeholderTextColor={COLORES.textoSecundario}
        multiline={multilinea}
        maxLength={maxLength}
        autoFocus={autoFocus}
        editable={!deshabilitado}
        autoCapitalize="sentences"
        onFocus={() => {
          setEnfocado(true);
          onFocus?.();
        }}
        onBlur={() => setEnfocado(false)}
        accessibilityLabel={etiqueta}
        accessibilityHint={[accessibilityHint, pie].filter(Boolean).join('. ') || undefined}
        style={[
          estilos.campo,
          multilinea && estilos.multilinea,
          enfocado && estilos.enfocado,
          error ? estilos.conError : null,
          deshabilitado && estilos.deshabilitado,
        ]}
      />
      {pie ? (
        <Text style={error ? estilos.error : estilos.ayuda} accessibilityLiveRegion={error ? 'polite' : undefined}>
          {pie}
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Rótulo, campo y ayuda son un solo bloque: poco aire entre ellos.
  contenedor: {
    gap: ESPACIADO.xs,
  },
  etiqueta: ETIQUETA_DATO,
  campo: {
    minHeight: TOQUE_MINIMO,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.sm,
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.medio,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.medio,
  },
  multilinea: {
    minHeight: TOQUE_MINIMO + ESPACIADO.xl,
    textAlignVertical: 'top',
  },
  // Lo que se está editando lleva la marca, igual que el campo activo del conteo.
  enfocado: {
    borderColor: COLORES.marca,
  },
  conError: {
    borderColor: COLORES.error,
  },
  deshabilitado: {
    backgroundColor: COLORES.superficieHonda,
  },
  ayuda: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.regular,
    color: COLORES.textoSecundario,
  },
  error: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.error,
  },
});

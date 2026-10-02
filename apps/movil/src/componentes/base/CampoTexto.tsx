import { useCallback, useRef, useState, type Ref } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useMostrarCampo } from './PantallaConFormulario';

import {
  BORDES,
  COLORES,
  ESPACIADO,
  ETIQUETA_DATO,
  FUENTE,
  RADIOS,
  TIPOGRAFIA,
  TOQUE_MINIMO,
} from '../../theme/tokens';

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
  /** Varias líneas: un motivo, una nota. Retorno pone un salto de línea, no cierra el teclado. */
  multilinea?: boolean;
  /** A la derecha, bajo el campo: cuánto lleva escrito («3/10»). Ver `estadoMotivo`. */
  contador?: string | null;
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
  contador,
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
  // Dentro de `PantallaConFormulario` (o una `Hoja`), al enfocarse se desplaza a la vista.
  const mostrarCampo = useMostrarCampo();
  const propio = useRef<TextInput | null>(null);
  const asignarRef = useCallback(
    (nodo: TextInput | null) => {
      propio.current = nodo;
      if (typeof ref === 'function') ref(nodo);
      else if (ref) ref.current = nodo;
    },
    [ref],
  );

  return (
    <View style={[estilos.contenedor, style]}>
      <Text style={[estilos.etiqueta, enfocado && estilos.etiquetaEnfocada]}>
        {etiqueta}
      </Text>
      <TextInput
        ref={asignarRef}
        value={valor}
        onChangeText={onCambiar}
        placeholder={ejemplo}
        placeholderTextColor={COLORES.textoSecundario}
        selectionColor={COLORES.accion}
        cursorColor={COLORES.accion}
        multiline={multilinea}
        submitBehavior={multilinea ? 'newline' : undefined}
        maxLength={maxLength}
        autoFocus={autoFocus}
        editable={!deshabilitado}
        autoCapitalize="sentences"
        onFocus={() => {
          setEnfocado(true);
          if (mostrarCampo && propio.current) mostrarCampo(propio.current);
          onFocus?.();
        }}
        onBlur={() => setEnfocado(false)}
        accessibilityLabel={etiqueta}
        accessibilityHint={
          [accessibilityHint, pie].filter(Boolean).join('. ') || undefined
        }
        style={[
          estilos.campo,
          multilinea && estilos.multilinea,
          enfocado && estilos.enfocado,
          error ? estilos.conError : null,
          deshabilitado && estilos.deshabilitado,
        ]}
      />
      {pie || contador ? (
        <View style={estilos.filaPie}>
          {pie ? (
            <Text
              style={[error ? estilos.error : estilos.ayuda, estilos.textoPie]}
              accessibilityLiveRegion={error ? 'polite' : undefined}
            >
              {pie}
            </Text>
          ) : null}
          {contador ? (
            <Text
              style={[estilos.ayuda, estilos.contador]}
              accessibilityLabel={`${contador.replace('/', ' de ')} caracteres`}
            >
              {contador}
            </Text>
          ) : null}
        </View>
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
  // Con foco, el rótulo sube a tinta: dice qué se está escribiendo.
  etiquetaEnfocada: {
    fontFamily: FUENTE.negrita,
    color: COLORES.accionHonda,
  },
  campo: {
    minHeight: TOQUE_MINIMO,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.sm,
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
    backgroundColor: COLORES.superficie,
    borderWidth: 1.5,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.control,
  },
  multilinea: {
    minHeight: TOQUE_MINIMO + ESPACIADO.xl,
    textAlignVertical: 'top',
  },
  // Lo que se está editando se dibuja en azul señal, con un contorno más grueso.
  enfocado: {
    borderWidth: BORDES.medio,
    borderColor: COLORES.accion,
    backgroundColor: COLORES.superficie,
  },
  conError: {
    borderColor: COLORES.error,
  },
  deshabilitado: {
    backgroundColor: COLORES.superficieHonda,
  },
  filaPie: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ESPACIADO.sm,
  },
  textoPie: {
    flex: 1,
  },
  // Cifras de ancho fijo: el contador no baila al escribir.
  contador: {
    marginLeft: 'auto',
    fontVariant: ['tabular-nums'],
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

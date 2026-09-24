import { createContext, useContext, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORES, ESPACIADO, PESOS, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../../theme/tokens';

interface Props {
  titulo: string;
  /**
   * Lo más importante después del título, con peso propio: la fecha de la
   * carga, cuánto falta. No es para contexto que se retira; eso va en `children`.
   */
  subtitulo?: string | null;
  /** Muestra "‹" a la izquierda. */
  onVolver?: () => void;
  etiquetaVolver?: string;
  /** Slot a la derecha del título: la acción de la pantalla. */
  accion?: ReactNode;
  /**
   * - barra: fija arriba de la pantalla, con línea inferior.
   * - plano: dentro del contenido (un modal, un paso de un flujo).
   */
  variante?: 'barra' | 'plano';
  /**
   * Solo con `barra`: fondo de marca y texto blanco. Da identidad a la pantalla;
   * lo que vaya en `accion` e `inferior` debe leerse sobre azul (usa `useSobreMarca`).
   */
  marca?: boolean;
  lineasTitulo?: number;
  /** Líneas de contexto bajo el subtítulo, alineadas con el título. */
  children?: ReactNode;
  /** A todo el ancho, bajo el título (una barra de progreso). */
  inferior?: ReactNode;
}

export function Encabezado({
  titulo,
  subtitulo,
  onVolver,
  etiquetaVolver = 'Volver',
  accion,
  variante = 'barra',
  marca = false,
  lineasTitulo = 2,
  children,
  inferior,
}: Props) {
  const sobreMarca = marca && variante === 'barra';
  return (
    <ContextoMarca.Provider value={sobreMarca}>
      <View style={variante === 'barra' ? [estilos.barra, sobreMarca && estilos.barraMarca] : estilos.plano}>
        <View style={estilos.fila}>
          {onVolver && (
            <Pressable
              onPress={onVolver}
              accessibilityRole="button"
              accessibilityLabel={etiquetaVolver}
              hitSlop={ESPACIADO.sm}
              style={({ pressed }) => [
                estilos.botonVolver,
                pressed && (sobreMarca ? estilos.botonVolverPresionadoMarca : estilos.botonVolverPresionado),
              ]}
            >
              {({ pressed }) => <Text style={[estilos.textoVolver, (pressed || sobreMarca) && estilos.textoInvertido]}>‹</Text>}
            </Pressable>
          )}
          <View style={estilos.titulos}>
            <Text
              style={[estilos.titulo, sobreMarca && estilos.textoInvertido]}
              accessibilityRole="header"
              numberOfLines={lineasTitulo}
            >
              {titulo}
            </Text>
            {subtitulo ? (
              // En la barra no debe crecer sin límite; dentro del contenido se lee completo.
              <Text
                style={[estilos.subtitulo, sobreMarca && estilos.textoInvertido]}
                numberOfLines={variante === 'barra' ? 2 : undefined}
              >
                {subtitulo}
              </Text>
            ) : null}
            {children}
          </View>
          {accion}
        </View>
        {inferior}
      </View>
    </ContextoMarca.Provider>
  );
}

const ContextoMarca = createContext(false);

/** Si el contenido va dentro de un encabezado de marca (fondo azul): así elige colores que se lean. */
export function useSobreMarca(): boolean {
  return useContext(ContextoMarca);
}

/** Contexto dentro del encabezado: se retira frente al título y al subtítulo. */
export function NotaEncabezado({ children, lineas = 2 }: { children: ReactNode; lineas?: number }) {
  const sobreMarca = useSobreMarca();
  return (
    <Text style={[estilos.nota, sobreMarca && estilos.notaMarca]} numberOfLines={lineas}>
      {children}
    </Text>
  );
}

const estilos = StyleSheet.create({
  // El cambio de fondo separa la barra del contenido: sin línea inferior.
  // Título y lo que va debajo (progreso) son dos grupos.
  barra: {
    gap: ESPACIADO.sm,
    paddingHorizontal: RITMO.margen,
    paddingTop: ESPACIADO.sm,
    paddingBottom: ESPACIADO.md,
    backgroundColor: COLORES.fondo,
  },
  barraMarca: {
    backgroundColor: COLORES.marca,
  },
  plano: {
    gap: ESPACIADO.sm,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  botonVolver: {
    width: TOQUE_MINIMO,
    minHeight: TOQUE_MINIMO,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -ESPACIADO.sm,
    borderRadius: RADIOS.medio,
  },
  botonVolverPresionado: {
    backgroundColor: COLORES.marca,
  },
  botonVolverPresionadoMarca: {
    backgroundColor: COLORES.marcaOscuro,
  },
  textoVolver: {
    ...TIPOGRAFIA.display,
    color: COLORES.texto,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  // Sin hueco: el interlineado ya separa título, subtítulo y notas.
  titulos: {
    flex: 1,
  },
  titulo: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  subtitulo: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  nota: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
  },
  notaMarca: {
    color: COLORES.marcaClaro,
  },
});

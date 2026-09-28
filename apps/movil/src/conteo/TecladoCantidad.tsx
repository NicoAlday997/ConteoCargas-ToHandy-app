import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ALTO_TECLA_GRANDE,
  BORDES,
  CIFRAS,
  COLORES,
  ESCALA_TEXTO,
  ESPACIADO,
  FUENTE,
  ONDA,
  RADIOS,
  ROTULO,
  TIPOGRAFIA,
  TOQUE_MINIMO,
} from '../theme/tokens';
import {
  factorEfectivo,
  sueltasExcedenPaquete,
  type CampoCaptura,
  type CapturaProducto,
  type ProductoConteo,
} from './estado-conteo';
import { Chevron, Glifo, Pulsable } from '../componentes/base';
import { EtiquetaFactor, nombreCampo } from './FilaProducto';
import { formatearNombreProducto } from './formato-nombre';

/** Cabe una cantidad de 4 dígitos a 30 px. */
const ANCHO_VISOR = ESPACIADO.xxxl + ESPACIADO.xxl + ESPACIADO.sm;
/** Controles del encabezado del teclado: 40 de alto y 8 de holgura arriba y abajo llegan a 56. */
const ALTO_CONTROL_ENCABEZADO = ESPACIADO.xxl + ESPACIADO.sm;
const HOLGURA_ENCABEZADO = { top: ESPACIADO.sm, bottom: ESPACIADO.sm, left: ESPACIADO.xs, right: ESPACIADO.xs };
/** La columna de acciones es más ancha que la de un dígito: "Siguiente" cabe sin encogerse. */
const PESO_COLUMNA_ACCIONES = 1.3;

const FILAS: readonly (readonly string[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

interface Props {
  producto: ProductoConteo;
  campo: CampoCaptura;
  /** Los campos que admite el producto, en orden. Con dos (y `onCambiarCampo`), el encabezado deja cambiar de uno a otro. */
  camposDisponibles?: readonly CampoCaptura[];
  /** Lo tecleado; vacío es "sin capturar". */
  texto: string;
  /** El valor mostrado aún no se toca: la primera tecla lo reemplaza. */
  reemplazar: boolean;
  /** Captura con lo tecleado aplicado, para avisar si las sueltas ya son un paquete. */
  captura: CapturaProducto;
  etiquetaSiguiente: string;
  /** La tecla de avance lleva a otro campo o producto (no termina): muestra un chevron. */
  siguienteConChevron?: boolean;
  /** Panel lateral (tablet expandida): ocupa el alto de la pantalla. */
  lateral: boolean;
  /** Tablet (media o expandida): teclas de 72 en vez de 56. */
  teclasGrandes?: boolean;
  /** Llega al borde de abajo y absorbe el área segura. `false` si la pantalla ya la aplica. */
  areaSegura?: boolean;
  onDigito: (digito: string) => void;
  onBorrar: () => void;
  onSiguiente: () => void;
  /** "Revisado, no lleva": el producto queda en 0 y se pasa al siguiente. Sin él, no hay tecla. */
  onNoLleva?: () => void;
  onCambiarCampo?: (campo: CampoCaptura) => void;
  onListo: () => void;
}

/**
 * Teclado propio (nunca el del sistema, que cambia de tamaño y tapa la lista
 * según el dispositivo). Arriba repite qué producto y qué campo se captura:
 * con 73 productos casi iguales, perder el hilo es el error más caro.
 *
 * El ritmo manda. La tecla que avanza es la acción de la pantalla (azul
 * sólido, doble alto, abajo a la derecha donde descansa el pulgar); "No lleva"
 * vive junto a ella porque es la captura más repetida del día; "Listo" solo
 * cierra y por eso es la más callada.
 */
export function TecladoCantidad({
  producto,
  campo,
  camposDisponibles = [campo],
  texto,
  reemplazar,
  captura,
  etiquetaSiguiente,
  siguienteConChevron = false,
  lateral,
  teclasGrandes = lateral,
  areaSegura = true,
  onDigito,
  onBorrar,
  onSiguiente,
  onNoLleva,
  onCambiarCampo,
  onListo,
}: Props) {
  // El panel llega hasta el borde de abajo: su fondo absorbe el área segura.
  const margenes = useSafeAreaInsets();
  const factor = factorEfectivo(producto);
  const avisoSueltas = campo === 'sueltas' && sueltasExcedenPaquete(captura.sueltas, factor);
  const altoTecla = teclasGrandes ? ALTO_TECLA_GRANDE : TOQUE_MINIMO;
  const etiquetaCampo = nombreCampo(producto, campo);
  const nombre = formatearNombreProducto(producto.nombre);

  return (
    <View style={[estilos.panel, lateral && estilos.panelLateral, { paddingBottom: (lateral ? ESPACIADO.lg : ESPACIADO.md) + (areaSegura ? margenes.bottom : 0) }]}>
      <View style={estilos.encabezado}>
        <View style={estilos.lineaProducto} accessible accessibilityLabel={`Capturando ${nombre}`} accessibilityLiveRegion="polite">
          <EtiquetaFactor producto={producto} grande={lateral} />
          <Text style={estilos.nombre} numberOfLines={2} maxFontSizeMultiplier={ESCALA_TEXTO.compacto}>
            {nombre}
          </Text>
        </View>
        <Pulsable
          onPress={onListo}
          onda={ONDA.sobreColor}
          hitSlop={HOLGURA_ENCABEZADO}
          accessibilityRole="button"
          accessibilityLabel="Listo, cerrar teclado"
          style={({ pressed }) => [estilos.botonListo, pressed && estilos.botonListoPresionado]}
        >
          <Text style={estilos.textoListo} maxFontSizeMultiplier={ESCALA_TEXTO.control}>
            Listo
          </Text>
        </Pulsable>
      </View>

      <View style={estilos.lineaValor}>
        {camposDisponibles.length > 1 && onCambiarCampo ? (
          <View style={estilos.selector} accessibilityRole="tablist">
            {camposDisponibles.map((c) => {
              const activo = c === campo;
              const rotulo = nombreCampo(producto, c);
              return (
                <Pulsable
                  key={c}
                  onPress={() => {
                    if (!activo) onCambiarCampo(c);
                  }}
                  tacto="seleccion"
                  hitSlop={HOLGURA_ENCABEZADO}
                  accessibilityRole="tab"
                  accessibilityLabel={`Capturar ${rotulo}`}
                  accessibilityState={{ selected: activo }}
                  style={[estilos.opcionCampo, activo && estilos.opcionCampoActiva]}
                >
                  <Text
                    style={[estilos.textoOpcion, activo && estilos.textoOpcionActiva]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={ESCALA_TEXTO.control}
                  >
                    {rotulo}
                  </Text>
                </Pulsable>
              );
            })}
          </View>
        ) : (
          <Text style={estilos.campoUnico} maxFontSizeMultiplier={ESCALA_TEXTO.compacto}>
            {etiquetaCampo}
          </Text>
        )}
        <View
          style={[estilos.visor, avisoSueltas && estilos.visorConAviso]}
          accessible
          accessibilityLabel={`${etiquetaCampo}: ${texto === '' ? 'sin capturar' : texto}`}
        >
          <Text
            style={[estilos.valor, reemplazar && estilos.valorPorReemplazar]}
            numberOfLines={1}
            maxFontSizeMultiplier={ESCALA_TEXTO.control}
          >
            {texto === '' ? '—' : texto}
          </Text>
        </View>
      </View>

      {/* Avisa, no bloquea: a veces el paquete viene abierto. Altura reservada para que las teclas no se muevan. */}
      <View style={estilos.zonaAviso}>
        {avisoSueltas && factor !== null && (
          <View style={estilos.aviso} accessibilityRole="alert">
            <Glifo nombre="alerta" color={COLORES.texto} tamano={ESPACIADO.lg + 2} />
            <Text style={estilos.textoAviso} maxFontSizeMultiplier={ESCALA_TEXTO.compacto}>
              Eso ya es un paquete completo de {factor}. Si venía cerrado, cuéntalo en Paquetes.
            </Text>
          </View>
        )}
      </View>

      <View style={[estilos.teclado, lateral && estilos.tecladoLateral]}>
        <View style={[estilos.digitos, lateral && estilos.tecladoLateral]}>
          {FILAS.map((fila) => (
            <View key={fila.join('')} style={estilos.fila}>
              {fila.map((digito) => (
                <Tecla key={digito} etiqueta={digito} alto={altoTecla} onPress={() => onDigito(digito)} />
              ))}
            </View>
          ))}
          <View style={estilos.fila}>
            <Tecla etiqueta="0" alto={altoTecla} onPress={() => onDigito('0')} />
          </View>
        </View>

        <View style={[estilos.acciones, lateral && estilos.tecladoLateral]}>
          <Tecla etiqueta="Borrar" alto={altoTecla} onPress={onBorrar} variante="secundaria" etiquetaAccesible="Borrar último dígito" />
          {onNoLleva && (
            <Tecla
              etiqueta="No lleva"
              alto={altoTecla}
              onPress={onNoLleva}
              variante="noLleva"
              etiquetaAccesible="No lleva: marcar en cero y pasar al siguiente"
            />
          )}
          <Tecla
            etiqueta={etiquetaSiguiente}
            alto={altoTecla}
            onPress={onSiguiente}
            variante="avance"
            chevron={siguienteConChevron}
            estirar
          />
        </View>
      </View>
    </View>
  );
}

type VarianteTecla = 'digito' | 'secundaria' | 'noLleva' | 'avance';

interface PropsTecla {
  etiqueta: string;
  alto: number;
  onPress: () => void;
  variante?: VarianteTecla;
  etiquetaAccesible?: string;
  chevron?: boolean;
  /** Ocupa el alto que sobra en su columna (la tecla de avance mide dos filas). */
  estirar?: boolean;
}

function Tecla({ etiqueta, alto, onPress, variante = 'digito', etiquetaAccesible, chevron = false, estirar = false }: PropsTecla) {
  const avance = variante === 'avance';
  return (
    <Pulsable
      onPress={onPress}
      tacto="tecla"
      repetible
      onda={avance ? ONDA.sobreClaro : ONDA.sobreColor}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible ?? etiqueta}
      style={({ pressed }) => [
        estilos.tecla,
        { minHeight: alto },
        estirar && estilos.teclaEstirada,
        variante === 'noLleva' && estilos.teclaNoLleva,
        avance && estilos.teclaAvance,
        pressed && (avance ? estilos.teclaAvancePresionada : estilos.teclaPresionada),
      ]}
    >
      {({ pressed }) => (
        <View style={estilos.contenidoTecla}>
          <Text
            style={[
              variante === 'digito' ? estilos.textoDigito : estilos.textoSecundario,
              variante === 'noLleva' && estilos.textoNoLleva,
              avance && estilos.textoAvance,
              pressed && (avance ? estilos.textoInvertido : estilos.textoPresionado),
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={ESCALA_TEXTO.control}
          >
            {etiqueta}
          </Text>
          {chevron && <Chevron color={pressed ? COLORES.textoSobreColor : COLORES.texto} tamano={ESPACIADO.xl} />}
        </View>
      )}
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  // El tablero de asfalto: se acopla abajo y se separa de la lista clara por
  // su propio fondo, como el tablero de una cabina. Teclas en relieve tonal.
  panel: {
    gap: ESPACIADO.sm,
    padding: ESPACIADO.md,
    backgroundColor: COLORES.marca,
    borderTopLeftRadius: RADIOS.encabezado,
    borderTopRightRadius: RADIOS.encabezado,
  },
  panelLateral: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: ESPACIADO.lg,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.md,
  },
  lineaProducto: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  nombre: {
    flex: 1,
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    color: COLORES.textoSobreColor,
  },
  // Solo cierra: la más callada del panel. Un tono arriba del asfalto.
  botonListo: {
    minHeight: ALTO_CONTROL_ENCABEZADO,
    paddingHorizontal: ESPACIADO.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.marcaHonda,
    borderRadius: RADIOS.medio,
  },
  botonListoPresionado: {
    backgroundColor: COLORES.marcaClara,
  },
  textoListo: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.titular,
    fontSize: 16,
    color: COLORES.textoSobreColor,
  },
  lineaValor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ESPACIADO.sm,
  },
  // Paquetes | Sueltas: cuál se captura se ve por forma (placa blanca) y no solo por el rótulo.
  selector: {
    flexDirection: 'row',
    gap: ESPACIADO.xs,
    padding: ESPACIADO.xs,
    backgroundColor: COLORES.marcaProfunda,
    borderRadius: RADIOS.medio,
  },
  opcionCampo: {
    minHeight: ALTO_CONTROL_ENCABEZADO - ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.chico,
  },
  opcionCampoActiva: {
    backgroundColor: COLORES.superficie,
  },
  textoOpcion: {
    ...ROTULO,
    fontFamily: FUENTE.titular,
    fontSize: TIPOGRAFIA.etiqueta.fontSize,
    lineHeight: TIPOGRAFIA.etiqueta.lineHeight,
    color: COLORES.marcaTenue,
  },
  textoOpcionActiva: {
    color: COLORES.texto,
  },
  campoUnico: {
    ...ROTULO,
    fontFamily: FUENTE.titular,
    fontSize: TIPOGRAFIA.etiqueta.fontSize,
    lineHeight: TIPOGRAFIA.etiqueta.lineHeight,
    color: COLORES.marcaTenue,
  },
  // La lectura de lo tecleado, subrayada en verde: la línea continua del carril.
  visor: {
    minWidth: ANCHO_VISOR,
    paddingHorizontal: ESPACIADO.sm,
    borderBottomWidth: BORDES.grueso + 1,
    borderBottomColor: COLORES.accionViva,
  },
  visorConAviso: {
    borderBottomColor: COLORES.discrepancia,
  },
  // Lo que se teclea domina el panel. Mismo alto de línea que un título: el
  // teclado no crece (los dígitos no tienen descendentes).
  valor: {
    ...TIPOGRAFIA.titulo,
    fontFamily: FUENTE.extraNegrita,
    fontSize: 32,
    color: COLORES.textoSobreColor,
    textAlign: 'right',
    ...CIFRAS,
  },
  // Se ve "seleccionado": la primera tecla lo reemplaza, no se le agrega.
  valorPorReemplazar: {
    color: COLORES.marcaTenue,
  },
  // Cabe un aviso de dos líneas: al aparecer, las teclas no se mueven.
  zonaAviso: {
    minHeight: TIPOGRAFIA.etiqueta.lineHeight * 2 + ESPACIADO.xs,
    justifyContent: 'center',
  },
  // Letrero preventivo sobre el asfalto: amarillo con tinta y rombo.
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.sm,
    paddingVertical: 2,
    backgroundColor: COLORES.discrepancia,
    borderRadius: RADIOS.chico,
  },
  textoAviso: {
    flex: 1,
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.texto,
  },
  // Numpad: tres columnas de dígitos y una de acciones a la derecha, del lado del pulgar.
  teclado: {
    flexDirection: 'row',
    gap: ESPACIADO.sm,
  },
  tecladoLateral: {
    gap: ESPACIADO.md,
  },
  digitos: {
    flex: 3,
    gap: ESPACIADO.sm,
  },
  acciones: {
    flex: PESO_COLUMNA_ACCIONES,
    gap: ESPACIADO.sm,
  },
  fila: {
    flexDirection: 'row',
    gap: ESPACIADO.sm,
  },
  tecla: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.xs,
    backgroundColor: COLORES.marcaHonda,
    borderWidth: BORDES.fino,
    borderColor: COLORES.marcaClara,
    borderRadius: RADIOS.medio,
  },
  // Dentro de la columna de acciones la tecla no se estira sola; la de avance sí.
  teclaEstirada: {
    flexGrow: 1,
  },
  contenidoTecla: {
    alignItems: 'center',
    gap: ESPACIADO.xs,
  },
  // El gris de la fila "no lleva": la tecla dice qué estado deja.
  teclaNoLleva: {
    backgroundColor: COLORES.pendiente,
    borderColor: COLORES.pendiente,
  },
  // La acción del panel: verde vivo, el "adelante" del tablero.
  teclaAvance: {
    backgroundColor: COLORES.accionViva,
    borderColor: COLORES.accionViva,
  },
  teclaAvancePresionada: {
    backgroundColor: COLORES.accion,
    borderColor: COLORES.accion,
  },
  // Inversión completa al presionar: la tecla se enciende en blanco, se nota aun con poca luz.
  teclaPresionada: {
    backgroundColor: COLORES.superficie,
    borderColor: COLORES.superficie,
  },
  textoDigito: {
    ...TIPOGRAFIA.tecla,
    color: COLORES.textoSobreColor,
    ...CIFRAS,
  },
  textoSecundario: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.titular,
    fontSize: 18,
    color: COLORES.textoSobreColor,
  },
  textoNoLleva: {
    color: COLORES.textoSobreColor,
  },
  textoAvance: {
    ...TIPOGRAFIA.tituloBarra,
    color: COLORES.texto,
  },
  textoPresionado: {
    color: COLORES.texto,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
});

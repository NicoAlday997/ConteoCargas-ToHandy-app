import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BORDES, CIFRAS, COLORES, ESPACIADO, PESOS, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';
import {
  factorEfectivo,
  sueltasExcedenPaquete,
  type CampoCaptura,
  type CapturaProducto,
  type ProductoConteo,
} from './estado-conteo';
import { EtiquetaFactor, nombreCampo } from './FilaProducto';

/** Cabe una cantidad de 4 dígitos al tamaño de título. */
const ANCHO_VISOR = ESPACIADO.xxxl + ESPACIADO.xxl + ESPACIADO.sm;
/** En tablet sobra alto: teclas más grandes, igual que el teclado del PIN. */
const ALTO_TECLA_LATERAL = TOQUE_MINIMO + ESPACIADO.lg;

const FILAS: readonly (readonly string[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

interface Props {
  producto: ProductoConteo;
  campo: CampoCaptura;
  /** Lo tecleado; vacío es "sin capturar". */
  texto: string;
  /** El valor mostrado aún no se toca: la primera tecla lo reemplaza. */
  reemplazar: boolean;
  /** Captura con lo tecleado aplicado, para avisar si las sueltas ya son un paquete. */
  captura: CapturaProducto;
  etiquetaSiguiente: string;
  lateral: boolean;
  onDigito: (digito: string) => void;
  onBorrar: () => void;
  onSiguiente: () => void;
  onListo: () => void;
}

/**
 * Teclado propio (nunca el del sistema, que cambia de tamaño y tapa la lista
 * según el dispositivo). Arriba repite qué producto y qué campo se captura:
 * con 73 productos casi iguales, perder el hilo es el error más caro. El total
 * en piezas no se repite aquí: la fila en edición queda a la vista y ya lo
 * muestra al teclear.
 */
export function TecladoCantidad({
  producto,
  campo,
  texto,
  reemplazar,
  captura,
  etiquetaSiguiente,
  lateral,
  onDigito,
  onBorrar,
  onSiguiente,
  onListo,
}: Props) {
  const factor = factorEfectivo(producto);
  const avisoSueltas = campo === 'sueltas' && sueltasExcedenPaquete(captura.sueltas, factor);
  const altoTecla = lateral ? ALTO_TECLA_LATERAL : TOQUE_MINIMO;
  const etiquetaCampo = nombreCampo(producto, campo);

  return (
    <View style={[estilos.panel, lateral && estilos.panelLateral]}>
      <View style={estilos.encabezado}>
        <View style={estilos.contexto} accessibilityLiveRegion="polite">
          <View style={estilos.lineaProducto}>
            <EtiquetaFactor producto={producto} grande={lateral} />
            <Text style={estilos.nombre} numberOfLines={2}>
              {producto.nombre}
            </Text>
          </View>
          <View style={estilos.lineaValor}>
            <Text style={estilos.campo}>{etiquetaCampo}</Text>
            <View
              style={[estilos.visor, avisoSueltas && estilos.visorConAviso]}
              accessible
              accessibilityLabel={`${etiquetaCampo}: ${texto === '' ? 'sin capturar' : texto}`}
            >
              <Text style={[estilos.valor, reemplazar && estilos.valorPorReemplazar]} numberOfLines={1}>
                {texto === '' ? '—' : texto}
              </Text>
            </View>
          </View>
        </View>
        <Pressable
          onPress={onListo}
          accessibilityRole="button"
          accessibilityLabel="Listo, cerrar teclado"
          style={({ pressed }) => [estilos.botonListo, pressed && estilos.botonListoPresionado]}
        >
          <Text style={estilos.textoListo}>Listo</Text>
        </Pressable>
      </View>

      {/* Avisa, no bloquea: a veces el paquete viene abierto. Altura reservada para que las teclas no se muevan. */}
      <View style={estilos.zonaAviso}>
        {avisoSueltas && factor !== null && (
          <Text style={estilos.aviso} accessibilityRole="alert">
            Eso ya es un paquete completo de {factor}. Si venía cerrado, cuéntalo en Paquetes.
          </Text>
        )}
      </View>

      <View style={[estilos.teclado, lateral && estilos.tecladoLateral]}>
        {FILAS.map((fila) => (
          <View key={fila.join('')} style={estilos.fila}>
            {fila.map((digito) => (
              <Tecla key={digito} etiqueta={digito} alto={altoTecla} onPress={() => onDigito(digito)} />
            ))}
          </View>
        ))}
        <View style={estilos.fila}>
          <Tecla etiqueta="Borrar" alto={altoTecla} onPress={onBorrar} secundaria etiquetaAccesible="Borrar último dígito" />
          <Tecla etiqueta="0" alto={altoTecla} onPress={() => onDigito('0')} />
          <Tecla etiqueta={etiquetaSiguiente} alto={altoTecla} onPress={onSiguiente} secundaria avance />
        </View>
      </View>
    </View>
  );
}

interface PropsTecla {
  etiqueta: string;
  alto: number;
  onPress: () => void;
  secundaria?: boolean;
  /** La tecla que avanza: tinte de marca, se encuentra sin buscarla. */
  avance?: boolean;
  etiquetaAccesible?: string;
}

function Tecla({ etiqueta, alto, onPress, secundaria = false, avance = false, etiquetaAccesible }: PropsTecla) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible ?? etiqueta}
      style={({ pressed }) => [
        estilos.tecla,
        { minHeight: alto },
        avance && estilos.teclaAvance,
        pressed && estilos.teclaPresionada,
      ]}
    >
      {({ pressed }) => (
        <Text
          style={[
            secundaria ? estilos.textoSecundario : estilos.textoDigito,
            avance && estilos.textoAvance,
            pressed && estilos.textoInvertido,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {etiqueta}
        </Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  panel: {
    gap: ESPACIADO.sm,
    padding: ESPACIADO.md,
    // Teclas blancas sobre el fondo tintado, igual que las tarjetas sobre la pantalla.
    backgroundColor: COLORES.fondoPantalla,
    borderTopWidth: BORDES.grueso,
    borderTopColor: COLORES.marca,
  },
  panelLateral: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: ESPACIADO.lg,
    borderTopWidth: 0,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ESPACIADO.md,
  },
  contexto: {
    flex: 1,
    gap: ESPACIADO.xs,
  },
  lineaProducto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  nombre: {
    flex: 1,
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.semiNegrita,
    color: COLORES.texto,
  },
  lineaValor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  // Rótulo del campo: se lee de reojo ("¿paquetes o sueltas?") sin competir con la cifra.
  campo: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.marcaOscuro,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  visor: {
    minWidth: ANCHO_VISOR,
    paddingHorizontal: ESPACIADO.sm,
    borderBottomWidth: BORDES.grueso,
    borderBottomColor: COLORES.marca,
  },
  visorConAviso: {
    borderBottomColor: COLORES.discrepancia,
  },
  // Lo que se teclea domina el panel. Mismo alto de línea que un título: el
  // teclado no crece (los dígitos no tienen descendentes).
  valor: {
    ...TIPOGRAFIA.titulo,
    fontSize: 30,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.texto,
    textAlign: 'right',
    ...CIFRAS,
  },
  // Se ve "seleccionado": la primera tecla lo reemplaza, no se le agrega.
  valorPorReemplazar: {
    color: COLORES.textoSecundario,
  },
  botonListo: {
    minHeight: TOQUE_MINIMO,
    minWidth: TOQUE_MINIMO + ESPACIADO.xl,
    paddingHorizontal: ESPACIADO.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.marca,
    borderRadius: RADIOS.medio,
  },
  botonListoPresionado: {
    backgroundColor: COLORES.marcaOscuro,
  },
  textoListo: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.textoSobreColor,
  },
  // Cabe un aviso de dos líneas: al aparecer, las teclas no se mueven.
  zonaAviso: {
    minHeight: TIPOGRAFIA.etiqueta.lineHeight * 2 + ESPACIADO.xs,
    justifyContent: 'center',
  },
  // El fondo ámbar lo separa: sin contorno ni relleno vertical, cabe en la zona reservada.
  aviso: {
    paddingHorizontal: ESPACIADO.sm,
    backgroundColor: COLORES.discrepanciaFondo,
    borderRadius: RADIOS.chico,
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.discrepanciaTexto,
    overflow: 'hidden',
  },
  teclado: {
    gap: ESPACIADO.sm,
  },
  tecladoLateral: {
    gap: ESPACIADO.md,
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
    backgroundColor: COLORES.fondo,
    borderWidth: BORDES.fino,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.medio,
  },
  teclaAvance: {
    backgroundColor: COLORES.marcaClaro,
    borderColor: COLORES.marca,
  },
  // Inversión completa al presionar: se nota aun con poca luz.
  teclaPresionada: {
    backgroundColor: COLORES.marca,
    borderColor: COLORES.marca,
  },
  textoDigito: {
    ...TIPOGRAFIA.titulo,
    fontWeight: PESOS.semiNegrita,
    color: COLORES.texto,
  },
  textoSecundario: {
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.semiNegrita,
    color: COLORES.texto,
  },
  textoAvance: {
    fontWeight: PESOS.negrita,
    color: COLORES.marcaOscuro,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
});

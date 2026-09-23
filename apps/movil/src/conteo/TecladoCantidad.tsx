import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';
import {
  factorEfectivo,
  sueltasExcedenPaquete,
  totalPiezas,
  type CampoCaptura,
  type CapturaProducto,
  type ProductoConteo,
} from './estado-conteo';
import { EtiquetaFactor } from './FilaProducto';

/** En tablet sobra alto: teclas más grandes, igual que el teclado del PIN. */
const ALTO_TECLA_LATERAL = TOQUE_MINIMO + ESPACIADO.lg;

const FILAS: readonly (readonly string[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

const ETIQUETAS_CAMPO: Record<CampoCaptura, string> = {
  paquetes: 'Paquetes',
  sueltas: 'Sueltas',
};

interface Props {
  producto: ProductoConteo;
  campo: CampoCaptura;
  /** Lo tecleado; vacío es "sin capturar". */
  texto: string;
  /** El valor mostrado aún no se toca: la primera tecla lo reemplaza. */
  reemplazar: boolean;
  /** Captura con lo tecleado aplicado, para el total en vivo. */
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
 * con 73 productos casi iguales, perder el hilo es el error más caro.
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
  const total = totalPiezas(captura, factor);
  const avisoSueltas = campo === 'sueltas' && sueltasExcedenPaquete(captura.sueltas, factor);
  const altoTecla = lateral ? ALTO_TECLA_LATERAL : TOQUE_MINIMO;

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
            <Text style={estilos.campo}>{ETIQUETAS_CAMPO[campo]}</Text>
            <View
              style={[estilos.visor, avisoSueltas && estilos.visorConAviso]}
              accessible
              accessibilityLabel={`${ETIQUETAS_CAMPO[campo]}: ${texto === '' ? 'sin capturar' : texto}`}
            >
              <Text style={[estilos.valor, reemplazar && estilos.valorPorReemplazar]} numberOfLines={1}>
                {texto === '' ? '—' : texto}
              </Text>
            </View>
            <Text style={estilos.total} numberOfLines={1}>
              {total === null ? '' : `= ${total} pz`}
            </Text>
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
          <Tecla etiqueta={etiquetaSiguiente} alto={altoTecla} onPress={onSiguiente} secundaria />
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
  etiquetaAccesible?: string;
}

function Tecla({ etiqueta, alto, onPress, secundaria = false, etiquetaAccesible }: PropsTecla) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible ?? etiqueta}
      style={({ pressed }) => [estilos.tecla, { minHeight: alto }, pressed && estilos.teclaPresionada]}
    >
      {({ pressed }) => (
        <Text
          style={[secundaria ? estilos.textoSecundario : estilos.textoDigito, pressed && estilos.textoInvertido]}
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
    backgroundColor: COLORES.fondo,
    borderTopWidth: 2,
    borderTopColor: COLORES.texto,
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
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  lineaValor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  campo: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    textTransform: 'uppercase',
  },
  visor: {
    minWidth: 88,
    paddingHorizontal: ESPACIADO.sm,
    borderBottomWidth: 3,
    borderBottomColor: COLORES.texto,
  },
  visorConAviso: {
    borderBottomColor: COLORES.discrepancia,
  },
  valor: {
    fontSize: TIPOGRAFIA.tamanos.xxl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  // Se ve "seleccionado": la primera tecla lo reemplaza, no se le agrega.
  valorPorReemplazar: {
    color: COLORES.textoSecundario,
  },
  total: {
    flexShrink: 1,
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSecundario,
    fontVariant: ['tabular-nums'],
  },
  botonListo: {
    minHeight: TOQUE_MINIMO,
    minWidth: TOQUE_MINIMO + ESPACIADO.xl,
    paddingHorizontal: ESPACIADO.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.texto,
    borderRadius: RADIOS.md,
  },
  botonListoPresionado: {
    backgroundColor: COLORES.textoSecundario,
  },
  textoListo: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSobreColor,
  },
  zonaAviso: {
    minHeight: 40,
    justifyContent: 'center',
  },
  aviso: {
    paddingLeft: ESPACIADO.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORES.discrepancia,
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
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
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.md,
  },
  // Inversión completa al presionar: se nota aun con poca luz.
  teclaPresionada: {
    backgroundColor: COLORES.texto,
    borderColor: COLORES.texto,
  },
  textoDigito: {
    fontSize: TIPOGRAFIA.tamanos.xxl,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  textoSecundario: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
});

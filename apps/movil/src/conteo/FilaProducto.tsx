import { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';
import {
  admitePaquetes,
  estadoFila,
  factorEfectivo,
  sueltasExcedenPaquete,
  totalPiezas,
  type CampoCaptura,
  type CapturaProducto,
  type EstadoFila,
  type ProductoConteo,
} from './estado-conteo';

/** Un destello corto: confirma el toque sin hacer esperar al siguiente. */
const DURACION_DESTELLO_MS = 280;
const OPACIDAD_DESTELLO = 0.3;
const ANCHO_BARRA_ESTADO = 6;
const ANCHO_TOTAL = 72;

// ---------------------------------------------------------------------------
// Etiqueta del factor de empaque
// ---------------------------------------------------------------------------

/**
 * "C/70" en su propia caja, del mismo ancho en todas las filas: al recorrer la
 * lista las etiquetas quedan alineadas en columna y CANELS c/60 contra c/70 se
 * distingue sin leer el nombre.
 */
export function EtiquetaFactor({ producto, grande = false }: { producto: ProductoConteo; grande?: boolean }) {
  const factor = factorEfectivo(producto);
  let texto: string;
  let accesible: string;
  if (factor !== null) {
    texto = `C/${factor}`;
    accesible = `Paquete de ${factor} piezas`;
  } else if (!producto.factorConfirmado) {
    texto = 'C/?';
    accesible = 'Empaque sin confirmar';
  } else {
    texto = 'PZA';
    accesible = 'Se cuenta por pieza';
  }
  const sinConfirmar = factor === null && !producto.factorConfirmado;

  return (
    <View
      style={[estilos.etiqueta, grande && estilos.etiquetaGrande, sinConfirmar && estilos.etiquetaSinConfirmar]}
      accessible
      accessibilityLabel={accesible}
    >
      <Text
        style={[estilos.textoEtiqueta, grande && estilos.textoEtiquetaGrande, sinConfirmar && estilos.textoSinConfirmar]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {texto}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Fila
// ---------------------------------------------------------------------------

/** Si lo capturado ya llegó al servidor. `null` en filas sin nada que enviar. */
export type EnvioFila = 'enviado' | 'por-enviar' | 'rechazado' | null;

interface Props {
  producto: ProductoConteo;
  /** Ya incluye lo que se está tecleando: el total se actualiza al teclear. */
  captura: CapturaProducto;
  campoActivo: CampoCaptura | null;
  envio: EnvioFila;
  /** Motivo del rechazo del servidor, solo con `envio === 'rechazado'`. */
  errorEnvio: string | null;
  onAbrirCampo: (code: string, campo: CampoCaptura) => void;
  onCero: (code: string) => void;
}

function FilaProductoBase({ producto, captura, campoActivo, envio, errorEnvio, onAbrirCampo, onCero }: Props) {
  const factor = factorEfectivo(producto);
  const conPaquetes = admitePaquetes(producto);
  const estado = estadoFila(captura, factor);
  const total = totalPiezas(captura, factor);
  const avisoSueltas = sueltasExcedenPaquete(captura.sueltas, factor);
  const destello = useDestello(estado);

  // Con cantidad, el "0" se bloquea: un toque perdido al pasar de fila no debe
  // borrar lo que ya se contó. Para corregir a cero se usa el teclado.
  const ceroBloqueado = estado === 'con-cantidad';

  return (
    <View
      style={[
        estilos.fila,
        estado === 'sin-capturar' && estilos.filaSinCapturar,
        estado === 'con-cantidad' && estilos.filaConCantidad,
        estado === 'en-cero' && estilos.filaEnCero,
        campoActivo !== null && estilos.filaActiva,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: COLOR_DESTELLO[estado] }, destello]}
      />

      <View style={estilos.encabezado}>
        <EtiquetaFactor producto={producto} />
        <Text style={estilos.nombre} numberOfLines={2}>
          {producto.nombre}
        </Text>
        {estado === 'en-cero' && <Text style={estilos.marcaCero}>No lleva</Text>}
        <MarcaEnvio envio={envio} />
      </View>

      <View style={estilos.captura}>
        {conPaquetes ? (
          <Campo
            etiqueta="Paquetes"
            valor={captura.paquetes}
            activo={campoActivo === 'paquetes'}
            onPress={() => onAbrirCampo(producto.code, 'paquetes')}
            nombreProducto={producto.nombre}
          />
        ) : null}
        <Campo
          etiqueta="Sueltas"
          valor={captura.sueltas}
          activo={campoActivo === 'sueltas'}
          onPress={() => onAbrirCampo(producto.code, 'sueltas')}
          nombreProducto={producto.nombre}
          aviso={avisoSueltas}
        />
        {!conPaquetes && <View style={estilos.huecoCampo} />}

        <View style={estilos.total} accessible accessibilityLabel={textoTotalAccesible(total, estado)}>
          <Text style={[estilos.numeroTotal, estado !== 'con-cantidad' && estilos.numeroTotalApagado]} numberOfLines={1}>
            {total === null ? '—' : total}
          </Text>
          <Text style={estilos.unidadTotal}>piezas</Text>
        </View>

        <Pressable
          onPress={() => onCero(producto.code)}
          disabled={ceroBloqueado}
          accessibilityRole="button"
          accessibilityLabel={`${producto.nombre}: no lleva, marcar en cero`}
          accessibilityState={{ disabled: ceroBloqueado, selected: estado === 'en-cero' }}
          hitSlop={ESPACIADO.xs}
          style={({ pressed }) => [
            estilos.botonCero,
            estado === 'en-cero' && estilos.botonCeroMarcado,
            pressed && estilos.botonCeroPresionado,
            ceroBloqueado && estilos.botonCeroBloqueado,
          ]}
        >
          {({ pressed }) => (
            <Text
              style={[
                estilos.textoCero,
                (pressed || estado === 'en-cero') && estilos.textoInvertido,
              ]}
            >
              0
            </Text>
          )}
        </Pressable>
      </View>

      {!producto.factorConfirmado && (
        <Aviso texto="Empaque sin confirmar: cuéntalo en sueltas y avisa al supervisor." />
      )}
      {avisoSueltas && factor !== null && (
        <Aviso texto={`${captura.sueltas} sueltas ya completan un paquete de ${factor}. ¿Venía abierto?`} />
      )}
      {envio === 'rechazado' && (
        <Aviso texto={`El servidor no lo aceptó: ${errorEnvio ?? 'revisa la cantidad'}. Vuelve a capturarlo.`} error />
      )}
    </View>
  );
}

export const FilaProducto = memo(FilaProductoBase);

function textoTotalAccesible(total: number | null, estado: EstadoFila): string {
  if (estado === 'sin-capturar') return 'Sin capturar';
  if (total === null) return 'Total no calculable';
  return `Total ${total} piezas`;
}

const COLOR_DESTELLO: Record<EstadoFila, string> = {
  'sin-capturar': COLORES.pendiente,
  'con-cantidad': COLORES.capturado,
  'en-cero': COLORES.pendiente,
};

/** Destello al cambiar de estado (no al montar): confirma que el toque se registró. */
function useDestello(estado: EstadoFila) {
  const opacidad = useSharedValue(0);
  const anterior = useRef(estado);

  useEffect(() => {
    if (anterior.current === estado) return;
    anterior.current = estado;
    opacidad.value = withSequence(
      withTiming(OPACIDAD_DESTELLO, { duration: 0 }),
      withTiming(0, { duration: DURACION_DESTELLO_MS }),
    );
  }, [estado, opacidad]);

  return useAnimatedStyle(() => ({ opacity: opacidad.value }));
}

/**
 * Discreta a propósito: con 73 filas, una marca llamativa en cada una compite
 * con lo único que debe llamar la atención (lo que falta por contar). El
 * estado general está en el encabezado; aquí solo se confirma fila por fila.
 */
function MarcaEnvio({ envio }: { envio: EnvioFila }) {
  if (envio === null) return null;
  const texto = envio === 'enviado' ? '✓' : envio === 'por-enviar' ? '↑' : '!';
  const accesible =
    envio === 'enviado' ? 'Enviado al servidor' : envio === 'por-enviar' ? 'Guardado en el teléfono, por enviar' : 'Rechazado por el servidor';
  return (
    <Text
      style={[estilos.marcaEnvio, envio === 'rechazado' && estilos.marcaEnvioRechazada]}
      accessibilityLabel={accesible}
    >
      {texto}
    </Text>
  );
}

/** Ámbar solo en la marca: el texto va oscuro para leerse con poca luz. */
function Aviso({ texto, error = false }: { texto: string; error?: boolean }) {
  return (
    <View style={[estilos.aviso, error && estilos.avisoError]}>
      <Text style={estilos.textoAviso}>{texto}</Text>
    </View>
  );
}

interface PropsCampo {
  etiqueta: string;
  valor: number | null;
  activo: boolean;
  onPress: () => void;
  nombreProducto: string;
  aviso?: boolean;
}

function Campo({ etiqueta, valor, activo, onPress, nombreProducto, aviso = false }: PropsCampo) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nombreProducto}, ${etiqueta}: ${valor === null ? 'sin capturar' : valor}`}
      accessibilityState={{ selected: activo }}
      style={({ pressed }) => [
        estilos.campo,
        aviso && estilos.campoConAviso,
        (activo || pressed) && estilos.campoActivo,
      ]}
    >
      {({ pressed }) => (
        <>
          <Text style={[estilos.etiquetaCampo, (activo || pressed) && estilos.textoInvertido]}>{etiqueta}</Text>
          <Text
            style={[
              estilos.valorCampo,
              valor === null && estilos.valorVacio,
              (activo || pressed) && estilos.textoInvertido,
            ]}
            numberOfLines={1}
          >
            {valor === null ? '—' : valor}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  etiqueta: {
    minWidth: 64,
    paddingHorizontal: ESPACIADO.sm,
    paddingVertical: ESPACIADO.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.texto,
    borderRadius: RADIOS.sm,
  },
  etiquetaGrande: {
    minWidth: 84,
    paddingVertical: ESPACIADO.sm,
  },
  etiquetaSinConfirmar: {
    backgroundColor: COLORES.fondo,
    borderWidth: 2,
    borderColor: COLORES.discrepancia,
  },
  textoEtiqueta: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.textoSobreColor,
    fontVariant: ['tabular-nums'],
  },
  textoEtiquetaGrande: {
    fontSize: TIPOGRAFIA.tamanos.xl,
  },
  textoSinConfirmar: {
    color: COLORES.discrepancia,
  },

  fila: {
    flex: 1,
    gap: ESPACIADO.sm,
    padding: ESPACIADO.md,
    borderRadius: RADIOS.md,
    borderLeftWidth: ANCHO_BARRA_ESTADO,
    overflow: 'hidden',
  },
  // Sin capturar es lo único que debe llamar la atención: borde grueso y oscuro.
  filaSinCapturar: {
    backgroundColor: COLORES.fondo,
    borderWidth: 2,
    borderLeftWidth: ANCHO_BARRA_ESTADO,
    borderColor: COLORES.texto,
  },
  filaConCantidad: {
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderLeftWidth: ANCHO_BARRA_ESTADO,
    borderColor: COLORES.capturado,
  },
  filaEnCero: {
    backgroundColor: COLORES.superficie,
    borderWidth: 1,
    borderLeftWidth: ANCHO_BARRA_ESTADO,
    borderColor: COLORES.borde,
  },
  filaActiva: {
    borderWidth: 3,
    borderLeftWidth: ANCHO_BARRA_ESTADO,
    borderColor: COLORES.texto,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  nombre: {
    flex: 1,
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  marcaCero: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSecundario,
  },
  captura: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: ESPACIADO.sm,
  },
  campo: {
    flex: 1,
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.sm,
    backgroundColor: COLORES.fondo,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.md,
  },
  campoConAviso: {
    borderWidth: 2,
    borderColor: COLORES.discrepancia,
  },
  campoActivo: {
    backgroundColor: COLORES.texto,
    borderColor: COLORES.texto,
  },
  huecoCampo: {
    flex: 1,
  },
  etiquetaCampo: {
    fontSize: TIPOGRAFIA.tamanos.xs,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSecundario,
    textTransform: 'uppercase',
  },
  valorCampo: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    fontVariant: ['tabular-nums'],
  },
  valorVacio: {
    color: COLORES.textoSecundario,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  total: {
    width: ANCHO_TOTAL,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  numeroTotal: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    fontVariant: ['tabular-nums'],
  },
  numeroTotalApagado: {
    color: COLORES.textoSecundario,
  },
  unidadTotal: {
    fontSize: TIPOGRAFIA.tamanos.xs,
    color: COLORES.textoSecundario,
  },
  botonCero: {
    width: TOQUE_MINIMO,
    minHeight: TOQUE_MINIMO,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.fondo,
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
  },
  botonCeroMarcado: {
    backgroundColor: COLORES.pendiente,
    borderColor: COLORES.pendiente,
  },
  // Inversión completa: se nota aun con poca luz.
  botonCeroPresionado: {
    backgroundColor: COLORES.texto,
    borderColor: COLORES.texto,
  },
  botonCeroBloqueado: {
    opacity: 0.3,
  },
  textoCero: {
    fontSize: TIPOGRAFIA.tamanos.xxl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  aviso: {
    paddingLeft: ESPACIADO.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORES.discrepancia,
  },
  avisoError: {
    borderLeftColor: COLORES.error,
  },
  marcaEnvio: {
    minWidth: 16,
    textAlign: 'center',
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.textoSecundario,
  },
  marcaEnvioRechazada: {
    color: COLORES.error,
  },
  textoAviso: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
});

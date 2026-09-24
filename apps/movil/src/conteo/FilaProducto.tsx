import { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Etiqueta } from '../componentes/base';
import { BORDES, CIFRAS, COLORES, ESPACIADO, OPACIDAD, PESOS, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';
import {
  admitePaquetes,
  admiteSueltas,
  estadoFila,
  factorEfectivo,
  seVendeCompleto,
  sueltasExcedenPaquete,
  totalPiezas,
  type CampoCaptura,
  type CapturaProducto,
  type EstadoFila,
  type ProductoConteo,
} from './estado-conteo';
import { unidadEnPlural, unidadEnSingular } from './formato-cantidad';

/** Un destello corto: confirma el toque sin hacer esperar al siguiente. */
const DURACION_DESTELLO_MS = 280;
const OPACIDAD_DESTELLO = 0.3;
const ANCHO_TOTAL = 72;
/** Alto de la línea del nombre: la de la etiqueta del factor en grande, que es la más alta. */
const ALTO_ENCABEZADO = TIPOGRAFIA.titulo.lineHeight;
/**
 * La cifra de un campo, más grande que un título pero en su mismo alto de
 * línea (los dígitos no tienen descendentes): rótulo + cifra caben en el
 * toque mínimo sin que la fila crezca.
 */
const CIFRA_CAMPO = { fontSize: 28, lineHeight: TIPOGRAFIA.titulo.lineHeight } as const;

/** "Cajas" para lo que se vende completo; "Paquetes" / "Sueltas" para lo demás. */
export function nombreCampo(producto: ProductoConteo, campo: CampoCaptura): string {
  if (campo === 'sueltas') return 'Sueltas';
  if (!seVendeCompleto(producto)) return 'Paquetes';
  const plural = unidadEnPlural(producto.unidadDescripcion);
  return plural.charAt(0).toUpperCase() + plural.slice(1);
}

// ---------------------------------------------------------------------------
// Etiqueta del factor de empaque
// ---------------------------------------------------------------------------

/**
 * "C/12" en una píldora de marca, del mismo ancho en todas las filas: al recorrer la
 * lista las etiquetas quedan alineadas en columna y se lee cómo se cuenta cada
 * producto sin leer el nombre. Lo que se vende completo lleva su unidad ("CAJA"):
 * ahí no hay factor, el "c/70" de un dulce solo es parte del nombre.
 */
export function EtiquetaFactor({ producto, grande = false }: { producto: ProductoConteo; grande?: boolean }) {
  const factor = factorEfectivo(producto);
  let texto: string;
  let accesible: string;
  if (seVendeCompleto(producto)) {
    const unidad = unidadEnSingular(producto.unidadDescripcion);
    texto = unidad.toUpperCase();
    accesible = `Se vende por ${unidad} completa`;
  } else if (factor !== null) {
    texto = `C/${factor}`;
    accesible = `Paquete de ${factor} piezas`;
  } else if (!producto.factorConfirmado) {
    texto = 'C/?';
    accesible = 'Empaque sin confirmar';
  } else {
    texto = 'PZA';
    accesible = 'Se cuenta por pieza';
  }
  const sinConfirmar = !producto.factorConfirmado;

  return (
    <Etiqueta
      texto={texto}
      tono={sinConfirmar ? 'discrepancia' : 'marca'}
      relleno={sinConfirmar ? 'contorno' : 'tintada'}
      tamano={grande ? 'grande' : 'destacada'}
      anchoFijo
      ajustar
      accessibilityLabel={accesible}
    />
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
  const completo = seVendeCompleto(producto);
  const conPaquetes = admitePaquetes(producto);
  // Si se capturaron sueltas antes de confirmarlo como completo, el campo sigue
  // a la vista para poder borrarlas: el servidor las rechaza y hay que corregir.
  const conSueltas = admiteSueltas(producto) || (captura.sueltas ?? 0) > 0;
  const estado = estadoFila(captura, producto);
  const total = totalPiezas(captura, producto);
  const avisoSueltas = sueltasExcedenPaquete(captura.sueltas, factor);
  const destello = useDestello(estado);
  const unidadTotal = completo ? unidadEnPlural(producto.unidadDescripcion) : 'piezas';
  // Los campos se separan del fondo de la tarjeta: gris sobre blanco, blanco sobre tinte.
  const fondoCampo = campoActivo === null && estado === 'sin-capturar' ? COLORES.superficie : COLORES.fondo;

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
        <EtiquetaFactor producto={producto} grande />
        <Text style={estilos.nombre} numberOfLines={2}>
          {producto.nombre}
        </Text>
        {estado === 'en-cero' && <Text style={estilos.marcaCero}>No lleva</Text>}
        <MarcaEnvio envio={envio} />
      </View>

      <View style={estilos.captura}>
        {conPaquetes && (
          <Campo
            etiqueta={nombreCampo(producto, 'paquetes')}
            valor={captura.paquetes}
            activo={campoActivo === 'paquetes'}
            fondo={fondoCampo}
            onPress={() => onAbrirCampo(producto.code, 'paquetes')}
            nombreProducto={producto.nombre}
          />
        )}
        {conSueltas && (
          <Campo
            etiqueta={nombreCampo(producto, 'sueltas')}
            valor={captura.sueltas}
            activo={campoActivo === 'sueltas'}
            fondo={fondoCampo}
            onPress={() => onAbrirCampo(producto.code, 'sueltas')}
            nombreProducto={producto.nombre}
            aviso={avisoSueltas}
          />
        )}
        {/* Un solo campo: el hueco mantiene las columnas alineadas con las filas de dos. */}
        {!(conPaquetes && conSueltas) && <View style={estilos.huecoCampo} />}

        <View style={estilos.total} accessible accessibilityLabel={textoTotalAccesible(total, estado, unidadTotal)}>
          <Text
            style={[
              estilos.numeroTotal,
              estado === 'con-cantidad' && estilos.numeroTotalCapturado,
              estado === 'en-cero' && estilos.numeroTotalEnCero,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {total === null ? '—' : total}
          </Text>
          <Text style={estilos.unidadTotal} numberOfLines={1} adjustsFontSizeToFit>
            {unidadTotal}
          </Text>
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

function textoTotalAccesible(total: number | null, estado: EstadoFila, unidad: string): string {
  if (estado === 'sin-capturar') return 'Sin capturar';
  if (total === null) return 'Total no calculable';
  return `Total ${total} ${unidad}`;
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

/** Bloque tintado del estado, con su texto oscuro: se lee con poca luz y no suma alto a la fila. */
function Aviso({ texto, error = false }: { texto: string; error?: boolean }) {
  return (
    <View style={[estilos.aviso, error && estilos.avisoError]}>
      <Text style={[estilos.textoAviso, error && estilos.textoAvisoError]}>{texto}</Text>
    </View>
  );
}

interface PropsCampo {
  etiqueta: string;
  valor: number | null;
  activo: boolean;
  /** Fondo en reposo: contrasta con el de la tarjeta. */
  fondo: string;
  onPress: () => void;
  nombreProducto: string;
  aviso?: boolean;
}

function Campo({ etiqueta, valor, activo, fondo, onPress, nombreProducto, aviso = false }: PropsCampo) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nombreProducto}, ${etiqueta}: ${valor === null ? 'sin capturar' : valor}`}
      accessibilityState={{ selected: activo }}
      style={({ pressed }) => [
        estilos.campo,
        { backgroundColor: fondo },
        aviso && estilos.campoConAviso,
        (activo || pressed) && estilos.campoActivo,
      ]}
    >
      {({ pressed }) => (
        <>
          <Text
            style={[estilos.etiquetaCampo, (activo || pressed) && estilos.textoInvertido]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {etiqueta}
          </Text>
          <Text
            style={[
              estilos.valorCampo,
              valor === null && estilos.valorVacio,
              (activo || pressed) && estilos.textoInvertido,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {valor === null ? '—' : valor}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  // Tarjeta compacta: se recorren 73 productos. Relleno vertical corto, el aire
  // va entre tarjetas (lo pone la lista). El estado va en el FONDO de toda la
  // tarjeta y se refuerza con la barra izquierda, nunca con un contorno: así
  // todas miden lo mismo en cualquier estado.
  fila: {
    flex: 1,
    gap: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.sm,
    borderRadius: RADIOS.medio,
    borderLeftWidth: BORDES.acento,
    overflow: 'hidden',
  },
  // Sin capturar es lo único que debe llamar la atención: blanco pleno, barra oscura.
  filaSinCapturar: {
    backgroundColor: COLORES.fondo,
    borderLeftColor: COLORES.texto,
  },
  filaConCantidad: {
    backgroundColor: COLORES.capturadoFondo,
    borderLeftColor: COLORES.capturado,
  },
  // Revisado y sin carga: gris, se retira.
  filaEnCero: {
    backgroundColor: COLORES.pendienteFondo,
    borderLeftColor: COLORES.pendiente,
  },
  // Lo que se está editando lleva la marca, igual que el teclado.
  filaActiva: {
    backgroundColor: COLORES.marcaClaro,
    borderLeftColor: COLORES.marca,
  },
  encabezado: {
    minHeight: ALTO_ENCABEZADO,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  // El nombre domina la cabecera: es lo que se busca con la mirada.
  nombre: {
    flex: 1,
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.negrita,
    color: COLORES.texto,
  },
  marcaCero: {
    ...TIPOGRAFIA.micro,
    fontWeight: PESOS.negrita,
    color: COLORES.pendienteTexto,
    textTransform: 'uppercase',
  },
  captura: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: ESPACIADO.sm,
  },
  // Campo con fondo propio: el número grande a la derecha, el rótulo encima y retirado.
  campo: {
    flex: 1,
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.sm,
    borderWidth: BORDES.fino,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.medio,
  },
  campoConAviso: {
    borderWidth: BORDES.medio,
    borderColor: COLORES.discrepancia,
  },
  campoActivo: {
    backgroundColor: COLORES.marca,
    borderColor: COLORES.marca,
  },
  huecoCampo: {
    flex: 1,
  },
  // Rótulo y cifra a la derecha: en la lista, los campos forman columnas de
  // números alineados (120 sobre 99), como en una hoja de conteo.
  etiquetaCampo: {
    ...TIPOGRAFIA.micro,
    fontWeight: PESOS.medio,
    color: COLORES.textoSecundario,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  valorCampo: {
    ...TIPOGRAFIA.titulo,
    ...CIFRA_CAMPO,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.texto,
    textAlign: 'right',
    ...CIFRAS,
  },
  valorVacio: {
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  // El total es el dato que domina la fila: lo que se carga al camión.
  total: {
    width: ANCHO_TOTAL,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  numeroTotal: {
    ...TIPOGRAFIA.display,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.textoSecundario,
    textAlign: 'right',
    ...CIFRAS,
  },
  numeroTotalCapturado: {
    color: COLORES.capturadoTexto,
  },
  numeroTotalEnCero: {
    color: COLORES.pendienteTexto,
  },
  unidadTotal: {
    ...TIPOGRAFIA.micro,
    fontWeight: PESOS.medio,
    color: COLORES.textoSecundario,
    textTransform: 'uppercase',
  },
  botonCero: {
    width: TOQUE_MINIMO,
    minHeight: TOQUE_MINIMO,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.fondo,
    borderWidth: BORDES.medio,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.medio,
  },
  botonCeroMarcado: {
    backgroundColor: COLORES.pendiente,
    borderColor: COLORES.pendiente,
  },
  // Inversión completa: se nota aun con poca luz.
  botonCeroPresionado: {
    backgroundColor: COLORES.marca,
    borderColor: COLORES.marca,
  },
  botonCeroBloqueado: {
    opacity: OPACIDAD.bloqueado,
  },
  textoCero: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  // Sin relleno vertical ni contorno: el bloque tintado se distingue solo y la fila no crece.
  aviso: {
    paddingHorizontal: ESPACIADO.sm,
    backgroundColor: COLORES.discrepanciaFondo,
    borderRadius: RADIOS.chico,
  },
  avisoError: {
    backgroundColor: COLORES.errorFondo,
  },
  marcaEnvio: {
    minWidth: ESPACIADO.lg,
    textAlign: 'center',
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.negrita,
    color: COLORES.textoSecundario,
  },
  marcaEnvioRechazada: {
    color: COLORES.error,
  },
  textoAviso: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.discrepanciaTexto,
  },
  textoAvisoError: {
    color: COLORES.errorTexto,
  },
});

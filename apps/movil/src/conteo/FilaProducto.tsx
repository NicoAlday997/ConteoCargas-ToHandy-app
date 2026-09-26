import { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Palomita } from '../componentes/base';
import {
  ALTO_CONTROL,
  BORDES,
  CIFRAS,
  COLORES,
  ESPACIADO,
  FUENTE,
  OPACIDAD,
  RADIOS,
  ROTULO,
  TIPOGRAFIA,
} from '../theme/tokens';
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
import { formatearNombreProducto } from './formato-nombre';

/** Un destello corto: confirma el toque sin hacer esperar al siguiente. */
const DURACION_DESTELLO_MS = 280;
const OPACIDAD_DESTELLO = 0.3;
const ANCHO_TOTAL = 84;
const ANCHO_CERO = 52;
/** Pastilla del factor: mismo ancho en todas las filas, así quedan en columna. */
const ANCHO_FACTOR = 60;
/** Borde de la fila "no lleva": un gris apenas más hondo que su fondo. */
const BORDE_NO_LLEVA = '#D3D6E0';

/** "Cajas" para lo que se vende completo; "Paquetes" / "Sueltas" para lo demás. */
export function nombreCampo(producto: ProductoConteo, campo: CampoCaptura): string {
  if (campo === 'sueltas') return 'Sueltas';
  if (!seVendeCompleto(producto)) return 'Paquetes';
  const plural = unidadEnPlural(producto.unidadDescripcion);
  return plural.charAt(0).toUpperCase() + plural.slice(1);
}

/**
 * Cómo se ve una fila. El estado MANDA y tiñe la fila completa (fondo, borde,
 * total, pastilla del factor); el color de la familia nunca entra aquí.
 * - falta: sin capturar; lo único que debe llamar la atención.
 * - contado: con cantidad.
 * - no-lleva: marcado en cero; se retira.
 * - tecleando: la fila entera en marca; imposible perder dónde vas.
 */
export type AspectoFila = 'falta' | 'contado' | 'no-lleva' | 'tecleando';

const ASPECTO_DE_ESTADO: Record<EstadoFila, AspectoFila> = {
  'sin-capturar': 'falta',
  'con-cantidad': 'contado',
  'en-cero': 'no-lleva',
};

interface ColoresAspecto {
  fondo: string;
  borde: string;
  nombre: string;
  total: string;
  unidad: string;
  factorFondo: string;
  factorTexto: string;
  /** Fondo de los campos en reposo. */
  campo: string;
  campoTexto: string;
}

const COLORES_ASPECTO: Record<AspectoFila, ColoresAspecto> = {
  falta: {
    fondo: COLORES.superficie,
    borde: COLORES.discrepancia,
    nombre: COLORES.texto,
    total: COLORES.discrepanciaHonda,
    unidad: COLORES.textoSecundario,
    factorFondo: COLORES.discrepanciaFondo,
    factorTexto: COLORES.discrepanciaTexto,
    campo: COLORES.superficieHonda,
    campoTexto: COLORES.texto,
  },
  contado: {
    fondo: COLORES.capturadoFondo,
    borde: COLORES.capturado,
    nombre: COLORES.texto,
    total: COLORES.capturadoHondo,
    unidad: COLORES.capturadoHondo,
    factorFondo: COLORES.capturadoHondo,
    factorTexto: COLORES.textoSobreColor,
    campo: COLORES.superficie,
    campoTexto: COLORES.texto,
  },
  'no-lleva': {
    fondo: COLORES.pendienteFondo,
    borde: BORDE_NO_LLEVA,
    nombre: COLORES.pendiente,
    total: COLORES.pendiente,
    unidad: COLORES.pendiente,
    factorFondo: COLORES.superficie,
    factorTexto: COLORES.pendiente,
    campo: COLORES.superficie,
    campoTexto: COLORES.pendiente,
  },
  tecleando: {
    fondo: COLORES.marca,
    borde: COLORES.marca,
    nombre: COLORES.textoSobreColor,
    total: COLORES.textoSobreColor,
    unidad: COLORES.marcaTenue,
    factorFondo: COLORES.marcaHonda,
    factorTexto: COLORES.textoSobreColor,
    campo: COLORES.marcaHonda,
    campoTexto: COLORES.textoSobreColor,
  },
};

// ---------------------------------------------------------------------------
// Etiqueta del factor de empaque
// ---------------------------------------------------------------------------

/**
 * "C/12" en una pastilla del mismo ancho en todas las filas: al recorrer la
 * lista quedan alineadas en columna y se lee cómo se cuenta cada producto sin
 * leer el nombre. Lo que se vende completo lleva su unidad ("CAJA"): ahí no
 * hay factor, el "c/70" de un dulce solo es parte del nombre.
 *
 * Dentro de una fila de conteo toma los colores del estado de la fila
 * (`aspecto`). Fuera de ella es un dato de referencia (gris) y, sin
 * confirmar, un aviso ámbar.
 */
export function EtiquetaFactor({
  producto,
  grande = false,
  aspecto,
}: {
  producto: ProductoConteo;
  grande?: boolean;
  aspecto?: AspectoFila;
}) {
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

  let fondo: string;
  let color: string;
  if (aspecto) {
    fondo = COLORES_ASPECTO[aspecto].factorFondo;
    color = COLORES_ASPECTO[aspecto].factorTexto;
  } else if (!producto.factorConfirmado) {
    fondo = COLORES.discrepanciaFondo;
    color = COLORES.discrepanciaTexto;
  } else {
    fondo = COLORES.superficieHonda;
    color = COLORES.textoSecundario;
  }

  return (
    <View
      style={[estilos.factor, grande && estilos.factorGrande, { backgroundColor: fondo }]}
      accessible
      accessibilityLabel={accesible}
    >
      <Text style={[grande ? estilos.textoFactorGrande : estilos.textoFactor, { color }]} numberOfLines={1} adjustsFontSizeToFit>
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
  const completo = seVendeCompleto(producto);
  const conPaquetes = admitePaquetes(producto);
  // Si se capturaron sueltas antes de confirmarlo como completo, el campo sigue
  // a la vista para poder borrarlas: el servidor las rechaza y hay que corregir.
  const conSueltas = admiteSueltas(producto) || (captura.sueltas ?? 0) > 0;
  const estado = estadoFila(captura, producto);
  const aspecto: AspectoFila = campoActivo !== null ? 'tecleando' : ASPECTO_DE_ESTADO[estado];
  const colores = COLORES_ASPECTO[aspecto];
  const total = totalPiezas(captura, producto);
  const avisoSueltas = sueltasExcedenPaquete(captura.sueltas, factor);
  const destello = useDestello(estado);
  const nombre = formatearNombreProducto(producto.nombre);
  const unidadTotal = completo ? unidadEnPlural(producto.unidadDescripcion) : 'piezas';

  // Con cantidad, el "0" se bloquea: un toque perdido al pasar de fila no debe
  // borrar lo que ya se contó. Para corregir a cero se usa el teclado.
  const ceroBloqueado = estado === 'con-cantidad';

  return (
    <View style={[estilos.fila, { backgroundColor: colores.fondo, borderColor: colores.borde }]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: COLOR_DESTELLO[estado] }, destello]}
      />

      <View style={estilos.encabezado}>
        <EtiquetaFactor producto={producto} aspecto={aspecto} />
        <Text style={[estilos.nombre, { color: colores.nombre }]} numberOfLines={2}>
          {nombre}
        </Text>
        {estado === 'en-cero' && aspecto !== 'tecleando' && (
          <View style={estilos.marcaCero}>
            <Text style={estilos.textoMarcaCero}>No lleva</Text>
          </View>
        )}
        {aspecto === 'contado' && <Palomita color={COLORES.capturadoHondo} />}
        <MarcaEnvio envio={envio} sobreMarca={aspecto === 'tecleando'} />
      </View>

      <View style={estilos.captura}>
        <View style={estilos.campos}>
          {conPaquetes && (
            <Campo
              etiqueta={nombreCampo(producto, 'paquetes')}
              valor={captura.paquetes}
              activo={campoActivo === 'paquetes'}
              fondo={colores.campo}
              colorTexto={colores.campoTexto}
              onPress={() => onAbrirCampo(producto.code, 'paquetes')}
              nombreProducto={nombre}
            />
          )}
          {conSueltas && (
            <Campo
              etiqueta={nombreCampo(producto, 'sueltas')}
              valor={captura.sueltas}
              activo={campoActivo === 'sueltas'}
              fondo={colores.campo}
              colorTexto={colores.campoTexto}
              onPress={() => onAbrirCampo(producto.code, 'sueltas')}
              nombreProducto={nombre}
              aviso={avisoSueltas}
            />
          )}
          {/* Un solo campo: el hueco mantiene las columnas alineadas con las filas de dos. */}
          {!(conPaquetes && conSueltas) && <View style={estilos.huecoCampo} />}
        </View>

        <View style={estilos.total} accessible accessibilityLabel={textoTotalAccesible(total, estado, unidadTotal)}>
          <Text style={[estilos.numeroTotal, { color: colores.total }]} numberOfLines={1} adjustsFontSizeToFit>
            {total === null ? '—' : total}
          </Text>
          <Text style={[estilos.unidadTotal, { color: colores.unidad }]} numberOfLines={1} adjustsFontSizeToFit>
            {unidadTotal}
          </Text>
        </View>

        <Pressable
          onPress={() => onCero(producto.code)}
          disabled={ceroBloqueado}
          accessibilityRole="button"
          accessibilityLabel={`${nombre}: no lleva, marcar en cero`}
          accessibilityState={{ disabled: ceroBloqueado, selected: estado === 'en-cero' }}
          hitSlop={ESPACIADO.xs}
          style={({ pressed }) => [
            estilos.botonCero,
            aspecto === 'tecleando' && estilos.botonCeroSobreMarca,
            estado === 'en-cero' && aspecto !== 'tecleando' && estilos.botonCeroMarcado,
            pressed && estilos.botonCeroPresionado,
            ceroBloqueado && estilos.botonCeroBloqueado,
          ]}
        >
          {({ pressed }) => (
            <Text
              style={[
                estilos.textoCero,
                (pressed || aspecto === 'tecleando' || estado === 'en-cero') && estilos.textoInvertido,
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
 * estado general está en el encabezado; aquí solo se avisa lo que aún no
 * llegó (↑) o lo que el servidor rechazó (!). Lo enviado no lleva marca: la
 * palomita de "contado" ya dice que está.
 */
function MarcaEnvio({ envio, sobreMarca }: { envio: EnvioFila; sobreMarca: boolean }) {
  if (envio === null || envio === 'enviado') return null;
  const texto = envio === 'por-enviar' ? '↑' : '!';
  const accesible = envio === 'por-enviar' ? 'Guardado en el teléfono, por enviar' : 'Rechazado por el servidor';
  return (
    <Text
      style={[
        estilos.marcaEnvio,
        sobreMarca && estilos.textoInvertido,
        envio === 'rechazado' && !sobreMarca && estilos.marcaEnvioRechazada,
      ]}
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
  /** Fondo en reposo, según el estado de la fila. */
  fondo: string;
  colorTexto: string;
  onPress: () => void;
  nombreProducto: string;
  aviso?: boolean;
}

/**
 * Sin borde: el fondo propio lo separa de la fila. El campo que se teclea va
 * en blanco con el número oscuro sobre la fila azul.
 */
function Campo({ etiqueta, valor, activo, fondo, colorTexto, onPress, nombreProducto, aviso = false }: PropsCampo) {
  const color = activo ? COLORES.texto : colorTexto;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nombreProducto}, ${etiqueta}: ${valor === null ? 'sin capturar' : valor}`}
      accessibilityState={{ selected: activo }}
      style={({ pressed }) => [
        estilos.campo,
        { backgroundColor: activo ? COLORES.superficie : fondo },
        aviso && estilos.campoConAviso,
        pressed && !activo && estilos.campoPresionado,
      ]}
    >
      <Text style={[estilos.etiquetaCampo, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {etiqueta}
      </Text>
      <Text style={[estilos.valorCampo, { color }, valor === null && estilos.valorVacio]} numberOfLines={1} adjustsFontSizeToFit>
        {valor === null ? '—' : valor}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  // El estado va en el fondo y el borde de toda la fila; todas miden lo mismo
  // en cualquier estado. Poco aire dentro; entre filas lo pone la lista.
  fila: {
    flex: 1,
    gap: ESPACIADO.sm,
    padding: ESPACIADO.md,
    borderRadius: RADIOS.grande,
    borderWidth: BORDES.medio,
    overflow: 'hidden',
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  // El nombre domina la cabecera: es lo que se busca con la mirada.
  nombre: {
    flex: 1,
    ...TIPOGRAFIA.subtitulo,
  },
  factor: {
    minWidth: ANCHO_FACTOR,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.sm,
    paddingVertical: 2,
    borderRadius: RADIOS.completo,
  },
  factorGrande: {
    minWidth: ANCHO_FACTOR + ESPACIADO.xl,
    paddingVertical: ESPACIADO.xs,
  },
  textoFactor: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.negrita,
    ...CIFRAS,
  },
  textoFactorGrande: {
    ...TIPOGRAFIA.tituloBarra,
    fontFamily: FUENTE.negrita,
    ...CIFRAS,
  },
  // Pastilla blanca sobre el gris de la fila.
  marcaCero: {
    paddingHorizontal: ESPACIADO.sm,
    paddingVertical: 2,
    borderRadius: RADIOS.completo,
    backgroundColor: COLORES.superficie,
  },
  textoMarcaCero: {
    ...TIPOGRAFIA.rotulo,
    fontSize: 11,
    lineHeight: 14,
    color: COLORES.pendiente,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  captura: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  // Campos y total separados por más aire que entre campos: el total no parece un tercer campo.
  campos: {
    flex: 1,
    flexDirection: 'row',
    gap: ESPACIADO.sm,
    marginRight: ESPACIADO.lg - ESPACIADO.sm,
  },
  // El número a la derecha, el rótulo encima: los campos forman columnas de
  // números alineados (120 sobre 99), como en una hoja de conteo.
  campo: {
    flex: 1,
    height: ALTO_CONTROL,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.sm,
    borderRadius: RADIOS.medio,
  },
  campoConAviso: {
    borderWidth: BORDES.medio,
    borderColor: COLORES.discrepancia,
  },
  campoPresionado: {
    opacity: OPACIDAD.deshabilitado,
  },
  huecoCampo: {
    flex: 1,
  },
  etiquetaCampo: {
    ...ROTULO,
    textAlign: 'right',
  },
  valorCampo: {
    ...TIPOGRAFIA.campo,
    textAlign: 'right',
    ...CIFRAS,
  },
  valorVacio: {
    fontFamily: FUENTE.regular,
    opacity: OPACIDAD.deshabilitado,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  // No es tocable y no debe parecerlo: sin caja ni borde.
  total: {
    width: ANCHO_TOTAL,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  numeroTotal: {
    ...TIPOGRAFIA.total,
    textAlign: 'right',
    ...CIFRAS,
  },
  unidadTotal: ROTULO,
  botonCero: {
    width: ANCHO_CERO,
    height: ALTO_CONTROL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.medio,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.medio,
  },
  botonCeroSobreMarca: {
    backgroundColor: 'transparent',
    borderColor: COLORES.marcaTenue,
  },
  botonCeroMarcado: {
    backgroundColor: COLORES.pendiente,
    borderColor: COLORES.pendiente,
  },
  // Inversión completa: se nota aun con poca luz.
  botonCeroPresionado: {
    backgroundColor: COLORES.marcaHonda,
    borderColor: COLORES.marcaHonda,
  },
  botonCeroBloqueado: {
    opacity: OPACIDAD.bloqueado,
  },
  textoCero: {
    ...TIPOGRAFIA.campo,
    fontFamily: FUENTE.negrita,
    color: COLORES.texto,
  },
  // Sin relleno vertical ni contorno: el bloque tintado se distingue solo y la fila no crece.
  aviso: {
    paddingHorizontal: ESPACIADO.sm,
    paddingVertical: ESPACIADO.xs,
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
    fontFamily: FUENTE.negrita,
    color: COLORES.textoSecundario,
  },
  marcaEnvioRechazada: {
    color: COLORES.error,
  },
  textoAviso: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.medio,
    color: COLORES.discrepanciaTexto,
  },
  textoAvisoError: {
    color: COLORES.errorTexto,
  },
});

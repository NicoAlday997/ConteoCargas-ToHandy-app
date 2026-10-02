import { memo, useEffect, useRef } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Glifo, Palomita, Pulsable } from '../componentes/base';
import {
  ALTO_CONTROL,
  BORDES,
  CIFRAS,
  COLORES,
  ESCALA_PRESIONADO_CONTROL,
  ESCALA_TEXTO,
  ESPACIADO,
  FUENTE,
  MOVIMIENTO,
  OPACIDAD,
  RADIOS,
  radioInterior,
  ROTULO,
  SOMBRAS,
  TIPOGRAFIA,
  TOQUE_MINIMO,
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
const DURACION_DESTELLO_MS = MOVIMIENTO.destello;
const OPACIDAD_DESTELLO = 0.3;
/** Ancho mínimo del visor: "9999" en la lectura y "NO LLEVA" en su rótulo; lo más largo lo ensancha. */
const ANCHO_VISOR = 96;
/** El 0 es un círculo del toque mínimo: la forma dice "un solo toque, nada que capturar". */
const LADO_CERO = TOQUE_MINIMO;
/** La palomita de "contado" va en un círculo verde: forma y color. */
const LADO_PALOMITA = ESPACIADO.xl;
/**
 * Ancho MÍNIMO de la pastilla del factor, para que quede en columna al
 * recorrer la lista: cuatro caracteres ("C/10", "CAJA") con holgura a tamaño
 * completo, escalado con el texto del sistema hasta el mismo tope que la letra.
 * Es un mínimo, no un tope: si el texto no cabe, la pastilla se ensancha; la
 * letra nunca se encoge.
 */
const EM_CUATRO_CARACTERES = 3.5;
const RELLENO_FACTOR = ESPACIADO.sm;

function anchoFactor(tamanoLetra: number, escalaTexto: number): number {
  const escala = Math.min(escalaTexto, ESCALA_TEXTO.control);
  return (
    Math.ceil(EM_CUATRO_CARACTERES * tamanoLetra * escala) + 2 * RELLENO_FACTOR
  );
}

/** Unidad de un producto completo de más de 6 letras: sus primeras 5, sin puntos; el nombre está al lado. */
const MAX_UNIDAD_FACTOR = 6;

/** "Cajas" para lo que se vende completo; "Paquetes" / "Sueltas" para lo demás. */
export function nombreCampo(
  producto: ProductoConteo,
  campo: CampoCaptura,
): string {
  if (campo === 'sueltas') return 'Sueltas';
  if (!seVendeCompleto(producto)) return 'Paquetes';
  const plural = unidadEnPlural(producto.unidadDescripcion);
  return plural.charAt(0).toUpperCase() + plural.slice(1);
}

/**
 * Cómo se ve una fila. El estado MANDA y tiñe la fila completa (fondo, borde,
 * total, pastilla del factor); el color de la familia nunca entra aquí.
 * - sin-contar: el estado NORMAL al abrir una carga, no un aviso: neutro, sin
 *   ámbar. El color aparece conforme se avanza; el ámbar queda para los avisos
 *   dentro de la fila (empaque sin confirmar, sueltas, rechazo).
 * - contado: con cantidad.
 * - no-lleva: marcado en cero; se retira.
 * - tecleando: la fila entera en azul noche; imposible perder dónde vas.
 */
export type AspectoFila = 'sin-contar' | 'contado' | 'no-lleva' | 'tecleando';

const ASPECTO_DE_ESTADO: Record<EstadoFila, AspectoFila> = {
  'sin-capturar': 'sin-contar',
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
  /**
   * El visor: la lectura de la báscula. Vacío es un marco punteado; con
   * lectura es un bloque sólido (encendido en azul cuando está contado). Se
   * distingue por FORMA (hueco o lleno), no solo por tinte.
   */
  visorFondo: string;
  visorBorde: string;
  visorPunteado: boolean;
}

/** Contorno de la fila contada: azul claro, se separa del fondo sin competir con el visor. */
const BORDE_CONTADO = '#9DB8F6';

const COLORES_ASPECTO: Record<AspectoFila, ColoresAspecto> = {
  'sin-contar': {
    fondo: COLORES.superficie,
    borde: COLORES.bordeSinContar,
    nombre: COLORES.texto,
    total: COLORES.textoTerciario,
    unidad: COLORES.textoSecundario,
    factorFondo: COLORES.superficieHonda,
    factorTexto: COLORES.textoSecundario,
    campo: COLORES.superficieHonda,
    campoTexto: COLORES.texto,
    visorFondo: COLORES.superficie,
    visorBorde: COLORES.bordeSinContar,
    visorPunteado: true,
  },
  // Contado: la fila se tiñe de azul suave y el visor se enciende (azul señal plano).
  contado: {
    fondo: COLORES.azulSuave,
    borde: BORDE_CONTADO,
    nombre: COLORES.texto,
    total: COLORES.textoSobreColor,
    unidad: COLORES.textoSobreColor,
    factorFondo: COLORES.accion,
    factorTexto: COLORES.textoSobreColor,
    campo: COLORES.superficie,
    campoTexto: COLORES.texto,
    visorFondo: COLORES.accion,
    visorBorde: COLORES.accion,
    visorPunteado: false,
  },
  'no-lleva': {
    fondo: COLORES.pendienteFondo,
    borde: COLORES.bordeNoLleva,
    nombre: COLORES.pendiente,
    total: COLORES.textoSobreColor,
    unidad: COLORES.textoSobreColor,
    factorFondo: COLORES.superficie,
    factorTexto: COLORES.pendiente,
    campo: COLORES.superficie,
    campoTexto: COLORES.pendiente,
    visorFondo: COLORES.pendiente,
    visorBorde: COLORES.pendiente,
    visorPunteado: false,
  },
  tecleando: {
    fondo: COLORES.marca,
    borde: COLORES.marca,
    nombre: COLORES.textoSobreColor,
    total: COLORES.textoSobreColor,
    unidad: COLORES.marcaTenue,
    factorFondo: COLORES.marcaClara,
    factorTexto: COLORES.textoSobreColor,
    campo: COLORES.marcaHonda,
    campoTexto: COLORES.textoSobreColor,
    visorFondo: COLORES.marcaHonda,
    visorBorde: COLORES.marcaClara,
    visorPunteado: false,
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
  const { fontScale } = useWindowDimensions();
  const ancho = anchoFactor(
    grande ? estilos.textoFactorGrande.fontSize : estilos.textoFactor.fontSize,
    fontScale,
  );
  let texto: string;
  let accesible: string;
  if (seVendeCompleto(producto)) {
    const unidad = unidadEnSingular(producto.unidadDescripcion);
    texto =
      unidad.length > MAX_UNIDAD_FACTOR
        ? unidad.slice(0, 5).toUpperCase()
        : unidad.toUpperCase();
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
      style={[
        estilos.factor,
        grande && estilos.factorGrande,
        { minWidth: ancho, backgroundColor: fondo },
      ]}
      accessible
      accessibilityLabel={accesible}
    >
      <Text
        style={[
          grande ? estilos.textoFactorGrande : estilos.textoFactor,
          { color },
        ]}
        numberOfLines={1}
        maxFontSizeMultiplier={ESCALA_TEXTO.control}
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

function FilaProductoBase({
  producto,
  captura,
  campoActivo,
  envio,
  errorEnvio,
  onAbrirCampo,
  onCero,
}: Props) {
  const factor = factorEfectivo(producto);
  const completo = seVendeCompleto(producto);
  const conPaquetes = admitePaquetes(producto);
  // Si se capturaron sueltas antes de confirmarlo como completo, el campo sigue
  // a la vista para poder borrarlas: el servidor las rechaza y hay que corregir.
  const conSueltas = admiteSueltas(producto) || (captura.sueltas ?? 0) > 0;
  const estado = estadoFila(captura, producto);
  const aspecto: AspectoFila =
    campoActivo !== null ? 'tecleando' : ASPECTO_DE_ESTADO[estado];
  const colores = COLORES_ASPECTO[aspecto];
  const total = totalPiezas(captura, producto);
  const avisoSueltas = sueltasExcedenPaquete(captura.sueltas, factor);
  const destello = useDestello(estado);
  const nombre = formatearNombreProducto(producto.nombre);
  const unidadTotal = completo
    ? unidadEnPlural(producto.unidadDescripcion)
    : 'piezas';

  // Con cantidad, el "0" se bloquea: un toque perdido al pasar de fila no debe
  // borrar lo que ya se contó. Para corregir a cero se usa el teclado.
  const ceroBloqueado = estado === 'con-cantidad';

  // Con lector de pantalla la fila es UNA parada, con acciones (deslizar
  // arriba/abajo en TalkBack, rotor en VoiceOver): 73 productos no pueden
  // costar ~6 gestos cada uno. Lo visual no cambia.
  const acciones = [
    ...(conPaquetes
      ? [
          {
            name: 'paquetes',
            label: `Capturar ${nombreCampo(producto, 'paquetes')}`,
          },
        ]
      : []),
    ...(conSueltas ? [{ name: 'sueltas', label: 'Capturar sueltas' }] : []),
    ...(ceroBloqueado
      ? []
      : [{ name: 'noLleva', label: 'No lleva, marcar en cero' }]),
  ];
  const vozFila = [
    nombre,
    aspecto === 'tecleando'
      ? 'capturando'
      : estado === 'sin-capturar'
        ? 'sin contar'
        : estado === 'en-cero'
          ? 'no lleva'
          : 'contado',
    conPaquetes && captura.paquetes !== null
      ? `${nombreCampo(producto, 'paquetes')} ${captura.paquetes}`
      : null,
    conSueltas && captura.sueltas !== null
      ? `sueltas ${captura.sueltas}`
      : null,
    estado === 'con-cantidad'
      ? textoTotalAccesible(total, estado, unidadTotal)
      : null,
    envio === 'por-enviar'
      ? 'por enviar'
      : envio === 'rechazado'
        ? `no se aceptó: ${errorEnvio ?? 'revisa la cantidad'}`
        : null,
    !producto.factorConfirmado ? 'empaque sin confirmar' : null,
    avisoSueltas ? 'las sueltas ya completan un paquete' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View
      style={[
        estilos.fila,
        { backgroundColor: colores.fondo, borderColor: colores.borde },
        aspecto === 'no-lleva'
          ? null
          : aspecto === 'tecleando'
            ? estilos.filaTecleando
            : estilos.filaElevada,
      ]}
      accessible
      accessibilityLabel={vozFila}
      accessibilityHint={
        conPaquetes || conSueltas
          ? 'Toca dos veces para capturar. Más acciones con el gesto de acciones.'
          : undefined
      }
      accessibilityActions={[{ name: 'activate' }, ...acciones]}
      onAccessibilityAction={({ nativeEvent }) => {
        const accion = nativeEvent.actionName;
        if (accion === 'activate')
          onAbrirCampo(producto.code, conPaquetes ? 'paquetes' : 'sueltas');
        else if (accion === 'paquetes' || accion === 'sueltas')
          onAbrirCampo(producto.code, accion);
        else if (accion === 'noLleva') onCero(producto.code);
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          estilos.destello,
          { backgroundColor: COLOR_DESTELLO[estado] },
          destello,
        ]}
      />

      <View style={estilos.encabezado}>
        <EtiquetaFactor producto={producto} aspecto={aspecto} />
        <Text
          style={[estilos.nombre, { color: colores.nombre }]}
          numberOfLines={2}
          maxFontSizeMultiplier={ESCALA_TEXTO.compacto}
        >
          {nombre}
        </Text>
        <MarcaEnvio envio={envio} sobreMarca={aspecto === 'tecleando'} />
        {aspecto === 'contado' && envio !== 'rechazado' && (
          <View style={estilos.circuloPalomita}>
            <Palomita color={COLORES.textoSobreColor} tamano={ESPACIADO.lg} />
          </View>
        )}
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

        <View
          style={[
            estilos.visor,
            {
              backgroundColor: colores.visorFondo,
              borderColor: colores.visorBorde,
            },
            colores.visorPunteado && estilos.visorVacio,
          ]}
          accessible
          accessibilityLabel={textoTotalAccesible(total, estado, unidadTotal)}
        >
          <Text
            style={[
              estilos.numeroTotal,
              { color: colores.total },
              estado === 'sin-capturar' && estilos.numeroVacio,
            ]}
            numberOfLines={1}
            maxFontSizeMultiplier={ESCALA_TEXTO.control}
          >
            {total === null ? '—' : total}
          </Text>
          <Text
            style={[
              estilos.unidadTotal,
              { color: colores.unidad },
              estado === 'sin-capturar' && estilos.unidadVacia,
            ]}
            numberOfLines={1}
            maxFontSizeMultiplier={ESCALA_TEXTO.control}
          >
            {estado === 'en-cero' && aspecto !== 'tecleando'
              ? 'No lleva'
              : unidadTotal}
          </Text>
        </View>

        <Pulsable
          onPress={() => onCero(producto.code)}
          disabled={ceroBloqueado}
          tacto="seleccion"
          accessibilityRole="button"
          accessibilityLabel={`${nombre}: no lleva, marcar en cero`}
          accessibilityState={{
            disabled: ceroBloqueado,
            selected: estado === 'en-cero',
          }}
          hitSlop={ESPACIADO.xs}
          escala={ESCALA_PRESIONADO_CONTROL - 0.04}
          style={({ pressed }) => [
            estilos.botonCero,
            aspecto === 'tecleando' && estilos.botonCeroSobreMarca,
            estado === 'en-cero' &&
              aspecto !== 'tecleando' &&
              estilos.botonCeroMarcado,
            pressed && estilos.botonCeroPresionado,
            ceroBloqueado && estilos.botonCeroBloqueado,
          ]}
        >
          {({ pressed }) => (
            <Text
              style={[
                estilos.textoCero,
                (pressed || aspecto === 'tecleando') && estilos.textoInvertido,
                estado === 'en-cero' &&
                  aspecto !== 'tecleando' &&
                  !pressed &&
                  estilos.textoCeroMarcado,
              ]}
              maxFontSizeMultiplier={ESCALA_TEXTO.control}
            >
              0
            </Text>
          )}
        </Pulsable>
      </View>

      {!producto.factorConfirmado && (
        <Aviso texto="Empaque sin confirmar: cuéntalo en sueltas y avisa al supervisor." />
      )}
      {avisoSueltas && factor !== null && (
        <Aviso
          texto={`${captura.sueltas} sueltas ya completan un paquete de ${factor}. ¿Venía abierto?`}
        />
      )}
      {envio === 'rechazado' && (
        <Aviso
          texto={`No se aceptó: ${errorEnvio ?? 'revisa la cantidad'}. Vuelve a capturarlo.`}
          error
        />
      )}
    </View>
  );
}

export const FilaProducto = memo(FilaProductoBase);

function textoTotalAccesible(
  total: number | null,
  estado: EstadoFila,
  unidad: string,
): string {
  if (estado === 'sin-capturar') return 'Sin capturar';
  if (total === null) return 'Total no calculable';
  return `Total ${total} ${unidad}`;
}

const COLOR_DESTELLO: Record<EstadoFila, string> = {
  'sin-capturar': COLORES.pendiente,
  'con-cantidad': COLORES.accion,
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
 * con los avisos ámbar de la fila, lo único que debe llamar la atención. El
 * estado general está en el encabezado; aquí solo se avisa lo que aún no
 * llegó (↑) o lo que el servidor rechazó (!). Lo enviado no lleva marca: la
 * palomita de "contado" ya dice que está.
 */
function MarcaEnvio({
  envio,
  sobreMarca,
}: {
  envio: EnvioFila;
  sobreMarca: boolean;
}) {
  if (envio === null || envio === 'enviado') return null;
  const porEnviar = envio === 'por-enviar';
  const accesible = porEnviar
    ? 'Guardado en el teléfono, por enviar'
    : 'No se aceptó';
  const color = sobreMarca
    ? COLORES.textoSobreColor
    : porEnviar
      ? COLORES.textoSecundario
      : COLORES.error;
  return (
    <View accessible accessibilityLabel={accesible}>
      <Glifo
        nombre={porEnviar ? 'subir' : 'alto'}
        color={color}
        tamano={ESPACIADO.lg + ESPACIADO.xs}
      />
    </View>
  );
}

/**
 * Bloque tintado con su texto oscuro: se lee con poca luz y no suma alto a la
 * fila. Es lo único ámbar de la lista de conteo, por eso destaca.
 */
function Aviso({ texto, error = false }: { texto: string; error?: boolean }) {
  const color = error ? COLORES.errorTexto : COLORES.discrepanciaTexto;
  return (
    <View style={[estilos.aviso, error && estilos.avisoError]}>
      <Glifo
        nombre={error ? 'alto' : 'alerta'}
        color={color}
        tamano={ESPACIADO.lg + 2}
      />
      <Text style={[estilos.textoAviso, error && estilos.textoAvisoError]}>
        {texto}
      </Text>
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
 * en blanco con el número oscuro sobre la fila azul noche, con un aro azul luminoso.
 */
function Campo({
  etiqueta,
  valor,
  activo,
  fondo,
  colorTexto,
  onPress,
  nombreProducto,
  aviso = false,
}: PropsCampo) {
  const color = activo ? COLORES.texto : colorTexto;
  return (
    <Pulsable
      onPress={onPress}
      tacto={null}
      repetible
      accessibilityRole="button"
      accessibilityLabel={`${nombreProducto}, ${etiqueta}: ${valor === null ? 'sin capturar' : valor}`}
      accessibilityState={{ selected: activo }}
      escala={ESCALA_PRESIONADO_CONTROL}
      style={({ pressed }) => [
        estilos.campo,
        { backgroundColor: activo ? COLORES.superficie : fondo },
        activo && estilos.campoActivo,
        aviso && estilos.campoConAviso,
        pressed && !activo && estilos.campoPresionado,
      ]}
    >
      <Text
        style={[estilos.etiquetaCampo, { color }]}
        numberOfLines={1}
        maxFontSizeMultiplier={ESCALA_TEXTO.control}
      >
        {etiqueta}
      </Text>
      <Text
        style={[
          estilos.valorCampo,
          { color },
          valor === null && estilos.valorVacio,
        ]}
        numberOfLines={1}
        maxFontSizeMultiplier={ESCALA_TEXTO.control}
      >
        {valor === null ? '—' : valor}
      </Text>
    </Pulsable>
  );
}

const BORDES_FILA = 1.5;

const estilos = StyleSheet.create({
  // El estado va en el fondo y el borde de toda la fila, y en el visor; todas
  // miden lo mismo en cualquier estado. Poco aire dentro; entre filas lo pone la lista.
  fila: {
    flex: 1,
    gap: ESPACIADO.sm + 2,
    padding: ESPACIADO.md,
    borderRadius: RADIOS.pieza,
    borderWidth: BORDES_FILA,
  },
  filaElevada: {
    boxShadow: SOMBRAS.tarjeta,
  },
  filaTecleando: {
    boxShadow: SOMBRAS.elevada,
  },
  destello: {
    borderRadius: radioInterior(RADIOS.pieza, BORDES_FILA),
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
    minHeight: TIPOGRAFIA.subtitulo.lineHeight + ESPACIADO.xs,
  },
  // El nombre domina la cabecera: es lo que se busca con la mirada.
  nombre: {
    flex: 1,
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.extraNegrita,
  },
  circuloPalomita: {
    width: LADO_PALOMITA,
    height: LADO_PALOMITA,
    borderRadius: RADIOS.completo,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.capturadoHondo,
  },
  // La pastilla del empaque: esquina suave, del mismo ancho en todas las filas.
  // Sin encogerse: el nombre al lado (flex: 1) no le quita ancho.
  factor: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: RELLENO_FACTOR,
    paddingVertical: 2,
    borderRadius: RADIOS.chico,
  },
  factorGrande: {
    paddingVertical: ESPACIADO.xs,
  },
  textoFactor: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.extraNegrita,
    fontSize: 14,
    letterSpacing: 0.2,
    ...CIFRAS,
  },
  textoFactorGrande: {
    ...TIPOGRAFIA.tituloBarra,
    fontFamily: FUENTE.extraNegrita,
    ...CIFRAS,
  },
  captura: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: ESPACIADO.sm,
  },
  campos: {
    flex: 1,
    flexDirection: 'row',
    gap: ESPACIADO.sm,
  },
  // El rótulo arriba y el número abajo, ambos a la derecha: los campos forman
  // columnas de números alineados (120 sobre 99), como en una hoja de conteo.
  campo: {
    flex: 1,
    minHeight: ALTO_CONTROL,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.sm + 2,
    borderRadius: RADIOS.medio,
  },
  // El campo que se teclea: blanco sobre la fila azul noche, con aro azul luminoso.
  // Es el único así en la pantalla.
  campoActivo: {
    borderWidth: BORDES.grueso,
    borderColor: COLORES.accionViva,
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
  // La lectura de la báscula. No es tocable y no debe parecerlo: sin chevron ni
  // relieve; es un bloque de dato, como el visor de una báscula de piso.
  // Ancho mínimo, sin tope: un total o una unidad que no caben ensanchan el
  // visor (los campos al lado ceden), nunca se encoge la letra.
  visor: {
    minWidth: ANCHO_VISOR,
    flexShrink: 0,
    minHeight: ALTO_CONTROL,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.sm + 2,
    borderRadius: RADIOS.medio,
    borderWidth: BORDES.medio,
    // Fondo plano por estado (`visorFondo`), sin degradado: el total blanco no depende de un hijo pintado.
    overflow: 'hidden',
  },
  visorVacio: {
    borderStyle: 'dashed',
  },
  numeroTotal: {
    ...TIPOGRAFIA.total,
    textAlign: 'right',
    ...CIFRAS,
  },
  numeroVacio: {
    color: COLORES.textoTerciario,
    fontFamily: FUENTE.regular,
  },
  unidadTotal: {
    ...ROTULO,
    textAlign: 'right',
  },
  unidadVacia: {
    color: COLORES.textoSecundario,
  },
  botonCero: {
    width: LADO_CERO,
    height: LADO_CERO,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.medio,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.completo,
  },
  botonCeroSobreMarca: {
    backgroundColor: 'transparent',
    borderColor: COLORES.marcaTenue,
  },
  // Marcado: se hunde en el gris de la fila; el visor ya dice "No lleva".
  botonCeroMarcado: {
    backgroundColor: COLORES.superficie,
    borderColor: COLORES.pendiente,
  },
  // Inversión completa: se nota aun con poca luz.
  botonCeroPresionado: {
    backgroundColor: COLORES.pendiente,
    borderColor: COLORES.pendiente,
  },
  botonCeroBloqueado: {
    opacity: OPACIDAD.bloqueado,
  },
  textoCero: {
    ...TIPOGRAFIA.campo,
    color: COLORES.texto,
  },
  textoCeroMarcado: {
    color: COLORES.pendiente,
  },
  // Rombo y texto: el aviso se reconoce por su forma aun sin distinguir el amarillo.
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.sm,
    paddingVertical: ESPACIADO.xs + 2,
    backgroundColor: COLORES.discrepanciaFondo,
    borderRadius: RADIOS.medio,
    borderWidth: BORDES.fino,
    borderColor: COLORES.discrepanciaHonda,
  },
  avisoError: {
    backgroundColor: COLORES.errorFondo,
    borderColor: COLORES.error,
  },
  textoAviso: {
    flex: 1,
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.medio,
    color: COLORES.discrepanciaTexto,
  },
  textoAvisoError: {
    color: COLORES.errorTexto,
  },
});

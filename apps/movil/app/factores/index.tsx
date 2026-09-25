import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import type { ConfirmacionFactor, ModalidadVentaApi } from '../../src/api/factores';
import {
  ErrorFamilia,
  useCargasEnCurso,
  useConfirmarFactor,
  useConfirmarFamilia,
  useFactoresCatalogo,
  useFactoresPendientes,
  type ProgresoFamilia,
} from '../../src/api/hooks-factores';
import { cerrarSesion, obtenerUsuarioSesion, type UsuarioSesion } from '../../src/api/sesion';
import {
  BloqueError,
  Boton,
  CampoTexto,
  Datos,
  Encabezado,
  EstadoVacio,
  Esqueleto,
  Etiqueta,
  FilaMenu,
  GrupoMenu,
  LineaEsqueleto,
  NotaEncabezado,
  Tarjeta,
  TarjetaEsqueleto,
  type Dato,
} from '../../src/componentes/base';
import { TecladoPin } from '../../src/componentes/TecladoPin';
import { diaNegocio, formatearDia } from '../../src/conteo/fecha-operativa';
import {
  contarPendientes,
  esMismoEmpaque,
  filtrarCatalogo,
  MAX_DIGITOS_PIEZAS,
  piezasDesdeTexto,
  PIEZAS_MAXIMO,
  PIEZAS_MINIMO,
  planFamilia,
  productoAConfirmar,
  resumenConfirmacion,
  resumenPorPiezaDe,
  textoCargas,
  textoEmpaque,
  textoProductos,
  type Familia,
  type FamiliaCatalogo,
  type FamiliaPendiente,
  type ProductoAConfirmar,
  type ProductoCatalogo,
  type ProductoConConfirmacion,
  type ProductoPendiente,
} from '../../src/factores/modelo-factores';
import { ANCHO_MAXIMO_LISTA, BarraSuperior, volver } from '../../src/historial/ComponentesHistorial';
import {
  ANCHO_MODAL,
  BORDES,
  CIFRAS,
  COLORES,
  ESPACIADO,
  PESOS,
  RADIOS,
  RITMO,
  ROTULO,
  TIPOGRAFIA,
  TOQUE_MINIMO,
} from '../../src/theme/tokens';

/**
 * Confirmación del empaque de cada producto (solo Supervisor). Decide cómo se
 * convierte lo contado en lo que se envía a Handy: el nombre "CANELS. c/70"
 * sugería 70 y habría mandado 350 piezas por 5 bolsas. Por eso primero se
 * pregunta CÓMO se vende y solo después, si aplica, cuántas piezas trae; y
 * antes de guardar se dice en palabras qué va a pasar.
 *
 * Dos pestañas: lo que falta confirmar y el catálogo completo. Una
 * confirmación equivocada corrompe en silencio todos los conteos del
 * producto, así que cualquier producto se puede corregir; al hacerlo se
 * advierte qué afecta y cuántas cargas sin enviar ya lo contaron.
 */

const TITULO = 'Empaque de productos';
/** El modal con teclado es tan angosto como el del PIN: el teclado se ve igual. */
const ANCHO_MODAL_TECLADO = ANCHO_MODAL - ESPACIADO.xl - ESPACIADO.lg;
/** El botón de acciones de familia no hace crecer su encabezado: mide lo que el título. */
const ALTO_BOTON_ACCIONES = ESPACIADO.xxl;

function sesionVencida() {
  void cerrarSesion().then(() => router.replace('/login'));
}

/** Qué decir de un error del servidor o de la red. */
function detalleError(e: unknown): { titulo: string; detalle: string; sinRed: boolean } {
  if (e instanceof ErrorRed) {
    return {
      titulo: 'Sin conexión',
      detalle: 'Los empaques se guardan en el servidor: revisa tu señal y vuelve a intentarlo.',
      sinRed: true,
    };
  }
  return {
    titulo: 'No se pudo guardar',
    detalle: e instanceof Error && e.message ? e.message : 'Intenta de nuevo en un momento.',
    sinRed: false,
  };
}

export default function PantallaFactores() {
  // `undefined` mientras se lee la sesión.
  const [usuario, setUsuario] = useState<UsuarioSesion | null | undefined>(undefined);

  useEffect(() => {
    let vigente = true;
    void obtenerUsuarioSesion().then((sesion) => {
      if (vigente) setUsuario(sesion);
    });
    return () => {
      vigente = false;
    };
  }, []);

  if (usuario === undefined) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <BarraSuperior titulo={TITULO} />
        <EsqueletoLista />
      </SafeAreaView>
    );
  }

  if (usuario === null) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <BarraSuperior titulo={TITULO} />
        <EstadoVacio
          icono="candado"
          titulo="Tu sesión terminó"
          detalle="Entra de nuevo con tu PIN para confirmar empaques."
          accion={{ texto: 'Entrar', onPress: () => router.replace('/login') }}
        />
      </SafeAreaView>
    );
  }

  if (usuario.rolApp !== 'SUPERVISOR') {
    return <SinAcceso />;
  }

  return <ListaFactores />;
}

function SinAcceso() {
  return (
    <SafeAreaView style={estilos.pantalla}>
      <BarraSuperior titulo={TITULO} />
      <EstadoVacio
        icono="candado"
        titulo="Solo el supervisor confirma empaques"
        detalle="Cómo se vende cada producto decide lo que se envía a Handy. Si un producto se cuenta raro, avisa a tu supervisor."
        accion={{ texto: 'Volver', onPress: volver }}
      />
    </SafeAreaView>
  );
}

type Pestana = 'pendientes' | 'todos';

function ListaFactores() {
  const [pestana, setPestana] = useState<Pestana>('pendientes');
  const consultaPendientes = useFactoresPendientes(true);
  // El catálogo se pide al abrir su pestaña; después queda en caché.
  const consultaCatalogo = useFactoresCatalogo(pestana === 'todos');
  const pendientes = contarPendientes(consultaPendientes.data ?? []);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState<ProductoAConfirmar | null>(null);
  const [familiaAbierta, setFamiliaAbierta] = useState<FamiliaPendiente | null>(null);

  const estados = [consultaPendientes.error, consultaCatalogo.error].map((e) => (e instanceof ErrorApi ? e.estado : null));
  const sinSesion = estados.includes(401);
  useEffect(() => {
    if (sinSesion) sesionVencida();
  }, [sinSesion]);

  if (estados.includes(403)) return <SinAcceso />;

  return (
    <SafeAreaView style={estilos.pantalla}>
      <BarraSuperior
        titulo={TITULO}
        subtitulo={consultaPendientes.data && pendientes > 0 ? `${textoProductos(pendientes)} por confirmar` : null}
      >
        <NotaEncabezado>
          {pestana === 'pendientes'
            ? 'Mientras no se confirmen, esos productos solo se cuentan por pieza.'
            : 'Toca cualquier producto para corregir cómo se vende.'}
        </NotaEncabezado>
      </BarraSuperior>
      <Pestanas pestana={pestana} pendientes={consultaPendientes.data ? pendientes : null} onCambiar={setPestana} />
      {pestana === 'pendientes' ? (
        <ContenidoPendientes
          consulta={consultaPendientes}
          onElegir={(p) => setSeleccionado({ ...p, actual: null })}
          onAccionesFamilia={setFamiliaAbierta}
          onVerTodos={() => setPestana('todos')}
        />
      ) : (
        <ContenidoCatalogo
          consulta={consultaCatalogo}
          busqueda={busqueda}
          onBuscar={setBusqueda}
          onElegir={(p) => setSeleccionado(productoAConfirmar(p))}
        />
      )}
      <ModalConfirmarProducto producto={seleccionado} onCerrar={() => setSeleccionado(null)} />
      <ModalFamilia familia={familiaAbierta} onCerrar={() => setFamiliaAbierta(null)} />
    </SafeAreaView>
  );
}

/** Lo mínimo de una consulta de lista que necesitan las dos pestañas. */
interface ConsultaLista<T> {
  data: Familia<T>[] | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}

function useRefrescar(consulta: { refetch: () => Promise<unknown> }) {
  const [refrescando, setRefrescando] = useState(false);
  const refrescar = () => {
    setRefrescando(true);
    void consulta.refetch().finally(() => setRefrescando(false));
  };
  return { refrescando, refrescar };
}

/** El error de cargar una lista, a pantalla completa (solo si no hay nada que mostrar). */
function ErrorLista({ consulta }: { consulta: ConsultaLista<unknown> }) {
  const sinRed = consulta.error instanceof ErrorRed;
  return (
    <View style={estilos.contenedorAviso}>
      <BloqueError
        titulo={sinRed ? 'Sin conexión' : 'No se pudieron cargar los productos'}
        detalle={
          sinRed
            ? 'La lista de empaques se consulta en el servidor: revisa tu señal y vuelve a intentarlo.'
            : consulta.error instanceof Error && consulta.error.message
              ? consulta.error.message
              : 'Intenta de nuevo en un momento.'
        }
        tono={sinRed ? 'atencion' : 'error'}
        onReintentar={() => void consulta.refetch()}
        reintentando={consulta.isFetching}
      />
    </View>
  );
}

function Pestanas({
  pestana,
  pendientes,
  onCambiar,
}: {
  pestana: Pestana;
  /** `null` mientras no se sabe cuántos son. */
  pendientes: number | null;
  onCambiar: (p: Pestana) => void;
}) {
  const opciones: { valor: Pestana; texto: string; contador: number | null }[] = [
    { valor: 'pendientes', texto: 'Por confirmar', contador: pendientes },
    { valor: 'todos', texto: 'Todos los productos', contador: null },
  ];
  return (
    <View style={estilos.pestanas} accessibilityRole="tablist">
      {opciones.map((o) => {
        const activa = pestana === o.valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onCambiar(o.valor)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
            accessibilityLabel={o.contador !== null ? `${o.texto}: ${textoProductos(o.contador)}` : o.texto}
            style={({ pressed }) => [estilos.pestana, activa && estilos.pestanaActiva, pressed && !activa && estilos.pestanaPresionada]}
          >
            <Text style={[estilos.textoPestana, activa && estilos.textoPestanaActiva]} numberOfLines={1}>
              {o.texto}
              {o.contador !== null && o.contador > 0 ? ` (${o.contador})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ContenidoPendientes({
  consulta,
  onElegir,
  onAccionesFamilia,
  onVerTodos,
}: {
  consulta: ConsultaLista<ProductoPendiente>;
  onElegir: (p: ProductoPendiente) => void;
  onAccionesFamilia: (f: FamiliaPendiente) => void;
  onVerTodos: () => void;
}) {
  const familias = consulta.data ?? [];
  const { refrescando, refrescar } = useRefrescar(consulta);

  if (consulta.isPending) return <EsqueletoLista />;
  if (consulta.isError && familias.length === 0) return <ErrorLista consulta={consulta} />;
  if (familias.length === 0) {
    return (
      <EstadoVacio
        icono="listo"
        tono="capturado"
        titulo="Todos los productos tienen su empaque confirmado"
        detalle="Cuando la sincronización con Handy traiga productos nuevos, aparecerán aquí. Para corregir uno ya confirmado, búscalo en todos los productos."
        accion={{ texto: 'Ver todos los productos', onPress: onVerTodos }}
        secundaria={{ texto: 'Actualizar', onPress: refrescar }}
      />
    );
  }
  return (
    <SectionList<ProductoPendiente, FamiliaPendiente>
      style={estilos.lista}
      contentContainerStyle={estilos.contenidoLista}
      sections={familias}
      keyExtractor={(p) => p.code}
      // Fijo, el encabezado taparía parte de los productos.
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <EncabezadoFamilia familia={section} porConfirmar onAcciones={() => onAccionesFamilia(section)} />
      )}
      renderItem={({ item }) => <FilaPendiente producto={item} onPress={() => onElegir(item)} />}
      refreshing={refrescando}
      onRefresh={refrescar}
    />
  );
}

function ContenidoCatalogo({
  consulta,
  busqueda,
  onBuscar,
  onElegir,
}: {
  consulta: ConsultaLista<ProductoCatalogo>;
  busqueda: string;
  onBuscar: (texto: string) => void;
  onElegir: (p: ProductoCatalogo) => void;
}) {
  const { refrescando, refrescar } = useRefrescar(consulta);
  const familias = useMemo(() => filtrarCatalogo(consulta.data ?? [], busqueda), [consulta.data, busqueda]);
  const encontrados = contarPendientes(familias);

  let lista;
  if (consulta.isPending) {
    lista = <EsqueletoLista />;
  } else if (consulta.isError && !consulta.data?.length) {
    lista = <ErrorLista consulta={consulta} />;
  } else if (familias.length === 0) {
    lista = busqueda.trim() ? (
      <EstadoVacio
        icono="caja"
        titulo={`Ningún producto coincide con “${busqueda.trim()}”`}
        detalle="Prueba con una parte del nombre, como “pepsi” o “c/12”."
        accion={{ texto: 'Borrar búsqueda', onPress: () => onBuscar('') }}
      />
    ) : (
      <EstadoVacio
        icono="caja"
        titulo="No hay productos activos"
        detalle="Sincroniza el catálogo con Handy para traerlos."
        accion={{ texto: 'Actualizar', onPress: refrescar, cargando: refrescando, textoCargando: 'Actualizando…' }}
      />
    );
  } else {
    lista = (
      <SectionList<ProductoCatalogo, FamiliaCatalogo>
        style={estilos.lista}
        contentContainerStyle={estilos.contenidoLista}
        sections={familias}
        keyExtractor={(p) => p.code}
        stickySectionHeadersEnabled={false}
        // Tocar un producto con el teclado abierto lo abre a la primera.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderSectionHeader={({ section }) => <EncabezadoFamilia familia={section} />}
        renderItem={({ item }) => <FilaCatalogo producto={item} onPress={() => onElegir(item)} />}
        refreshing={refrescando}
        onRefresh={refrescar}
      />
    );
  }

  return (
    <>
      {/* Fuera de la lista: si viviera en su encabezado, cada letra lo redibujaría y perdería el foco. */}
      <View style={estilos.buscador}>
        <CampoTexto
          etiqueta="Buscar producto"
          valor={busqueda}
          onCambiar={onBuscar}
          ejemplo="Nombre, familia o código"
          ayuda={busqueda.trim() && consulta.data ? `${textoProductos(encontrados)} encontrados` : null}
          maxLength={60}
        />
      </View>
      {lista}
    </>
  );
}

function EsqueletoLista() {
  return (
    <Esqueleto etiqueta="Cargando productos por confirmar" style={estilos.esqueleto}>
      <View style={estilos.encabezadoFamiliaEsqueleto}>
        <LineaEsqueleto nivel="titulo" ancho="45%" />
      </View>
      {[0, 1, 2].map((i) => (
        <TarjetaEsqueleto key={i} compacta lineas={['35%']} />
      ))}
    </Esqueleto>
  );
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

/**
 * Lo principal es la familia y cuánto le falta. Confirmarla entera va después
 * en jerarquía, pero es lo que evita confirmar decenas de productos uno por
 * uno: por eso es un botón con texto y color de marca, no un ícono de "más
 * opciones" que nadie nota.
 */
function EncabezadoFamilia({
  familia,
  porConfirmar = false,
  onAcciones,
}: {
  familia: Familia<unknown>;
  /** En la pestaña de pendientes la cantidad es lo que falta, no lo que hay. */
  porConfirmar?: boolean;
  onAcciones?: () => void;
}) {
  // Sin familia no hay nada en común entre ellos; con uno solo, basta su fila.
  // En el catálogo completo no hay acción de familia: corregir es uno por uno.
  const conAcciones = onAcciones !== undefined && familia.familia !== null && familia.data.length > 1;
  const cantidad = porConfirmar ? `${familia.data.length} por confirmar` : textoProductos(familia.data.length);
  return (
    <View style={estilos.encabezadoFamilia}>
      <View style={estilos.lineaFamilia} accessible accessibilityRole="header" accessibilityLabel={`${familia.titulo}: ${cantidad}`}>
        <Text style={estilos.textoFamilia} numberOfLines={2}>
          {familia.titulo}
        </Text>
        <Text style={estilos.cantidadFamilia}>{cantidad}</Text>
      </View>
      {conAcciones && (
        <Pressable
          onPress={onAcciones}
          accessibilityRole="button"
          accessibilityLabel={`Confirmar toda la familia ${familia.titulo}`}
          accessibilityHint="Abre las opciones para confirmar todos sus productos de una vez"
          // A lo ancho ya pasa de TOQUE_MINIMO; a lo alto se completa sin hacer crecer la fila.
          hitSlop={{ top: (TOQUE_MINIMO - ALTO_BOTON_ACCIONES) / 2, bottom: (TOQUE_MINIMO - ALTO_BOTON_ACCIONES) / 2 }}
          style={({ pressed }) => [estilos.botonAcciones, pressed && estilos.botonAccionesPresionado]}
        >
          {({ pressed }) => (
            <Text style={[estilos.textoBotonAcciones, pressed && estilos.textoInvertido]} numberOfLines={1}>
              Confirmar todos
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

/** Lo que el nombre sugiere, como dato sin confirmar; o que no trae número. */
function EtiquetaSugerido({ sugerido }: { sugerido: number | null }) {
  if (sugerido === null) {
    return <Etiqueta texto="Sin número en el nombre" tono="pendiente" />;
  }
  return (
    <Etiqueta
      texto={`Sugerido: ${sugerido} piezas`}
      tono="marca"
      relleno="contorno"
      accessibilityLabel={`El nombre sugiere ${sugerido} piezas por paquete, sin confirmar`}
    />
  );
}

function FilaPendiente({ producto, onPress }: { producto: ProductoPendiente; onPress: () => void }) {
  return (
    <Tarjeta
      compacta
      onPress={onPress}
      style={estilos.fila}
      accessibilityLabel={[
        producto.nombre,
        producto.familia ? `Familia ${producto.familia}` : 'Sin familia',
        producto.sugerido !== null ? `El nombre sugiere ${producto.sugerido} piezas` : 'El nombre no trae número de piezas',
      ].join('. ')}
      accessibilityHint="Confirmar cómo se vende"
    >
      <View style={estilos.lineaNombre}>
        <Text style={estilos.nombre} numberOfLines={2}>
          {producto.nombre}
        </Text>
        <Text style={estilos.flecha} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </View>
      <View style={estilos.lineaDatos}>
        <Text style={estilos.rotulo} numberOfLines={1}>
          {producto.familia ?? 'Sin familia'}
        </Text>
        <EtiquetaSugerido sugerido={producto.sugerido} />
      </View>
    </Tarjeta>
  );
}

/** Un producto del catálogo completo: su empaque en palabras y quién lo confirmó. */
function FilaCatalogo({ producto, onPress }: { producto: ProductoCatalogo; onPress: () => void }) {
  const empaque = textoEmpaque(producto.confirmado);
  const traza =
    producto.confirmado && producto.confirmadoPor
      ? `Confirmó ${producto.confirmadoPor}${producto.fechaConfirmacion ? ` · ${formatearDia(diaNegocio(producto.fechaConfirmacion))}` : ''}`
      : null;
  return (
    <Tarjeta
      compacta
      onPress={onPress}
      style={estilos.fila}
      accessibilityLabel={[producto.nombre, producto.familia ? `Familia ${producto.familia}` : 'Sin familia', empaque, traza]
        .filter(Boolean)
        .join('. ')}
      accessibilityHint={producto.confirmado ? 'Corregir cómo se vende' : 'Confirmar cómo se vende'}
    >
      <View style={estilos.lineaNombre}>
        <Text style={estilos.nombre} numberOfLines={2}>
          {producto.nombre}
        </Text>
        <Text style={estilos.flecha} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </View>
      <View style={estilos.lineaDatos}>
        <Text style={estilos.rotulo} numberOfLines={1}>
          {producto.familia ?? 'Sin familia'}
        </Text>
        <Etiqueta texto={empaque} tono={producto.confirmado ? 'marca' : 'pendiente'} />
      </View>
      {traza && (
        <Text style={estilos.traza} numberOfLines={1}>
          {traza}
        </Text>
      )}
    </Tarjeta>
  );
}

// ---------------------------------------------------------------------------
// Confirmación de un producto: cómo se vende → piezas (si aplica) → resumen
// ---------------------------------------------------------------------------

type Paso = 'modalidad' | 'piezas' | 'resumen';

function ModalConfirmarProducto({ producto, onCerrar }: { producto: ProductoAConfirmar | null; onCerrar: () => void }) {
  return (
    <Modal visible={producto !== null} transparent animationType="none" onRequestClose={onCerrar}>
      <View style={estilos.fondoModal}>
        <ScrollView contentContainerStyle={estilos.contenidoFondoModal} bounces={false}>
          {/* La clave reinicia los pasos al abrir otro producto. */}
          {producto && <FlujoConfirmacion key={producto.code} producto={producto} onCerrar={onCerrar} />}
        </ScrollView>
      </View>
    </Modal>
  );
}

function FlujoConfirmacion({ producto, onCerrar }: { producto: ProductoAConfirmar; onCerrar: () => void }) {
  const confirmar = useConfirmarFactor();
  // Se pregunta al abrir: al llegar al resumen ya se sabe si hay cargas afectadas.
  const cargasEnCurso = useCargasEnCurso(producto.code);
  const corrige = producto.actual !== null;
  const [paso, setPaso] = useState<Paso>('modalidad');
  const [modalidad, setModalidad] = useState<ModalidadVentaApi | null>(null);
  // La sugerencia precargada: la primera tecla la reemplaza.
  const [texto, setTexto] = useState(producto.sugerido !== null ? String(producto.sugerido) : '');
  const [reemplazar, setReemplazar] = useState(producto.sugerido !== null);

  const enviando = confirmar.isPending;
  const piezas = piezasDesdeTexto(texto);

  const cerrar = () => {
    if (!enviando) onCerrar();
  };

  const elegir = (m: ModalidadVentaApi) => {
    setModalidad(m);
    confirmar.reset();
    // Completo no pregunta número: el paquete es la unidad de venta.
    setPaso(m === 'COMPLETO' ? 'resumen' : 'piezas');
  };

  const guardar = () => {
    let confirmacion: ConfirmacionFactor;
    if (modalidad === 'COMPLETO') confirmacion = { modalidadVenta: 'COMPLETO' };
    else if (modalidad === 'POR_PIEZA' && piezas !== null) confirmacion = { modalidadVenta: 'POR_PIEZA', piezasPorPaquete: piezas };
    else return;
    confirmar.mutate(
      { code: producto.code, confirmacion },
      {
        onSuccess: onCerrar,
        onError: (e) => {
          if (e instanceof ErrorApi && e.estado === 401) sesionVencida();
        },
      },
    );
  };

  const alDigito = (digito: string) => {
    if (reemplazar) {
      setReemplazar(false);
      setTexto(digito === '0' ? '' : digito);
      return;
    }
    if (texto.length >= MAX_DIGITOS_PIEZAS) return;
    // Sin ceros a la izquierda: "012" no es un número que alguien quiso teclear.
    if (texto === '' && digito === '0') return;
    setTexto(texto + digito);
  };

  const alBorrar = () => {
    setReemplazar(false);
    setTexto((t) => t.slice(0, -1));
  };

  return (
    <View style={[estilos.modal, paso === 'piezas' && estilos.modalTeclado]}>
      <Text style={estilos.pasoIndicador}>
        {paso === 'modalidad' ? 'Paso 1' : paso === 'piezas' ? 'Paso 2' : 'Antes de guardar'}
      </Text>
      <Tarjeta elevacion={0} compacta>
        <Text style={estilos.nombreModal} numberOfLines={3}>
          {producto.nombre}
        </Text>
        {producto.familia && <Text style={estilos.rotulo}>{producto.familia}</Text>}
        {producto.actual && (
          <Text style={estilos.empaqueActual}>
            <Text style={estilos.negrita}>Hoy: </Text>
            {textoEmpaque(producto.actual)}
          </Text>
        )}
      </Tarjeta>

      {paso === 'modalidad' && (
        <>
          <Encabezado titulo="¿Cómo se vende este producto?" variante="plano" lineasTitulo={3} />
          <OpcionModalidad
            titulo="Se vende completo"
            descripcion="La bolsa o caja entera es una venta."
            ejemplo="Una bolsa de CANELS c/70 se vende completa, nunca 30 chicles sueltos."
            seleccionada={modalidad === 'COMPLETO'}
            onPress={() => elegir('COMPLETO')}
          />
          <OpcionModalidad
            titulo="Se vende por pieza"
            descripcion="El paquete se abre y se venden piezas sueltas."
            ejemplo="PEPSI 1.5 LT C/12 se abre y se venden botellas sueltas."
            seleccionada={modalidad === 'POR_PIEZA'}
            onPress={() => elegir('POR_PIEZA')}
          />
          <View style={estilos.botones}>
            <Boton texto="Cancelar" variante="secundario" onPress={cerrar} style={estilos.botonFila} />
          </View>
        </>
      )}

      {paso === 'piezas' && (
        <>
          <Encabezado titulo="¿Cuántas piezas trae el paquete?" variante="plano" lineasTitulo={3} />
          <View style={estilos.lineaVisor}>
            <View
              style={estilos.visor}
              accessible
              accessibilityLabel={`Piezas por paquete: ${texto === '' ? 'sin capturar' : texto}`}
              accessibilityLiveRegion="polite"
            >
              <Text style={[estilos.valorVisor, reemplazar && estilos.valorPorReemplazar]} numberOfLines={1}>
                {texto === '' ? '—' : texto}
              </Text>
            </View>
            <Text style={estilos.unidadVisor}>piezas por paquete</Text>
          </View>
          {/* Altura reservada: un aviso no debe mover el teclado bajo el dedo. */}
          <View style={estilos.zonaAviso} accessibilityLiveRegion="polite">
            <Text style={estilos.textoAviso}>
              {producto.sugerido === null
                ? 'El nombre no dice cuántas piezas trae: revisa un paquete.'
                : reemplazar
                  ? corrige
                    ? `${producto.sugerido} es lo confirmado hoy. Si no es correcto, teclea el número real.`
                    : `${producto.sugerido} sale del nombre. Si no es correcto, teclea el número real.`
                  : texto !== '' && piezas === null
                    ? `Debe ser de ${PIEZAS_MINIMO} a ${PIEZAS_MAXIMO} piezas.`
                    : ''}
            </Text>
          </View>
          <TecladoPin onDigito={alDigito} onBorrar={alBorrar} />
          <View style={estilos.botones}>
            <Boton texto="Atrás" variante="secundario" onPress={() => setPaso('modalidad')} style={estilos.botonFila} />
            <Boton
              texto="Continuar"
              onPress={() => {
                setReemplazar(false);
                setPaso('resumen');
              }}
              deshabilitado={piezas === null}
              style={estilos.botonFila}
            />
          </View>
        </>
      )}

      {paso === 'resumen' && modalidad !== null && (
        <>
          <Encabezado titulo="Revisa antes de guardar" variante="plano" />
          <ResumenModalidad modalidad={modalidad} piezas={modalidad === 'POR_PIEZA' ? piezas : null} />
          {modalidad === 'COMPLETO' && producto.sugerido !== null && !corrige && (
            <Text style={estilos.detalleModal}>
              El {producto.sugerido} del nombre no se usa: solo distingue este producto de otros parecidos.
            </Text>
          )}
          {esMismoEmpaque(producto.actual, modalidad, modalidad === 'POR_PIEZA' ? piezas : null) ? (
            <Text style={estilos.detalleModal}>Es el mismo empaque que ya tiene: guardar solo lo vuelve a confirmar.</Text>
          ) : (
            <>
              {producto.actual && <AvisoCambioConfirmado actual={producto.actual} />}
              <AvisoCargasEnCurso consulta={cargasEnCurso} />
            </>
          )}
          {confirmar.isError && !(confirmar.error instanceof ErrorApi && confirmar.error.estado === 401) && (
            <AvisoError error={confirmar.error} />
          )}
          <View style={estilos.botones}>
            <Boton
              texto="Atrás"
              variante="secundario"
              onPress={() => {
                confirmar.reset();
                setPaso(modalidad === 'COMPLETO' ? 'modalidad' : 'piezas');
              }}
              deshabilitado={enviando}
              style={estilos.botonFila}
            />
            <Boton
              texto={confirmar.isError ? 'Reintentar' : corrige ? 'Guardar cambio' : 'Guardar'}
              onPress={guardar}
              cargando={enviando}
              textoCargando="Guardando…"
              style={estilos.botonFila}
            />
          </View>
        </>
      )}
    </View>
  );
}

/** Antes de guardar un cambio sobre algo ya confirmado: qué afecta y qué no. */
function AvisoCambioConfirmado({ actual }: { actual: NonNullable<ProductoAConfirmar['actual']> }) {
  return (
    <Tarjeta tintada="discrepancia" compacta accessible>
      <Text style={estilos.tituloAviso}>Cambia un empaque ya confirmado</Text>
      <Text style={estilos.detalleModal}>
        Hoy: {textoEmpaque(actual)}. El cambio decide cómo se calculan los conteos de este producto de aquí en adelante. Lo ya
        enviado a Handy no se modifica.
      </Text>
    </Tarjeta>
  );
}

/**
 * Cargas sin enviar que ya contaron el producto: su total se calculó con el
 * empaque anterior y no se recalcula. No bloquea: el supervisor decide.
 */
function AvisoCargasEnCurso({ consulta }: { consulta: ReturnType<typeof useCargasEnCurso> }) {
  if (consulta.isPending) {
    return <Text style={estilos.textoAviso}>Revisando si hay cargas sin enviar con este producto…</Text>;
  }
  if (consulta.isError || consulta.data === null) {
    return (
      <Text style={estilos.textoAviso}>
        No se pudo revisar si hay cargas sin enviar con este producto. Si hay alguna, revísala antes de enviarla.
      </Text>
    );
  }
  const cantidad = consulta.data;
  if (cantidad === 0) return null;
  return (
    <Tarjeta tintada="discrepancia" compacta accessible>
      <Text style={estilos.tituloAviso}>
        {cantidad === 1 ? 'Hay 1 carga sin enviar' : `Hay ${textoCargas(cantidad)} sin enviar`} con este producto
      </Text>
      <Text style={estilos.detalleModal}>
        Sus conteos se calcularon con el empaque anterior y no se recalculan solos. Revísalas antes de enviarlas a Handy.
      </Text>
    </Tarjeta>
  );
}

interface PropsOpcion {
  titulo: string;
  descripcion: string;
  ejemplo: string;
  seleccionada: boolean;
  onPress: () => void;
}

/** Una opción grande: el contorno la marca como algo que se toca, igual que una tecla. */
function OpcionModalidad({ titulo, descripcion, ejemplo, seleccionada, onPress }: PropsOpcion) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: seleccionada }}
      accessibilityLabel={`${titulo}. ${descripcion} Ejemplo: ${ejemplo}`}
      style={({ pressed }) => [
        estilos.opcion,
        seleccionada && estilos.opcionSeleccionada,
        pressed && estilos.opcionPresionada,
      ]}
    >
      {({ pressed }) => (
        <>
          <Text style={[estilos.tituloOpcion, pressed && estilos.textoInvertido]}>{titulo}</Text>
          <Text style={[estilos.descripcionOpcion, pressed && estilos.textoInvertido]}>{descripcion}</Text>
          <Text style={[estilos.ejemploOpcion, pressed && estilos.textoInvertido]}>
            <Text style={estilos.rotuloEjemplo}>Ejemplo: </Text>
            {ejemplo}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Lo que se eligió y, en grande, lo que va a pasar con un conteo de ejemplo. */
function ResumenModalidad({ modalidad, piezas, deVarios = false }: { modalidad: ModalidadVentaApi; piezas: number | null; deVarios?: boolean }) {
  const datos: Dato[] = [{ rotulo: 'Cómo se vende', valor: modalidad === 'COMPLETO' ? 'Completo' : 'Por pieza' }];
  if (modalidad === 'POR_PIEZA') datos.push({ rotulo: 'Piezas por paquete', valor: piezas !== null ? String(piezas) : null, cifra: true });
  const frase = resumenConfirmacion(modalidad, piezas, deVarios);
  return (
    <Tarjeta tintada="marca" compacta accessible accessibilityLabel={`${datos.map((d) => `${d.rotulo}: ${d.valor}`).join('. ')}. ${frase}`}>
      <Datos datos={datos} />
      <Text style={estilos.fraseResumen}>{frase}</Text>
    </Tarjeta>
  );
}

// ---------------------------------------------------------------------------
// Toda una familia de una vez: menú (completos o por pieza) → confirmación
// ---------------------------------------------------------------------------

function ModalFamilia({ familia, onCerrar }: { familia: FamiliaPendiente | null; onCerrar: () => void }) {
  return (
    <Modal visible={familia !== null} transparent animationType="none" onRequestClose={onCerrar}>
      <View style={estilos.fondoModal}>
        <ScrollView contentContainerStyle={estilos.contenidoFondoModal} bounces={false}>
          {familia && <FlujoFamilia key={familia.titulo} familia={familia} onCerrar={onCerrar} />}
        </ScrollView>
      </View>
    </Modal>
  );
}

function FlujoFamilia({ familia, onCerrar }: { familia: FamiliaPendiente; onCerrar: () => void }) {
  // La lista de la familia al abrir: si alguien confirma uno mientras tanto, esto no cambia bajo el dedo.
  const [productos] = useState(familia.data);
  const [modalidad, setModalidad] = useState<ModalidadVentaApi | null>(null);

  if (modalidad === null) {
    return <MenuFamilia titulo={familia.titulo} productos={productos} onElegir={setModalidad} onCerrar={onCerrar} />;
  }
  return (
    <ConfirmacionFamilia
      titulo={familia.titulo}
      productos={productos}
      modalidad={modalidad}
      onAtras={() => setModalidad(null)}
      onCerrar={onCerrar}
    />
  );
}

function MenuFamilia({
  titulo,
  productos,
  onElegir,
  onCerrar,
}: {
  titulo: string;
  productos: readonly ProductoPendiente[];
  onElegir: (m: ModalidadVentaApi) => void;
  onCerrar: () => void;
}) {
  const total = productos.length;
  const { aConfirmar, sinNumero } = planFamilia(productos, 'POR_PIEZA');
  return (
    <View style={estilos.modal}>
      <Text style={estilos.pasoIndicador}>Toda la familia</Text>
      <Encabezado titulo={titulo} variante="plano" lineasTitulo={3} />
      <Text style={estilos.detalleModal}>
        {textoProductos(total)} por confirmar. Elige cómo se venden; antes de guardar se pide confirmar.
      </Text>
      <GrupoMenu>
        <FilaMenu
          texto="Todos se venden completos"
          detalle={`La bolsa o caja entera es una venta. Confirma ${textoProductos(total)}.`}
          onPress={() => onElegir('COMPLETO')}
        />
        {aConfirmar.length > 0 && (
          <FilaMenu
            texto="Todos se venden por pieza"
            detalle={
              sinNumero.length === 0
                ? `Cada uno con las piezas que dice su nombre. Confirma ${textoProductos(total)}.`
                : `Cada uno con las piezas que dice su nombre. Confirma ${aConfirmar.length}; ${sinNumero.length} sin número en el nombre quedan pendientes.`
            }
            onPress={() => onElegir('POR_PIEZA')}
          />
        )}
      </GrupoMenu>
      {aConfirmar.length === 0 && (
        <Text style={estilos.textoAviso}>
          Ninguno dice en el nombre cuántas piezas trae: si se venden por pieza, confírmalos uno por uno.
        </Text>
      )}
      <View style={estilos.botones}>
        <Boton texto="Cancelar" variante="secundario" onPress={onCerrar} style={estilos.botonFila} />
      </View>
    </View>
  );
}

function ConfirmacionFamilia({
  titulo,
  productos,
  modalidad,
  onAtras,
  onCerrar,
}: {
  titulo: string;
  productos: readonly ProductoPendiente[];
  modalidad: ModalidadVentaApi;
  onAtras: () => void;
  onCerrar: () => void;
}) {
  const [progreso, setProgreso] = useState<ProgresoFamilia | null>(null);
  const confirmar = useConfirmarFamilia(setProgreso);
  const { aConfirmar, sinNumero } = useMemo(() => planFamilia(productos, modalidad), [productos, modalidad]);
  // Los que ya se guardaron en intentos anteriores: reintentar sigue desde ahí.
  const [guardados, setGuardados] = useState(0);
  const total = aConfirmar.length;
  const enviando = confirmar.isPending;

  const cerrar = () => {
    if (!enviando) onCerrar();
  };

  const guardar = () => {
    confirmar.mutate(aConfirmar.slice(guardados), {
      onSuccess: onCerrar,
      onError: (e) => {
        if (!(e instanceof ErrorFamilia)) return;
        setGuardados((g) => g + e.guardados);
        if (e.causa instanceof ErrorApi && e.causa.estado === 401) sesionVencida();
      },
    });
  };

  const error = confirmar.error instanceof ErrorFamilia ? confirmar.error : null;
  const causa = error?.causa ?? confirmar.error;
  const hechos = guardados + (progreso?.hechos ?? 0);

  return (
    <View style={estilos.modal}>
      {modalidad === 'COMPLETO' ? (
        <DetalleFamiliaCompleta titulo={titulo} productos={aConfirmar} />
      ) : (
        <DetalleFamiliaPorPieza titulo={titulo} productos={aConfirmar} sinNumero={sinNumero} />
      )}
      {confirmar.isError && !(causa instanceof ErrorApi && causa.estado === 401) && (
        <AvisoError
          error={causa}
          titulo={guardados > 0 ? `Se guardaron ${guardados} de ${total}` : undefined}
          nota={guardados > 0 ? 'Reintentar sigue con los que faltan.' : undefined}
        />
      )}
      <View style={estilos.botones}>
        {/* Con algo ya guardado, volver al menú ofrecería una lista que ya no es cierta. */}
        <Boton
          texto={guardados > 0 ? 'Cerrar' : 'Atrás'}
          variante="secundario"
          onPress={guardados > 0 ? cerrar : onAtras}
          deshabilitado={enviando}
          style={estilos.botonFila}
        />
        <Boton
          texto={confirmar.isError ? 'Reintentar' : `Confirmar ${textoProductos(total)}`}
          onPress={guardar}
          cargando={enviando}
          textoCargando={progreso ? `Guardando ${hechos} de ${total}…` : 'Guardando…'}
          style={estilos.botonFila}
        />
      </View>
    </View>
  );
}

function DetalleFamiliaCompleta({ titulo, productos }: { titulo: string; productos: readonly ProductoConConfirmacion[] }) {
  const conNumero = productos.filter((p) => p.sugerido !== null).length;
  return (
    <>
      <Encabezado titulo={`¿Toda la familia ${titulo} se vende completa?`} variante="plano" lineasTitulo={3} />
      <Text style={estilos.detalleModal}>
        Se confirmarán <Text style={estilos.negrita}>{textoProductos(productos.length)}</Text> como “se vende completo”: la bolsa
        o caja entera es una venta y nunca se abre.
      </Text>
      <ResumenModalidad modalidad="COMPLETO" piezas={null} deVarios />
      {conNumero > 0 && (
        <Text style={estilos.detalleModal}>
          {conNumero === 1 ? '1 de ellos trae' : `${conNumero} de ellos traen`} un número en el nombre (como c/70): no se usará
          para multiplicar.
        </Text>
      )}
      <Tarjeta elevacion={0} compacta>
        <Text style={estilos.rotulo}>Productos que se confirman</Text>
        {productos.map((p) => (
          <Text key={p.code} style={estilos.productoFamilia} numberOfLines={2}>
            {p.nombre}
          </Text>
        ))}
      </Tarjeta>
      <Text style={estilos.detalleModal}>Si alguno se abre y se vende por pieza, vuelve atrás y confírmalo primero por separado.</Text>
    </>
  );
}

function DetalleFamiliaPorPieza({
  titulo,
  productos,
  sinNumero,
}: {
  titulo: string;
  productos: readonly ProductoConConfirmacion[];
  sinNumero: readonly ProductoPendiente[];
}) {
  const ejemplo = productos[0];
  return (
    <>
      <Encabezado titulo={`¿Toda la familia ${titulo} se vende por pieza?`} variante="plano" lineasTitulo={3} />
      <Text style={estilos.detalleModal}>
        Se confirmarán <Text style={estilos.negrita}>{textoProductos(productos.length)}</Text> como “se vende por pieza”, cada
        uno con las piezas que dice su propio nombre.
      </Text>
      {ejemplo && ejemplo.sugerido !== null && (
        <Tarjeta tintada="marca" compacta accessible>
          <Text style={estilos.fraseResumen}>{resumenPorPiezaDe(ejemplo.nombre, ejemplo.sugerido)}</Text>
        </Tarjeta>
      )}
      <Tarjeta elevacion={0} compacta>
        <Text style={estilos.rotulo}>Productos que se confirman</Text>
        {productos.map((p) => (
          <View
            key={p.code}
            style={estilos.lineaProductoFamilia}
            accessible
            accessibilityLabel={`${p.nombre}: ${p.sugerido} piezas por paquete`}
          >
            <Text style={[estilos.productoFamilia, estilos.nombreProductoFamilia]} numberOfLines={2}>
              {p.nombre}
            </Text>
            <Text style={estilos.piezasProductoFamilia}>{p.sugerido} por paquete</Text>
          </View>
        ))}
      </Tarjeta>
      <Text style={estilos.detalleModal}>
        Los números salen del nombre. Si alguno no coincide con lo que trae el paquete, vuelve atrás y confírmalo primero por
        separado.
      </Text>
      {sinNumero.length > 0 && (
        <Tarjeta tintada="discrepancia" compacta accessible>
          <Text style={estilos.tituloAviso}>
            {sinNumero.length === 1 ? '1 se queda sin confirmar' : `${sinNumero.length} se quedan sin confirmar`}
          </Text>
          <Text style={estilos.detalleModal}>
            Su nombre no dice cuántas piezas trae. Seguirá{sinNumero.length === 1 ? '' : 'n'} en la lista para confirmarlo
            {sinNumero.length === 1 ? '' : 's'} uno por uno:
          </Text>
          {sinNumero.map((p) => (
            <Text key={p.code} style={estilos.productoFamilia} numberOfLines={2}>
              {p.nombre}
            </Text>
          ))}
        </Tarjeta>
      )}
    </>
  );
}

/** El error de un guardado: sin señal es aviso, lo demás es error. */
function AvisoError({ error, titulo, nota }: { error: unknown; titulo?: string; nota?: string }) {
  const info = detalleError(error);
  return (
    <BloqueError
      titulo={titulo ?? info.titulo}
      detalle={nota ? `${info.detalle} ${nota}` : info.detalle}
      tono={info.sinRed ? 'atencion' : 'error'}
    />
  );
}

const estilos = StyleSheet.create({
  // Lectura pausada: tarjetas blancas sobre el fondo tintado.
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondoPantalla,
  },
  esqueleto: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    paddingHorizontal: RITMO.margen,
  },
  encabezadoFamiliaEsqueleto: {
    paddingTop: ESPACIADO.xl,
  },
  contenedorAviso: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    padding: RITMO.margen,
  },
  pestanas: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: ESPACIADO.xs,
    paddingHorizontal: RITMO.margen,
    paddingTop: RITMO.relacionado,
  },
  pestana: {
    flex: 1,
    minHeight: TOQUE_MINIMO,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.sm,
    backgroundColor: COLORES.fondo,
    borderWidth: BORDES.medio,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.medio,
  },
  pestanaActiva: {
    borderColor: COLORES.marca,
    backgroundColor: COLORES.marca,
  },
  pestanaPresionada: {
    backgroundColor: COLORES.marcaClaro,
  },
  textoPestana: {
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.negrita,
    color: COLORES.marcaOscuro,
    ...CIFRAS,
  },
  textoPestanaActiva: {
    color: COLORES.textoSobreColor,
  },
  buscador: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    paddingHorizontal: RITMO.margen,
    paddingTop: RITMO.relacionado,
  },
  lista: {
    flex: 1,
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
  },
  contenidoLista: {
    paddingHorizontal: RITMO.margen,
    paddingBottom: ESPACIADO.xxxl,
  },
  // Mucho aire arriba (separa de la familia anterior) y poco abajo: la familia
  // se lee pegada a sus productos.
  encabezadoFamilia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.interno,
    paddingTop: RITMO.grupo,
    paddingBottom: ESPACIADO.xs,
  },
  // Si el nombre y la cantidad no caben junto al botón (teléfono angosto), la
  // cantidad baja bajo el nombre en vez de estrujarlo.
  lineaFamilia: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: RITMO.relacionado,
  },
  // Pastilla tintada con contorno de marca: se ve tocable sin competir con el
  // nombre de la familia. Del alto del título; el toque se completa con hitSlop.
  botonAcciones: {
    height: ALTO_BOTON_ACCIONES,
    paddingHorizontal: ESPACIADO.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
    borderWidth: BORDES.fino,
    borderColor: COLORES.marca,
    backgroundColor: COLORES.marcaClaro,
  },
  botonAccionesPresionado: {
    backgroundColor: COLORES.marca,
  },
  textoBotonAcciones: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.negrita,
    color: COLORES.marcaOscuro,
  },
  textoFamilia: {
    flexShrink: 1,
    ...TIPOGRAFIA.titulo,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.marcaOscuro,
  },
  cantidadFamilia: {
    ...ROTULO,
    ...CIFRAS,
  },
  fila: {
    marginTop: RITMO.relacionado,
  },
  lineaNombre: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
  },
  nombre: {
    flex: 1,
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.negrita,
    color: COLORES.texto,
  },
  lineaDatos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: RITMO.interno,
  },
  rotulo: ROTULO,
  traza: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
  },
  // Solo dice "se abre": no compite con el nombre.
  flecha: {
    ...TIPOGRAFIA.titulo,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
  },

  // Modales
  fondoModal: {
    flex: 1,
    backgroundColor: COLORES.velo,
  },
  contenidoFondoModal: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: RITMO.margen,
  },
  modal: {
    width: '100%',
    maxWidth: ANCHO_MODAL,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    padding: RITMO.margen,
    backgroundColor: COLORES.fondo,
    borderRadius: RADIOS.grande,
  },
  modalTeclado: {
    maxWidth: ANCHO_MODAL_TECLADO,
  },
  pasoIndicador: ROTULO,
  empaqueActual: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  tituloAviso: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.negrita,
    color: COLORES.discrepanciaTexto,
  },
  nombreModal: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.negrita,
    color: COLORES.texto,
  },
  detalleModal: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  negrita: {
    fontWeight: PESOS.negrita,
    ...CIFRAS,
  },
  botones: {
    flexDirection: 'row',
    gap: RITMO.relacionado,
    marginTop: ESPACIADO.xs,
  },
  botonFila: {
    flex: 1,
  },

  // Opciones de modalidad
  opcion: {
    minHeight: TOQUE_MINIMO * 2,
    gap: ESPACIADO.xs,
    padding: RITMO.margen,
    backgroundColor: COLORES.fondo,
    borderWidth: BORDES.medio,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.medio,
  },
  opcionSeleccionada: {
    borderColor: COLORES.marca,
    backgroundColor: COLORES.marcaClaro,
  },
  // Inversión completa al presionar: se nota aun con poca luz.
  opcionPresionada: {
    borderColor: COLORES.marca,
    backgroundColor: COLORES.marca,
  },
  tituloOpcion: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.marcaOscuro,
  },
  descripcionOpcion: {
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.semiNegrita,
    color: COLORES.texto,
  },
  ejemploOpcion: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },
  rotuloEjemplo: {
    fontWeight: PESOS.negrita,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },

  // Piezas por paquete
  lineaVisor: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: ESPACIADO.sm,
  },
  visor: {
    minWidth: ESPACIADO.xxxl * 2,
    paddingHorizontal: ESPACIADO.sm,
    borderBottomWidth: BORDES.grueso,
    borderBottomColor: COLORES.marca,
  },
  valorVisor: {
    ...TIPOGRAFIA.numero,
    color: COLORES.texto,
    textAlign: 'right',
    ...CIFRAS,
  },
  // Se ve "seleccionado": la primera tecla lo reemplaza, no se le agrega.
  valorPorReemplazar: {
    color: COLORES.textoSecundario,
  },
  unidadVisor: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.textoSecundario,
    paddingBottom: ESPACIADO.sm,
  },
  zonaAviso: {
    minHeight: TIPOGRAFIA.cuerpo.lineHeight * 2,
    justifyContent: 'center',
  },
  textoAviso: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },

  // Resumen
  fraseResumen: {
    ...TIPOGRAFIA.titulo,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.marcaOscuro,
  },
  lineaProductoFamilia: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: RITMO.relacionado,
  },
  nombreProductoFamilia: {
    flex: 1,
  },
  piezasProductoFamilia: {
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.negrita,
    color: COLORES.marcaOscuro,
    ...CIFRAS,
  },
  productoFamilia: {
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.semiNegrita,
    color: COLORES.texto,
  },
});

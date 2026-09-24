import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import type { ConfirmacionFactor, ModalidadVentaApi } from '../../src/api/factores';
import {
  ErrorFamilia,
  useConfirmarFactor,
  useConfirmarFamiliaCompleta,
  useFactoresPendientes,
  type ProgresoFamilia,
} from '../../src/api/hooks-factores';
import { cerrarSesion, obtenerUsuarioSesion, type UsuarioSesion } from '../../src/api/sesion';
import {
  BloqueError,
  Boton,
  Datos,
  Encabezado,
  EstadoVacio,
  Esqueleto,
  Etiqueta,
  LineaEsqueleto,
  NotaEncabezado,
  Tarjeta,
  TarjetaEsqueleto,
  type Dato,
} from '../../src/componentes/base';
import { TecladoPin } from '../../src/componentes/TecladoPin';
import {
  contarPendientes,
  MAX_DIGITOS_PIEZAS,
  piezasDesdeTexto,
  PIEZAS_MAXIMO,
  PIEZAS_MINIMO,
  resumenConfirmacion,
  textoProductos,
  type FamiliaPendiente,
  type ProductoPendiente,
} from '../../src/factores/modelo-factores';
import { ANCHO_MAXIMO_LISTA, BarraSuperior } from '../../src/historial/ComponentesHistorial';
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
 */

const TITULO = 'Empaque de productos';
/** El modal con teclado es tan angosto como el del PIN: el teclado se ve igual. */
const ANCHO_MODAL_TECLADO = ANCHO_MODAL - ESPACIADO.xl - ESPACIADO.lg;

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
        accion={{ texto: 'Volver', onPress: () => router.back() }}
      />
    </SafeAreaView>
  );
}

function ListaFactores() {
  const consulta = useFactoresPendientes(true);
  const familias = consulta.data ?? [];
  const pendientes = contarPendientes(familias);
  const [seleccionado, setSeleccionado] = useState<ProductoPendiente | null>(null);
  const [familiaAConfirmar, setFamiliaAConfirmar] = useState<FamiliaPendiente | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const estadoError = consulta.error instanceof ErrorApi ? consulta.error.estado : null;
  useEffect(() => {
    if (estadoError === 401) sesionVencida();
  }, [estadoError]);

  if (estadoError === 403) return <SinAcceso />;

  const refrescar = () => {
    setRefrescando(true);
    void consulta.refetch().finally(() => setRefrescando(false));
  };

  let contenido;
  if (consulta.isPending) {
    contenido = <EsqueletoLista />;
  } else if (consulta.isError && familias.length === 0) {
    const sinRed = consulta.error instanceof ErrorRed;
    contenido = (
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
  } else if (familias.length === 0) {
    contenido = (
      <EstadoVacio
        icono="listo"
        tono="capturado"
        titulo="Todos los productos tienen su empaque confirmado"
        detalle="Cuando la sincronización con Handy traiga productos nuevos, aparecerán aquí para que confirmes cómo se venden."
        accion={{ texto: 'Actualizar', onPress: refrescar, cargando: refrescando, textoCargando: 'Actualizando…' }}
        secundaria={{ texto: 'Volver', onPress: () => router.back() }}
      />
    );
  } else {
    contenido = (
      <SectionList<ProductoPendiente, FamiliaPendiente>
        style={estilos.lista}
        contentContainerStyle={estilos.contenidoLista}
        sections={familias}
        keyExtractor={(p) => p.code}
        // El encabezado lleva un botón: fijo taparía media pantalla.
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <EncabezadoFamilia familia={section} onConfirmarCompleta={() => setFamiliaAConfirmar(section)} />
        )}
        renderItem={({ item }) => <FilaPendiente producto={item} onPress={() => setSeleccionado(item)} />}
        refreshing={refrescando}
        onRefresh={refrescar}
      />
    );
  }

  return (
    <SafeAreaView style={estilos.pantalla}>
      <BarraSuperior
        titulo={TITULO}
        subtitulo={consulta.data && pendientes > 0 ? `${textoProductos(pendientes)} por confirmar` : null}
      >
        <NotaEncabezado>Mientras no se confirmen, esos productos solo se cuentan por pieza.</NotaEncabezado>
      </BarraSuperior>
      {contenido}
      <ModalConfirmarProducto producto={seleccionado} onCerrar={() => setSeleccionado(null)} />
      <ModalConfirmarFamilia familia={familiaAConfirmar} onCerrar={() => setFamiliaAConfirmar(null)} />
    </SafeAreaView>
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

function EncabezadoFamilia({ familia, onConfirmarCompleta }: { familia: FamiliaPendiente; onConfirmarCompleta: () => void }) {
  // Sin familia no hay nada en común entre ellos; con uno solo, basta su fila.
  const conAccion = familia.familia !== null && familia.data.length > 1;
  return (
    <View style={estilos.encabezadoFamilia}>
      <View style={estilos.lineaFamilia} accessibilityRole="header">
        <Text style={estilos.textoFamilia} numberOfLines={2}>
          {familia.titulo}
        </Text>
        <Text style={estilos.cantidadFamilia}>{textoProductos(familia.data.length)}</Text>
      </View>
      {conAccion && (
        <Boton
          texto="Confirmar toda la familia como se vende completo"
          variante="secundario"
          onPress={onConfirmarCompleta}
          accessibilityHint={`Pide confirmar antes de guardar ${textoProductos(familia.data.length)}`}
        />
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

// ---------------------------------------------------------------------------
// Confirmación de un producto: cómo se vende → piezas (si aplica) → resumen
// ---------------------------------------------------------------------------

type Paso = 'modalidad' | 'piezas' | 'resumen';

function ModalConfirmarProducto({ producto, onCerrar }: { producto: ProductoPendiente | null; onCerrar: () => void }) {
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

function FlujoConfirmacion({ producto, onCerrar }: { producto: ProductoPendiente; onCerrar: () => void }) {
  const confirmar = useConfirmarFactor();
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
                  ? `${producto.sugerido} sale del nombre. Si no es correcto, teclea el número real.`
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
          {modalidad === 'COMPLETO' && producto.sugerido !== null && (
            <Text style={estilos.detalleModal}>
              El {producto.sugerido} del nombre no se usa: solo distingue este producto de otros parecidos.
            </Text>
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
              texto={confirmar.isError ? 'Reintentar' : 'Guardar'}
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
// Toda una familia como "se vende completo"
// ---------------------------------------------------------------------------

function ModalConfirmarFamilia({ familia, onCerrar }: { familia: FamiliaPendiente | null; onCerrar: () => void }) {
  return (
    <Modal visible={familia !== null} transparent animationType="none" onRequestClose={onCerrar}>
      <View style={estilos.fondoModal}>
        <ScrollView contentContainerStyle={estilos.contenidoFondoModal} bounces={false}>
          {familia && <ConfirmacionFamilia key={familia.titulo} familia={familia} onCerrar={onCerrar} />}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ConfirmacionFamilia({ familia, onCerrar }: { familia: FamiliaPendiente; onCerrar: () => void }) {
  const [progreso, setProgreso] = useState<ProgresoFamilia | null>(null);
  const confirmar = useConfirmarFamiliaCompleta(setProgreso);
  // La lista de la familia al abrir: si alguien confirma uno mientras tanto, esto no cambia bajo el dedo.
  const [productos] = useState(familia.data);
  // Los que ya se guardaron en intentos anteriores: reintentar sigue desde ahí.
  const [guardados, setGuardados] = useState(0);
  const total = productos.length;
  const conNumero = productos.filter((p) => p.sugerido !== null).length;
  const enviando = confirmar.isPending;

  const cerrar = () => {
    if (!enviando) onCerrar();
  };

  const guardar = () => {
    confirmar.mutate(
      productos.slice(guardados).map((p) => p.code),
      {
        onSuccess: onCerrar,
        onError: (e) => {
          if (!(e instanceof ErrorFamilia)) return;
          setGuardados((g) => g + e.guardados);
          if (e.causa instanceof ErrorApi && e.causa.estado === 401) sesionVencida();
        },
      },
    );
  };

  const error = confirmar.error instanceof ErrorFamilia ? confirmar.error : null;
  const causa = error?.causa ?? confirmar.error;
  const hechos = guardados + (progreso?.hechos ?? 0);

  return (
    <View style={estilos.modal}>
      <Encabezado titulo={`¿Toda la familia ${familia.titulo} se vende completa?`} variante="plano" lineasTitulo={3} />
      <Text style={estilos.detalleModal}>
        Se confirmarán <Text style={estilos.negrita}>{textoProductos(total)}</Text> como “se vende completo”: la bolsa o caja
        entera es una venta y nunca se abre.
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
      <Text style={estilos.detalleModal}>Si alguno se abre y se vende por pieza, cancela y confírmalo primero por separado.</Text>
      {confirmar.isError && !(causa instanceof ErrorApi && causa.estado === 401) && (
        <AvisoError
          error={causa}
          titulo={guardados > 0 ? `Se guardaron ${guardados} de ${total}` : undefined}
          nota={guardados > 0 ? 'Reintentar sigue con los que faltan.' : undefined}
        />
      )}
      <View style={estilos.botones}>
        <Boton texto="Cancelar" variante="secundario" onPress={cerrar} deshabilitado={enviando} style={estilos.botonFila} />
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
    gap: RITMO.relacionado,
    paddingTop: RITMO.grupo,
    paddingBottom: ESPACIADO.xs,
  },
  lineaFamilia: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: RITMO.relacionado,
  },
  textoFamilia: {
    flex: 1,
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
  productoFamilia: {
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.semiNegrita,
    color: COLORES.texto,
  },
});

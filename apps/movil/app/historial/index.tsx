import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ETIQUETAS_TIPO_CARGA } from '../../src/api/cargas';
import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { DIAS_RESUMEN_SIN_LIQUIDAR, useHistorial, useResumenSinLiquidar } from '../../src/api/hooks-historial';
import { cerrarSesion, obtenerUsuarioSesion, type UsuarioSesion } from '../../src/api/sesion';
import {
  BloqueError,
  Boton,
  EstadoVacio,
  Esqueleto,
  Etiqueta,
  LineaEsqueleto,
  NotaEncabezado,
  Tarjeta,
  TarjetaEsqueleto,
} from '../../src/componentes/base';
import { diaNegocio, diaRelativo, formatearDia } from '../../src/conteo/fecha-operativa';
import { ANCHO_MAXIMO_LISTA, bandaDeEstado, BarraSuperior } from '../../src/historial/ComponentesHistorial';
import {
  agruparPorDia,
  type AcumuladoVendedor,
  type FilaHistorial,
  type GrupoDia,
} from '../../src/historial/modelo-historial';
import { CIFRAS, COLORES, ESPACIADO, PESOS, RADIOS, RITMO, TIPOGRAFIA } from '../../src/theme/tokens';

/**
 * Historial de cargas por fecha operativa (docs/06 §3.8). Lo primero que se
 * busca es "qué cargué el martes": por eso se agrupa por día. El alcance lo
 * decide el servidor con el rol; aquí no hay filtros de usuario ni de fechas
 * que el cliente pueda mover.
 */

/** Solo informa lo que el servidor ya aplica; no es un control. */
const ALCANCE_POR_ROL: Record<string, string> = {
  VENDEDOR: 'Tus cargas de las últimas 2 semanas',
  CONTADOR: 'Cargas de todas las rutas, últimas 2 semanas',
  SUPERVISOR: 'Todas las cargas',
};

export default function PantallaHistorial() {
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
        <BarraSuperior titulo="Historial de cargas" />
        <EsqueletoHistorial />
      </SafeAreaView>
    );
  }

  if (usuario === null) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <BarraSuperior titulo="Historial de cargas" />
        <EstadoVacio
          icono="candado"
          titulo="Tu sesión terminó"
          detalle="Entra de nuevo con tu PIN para ver el historial."
          accion={{ texto: 'Entrar', onPress: () => router.replace('/login') }}
        />
      </SafeAreaView>
    );
  }

  return <ListaHistorial usuario={usuario} />;
}

function ListaHistorial({ usuario }: { usuario: UsuarioSesion }) {
  const [soloSinLiquidar, setSoloSinLiquidar] = useState(false);
  const consulta = useHistorial(usuario.id, soloSinLiquidar);
  const resumen = useResumenSinLiquidar(usuario.id);
  const grupos = useMemo(() => agruparPorDia(consulta.data?.pages.map((p) => p?.items ?? []) ?? []), [consulta.data]);
  const hoy = diaNegocio(new Date());
  const alcance = usuario.rolApp ? ALCANCE_POR_ROL[usuario.rolApp] : null;
  const [refrescando, setRefrescando] = useState(false);

  const sesionVencida = consulta.error instanceof ErrorApi && consulta.error.estado === 401;
  useEffect(() => {
    if (sesionVencida) void cerrarSesion().then(() => router.replace('/login'));
  }, [sesionVencida]);

  const refrescar = () => {
    setRefrescando(true);
    void Promise.all([consulta.refetch(), resumen.refetch()]).finally(() => setRefrescando(false));
  };

  let contenido;
  if (consulta.isPending) {
    contenido = <EsqueletoHistorial />;
  } else if (consulta.isError && grupos.length === 0) {
    const sinRed = consulta.error instanceof ErrorRed;
    contenido = (
      <View style={estilos.contenedorAviso}>
        <BloqueError
          titulo={sinRed ? 'Sin conexión' : 'No se pudo cargar el historial'}
          detalle={
            sinRed
              ? 'El historial se consulta en el servidor: revisa tu señal y vuelve a intentarlo.'
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
  } else if (grupos.length === 0 && soloSinLiquidar) {
    contenido = (
      <EstadoVacio
        icono="listo"
        tono="capturado"
        titulo="Ninguna carga se inició sin liquidar"
        detalle="Todas las cargas iniciales de este historial arrancaron con la ruta anterior ya liquidada en Handy."
        accion={{ texto: 'Ver todas las cargas', onPress: () => setSoloSinLiquidar(false) }}
      />
    );
  } else if (grupos.length === 0) {
    contenido = (
      <EstadoVacio
        icono="lista"
        titulo="Todavía no hay cargas"
        detalle={
          usuario.rolApp === 'SUPERVISOR'
            ? 'Aquí aparecerán las cargas en cuanto se completen, agrupadas por el día en que sale el camión.'
            : 'Aquí aparecerán las cargas de las últimas 2 semanas en cuanto se completen, agrupadas por el día en que sale el camión.'
        }
        accion={{ texto: 'Actualizar', onPress: refrescar, cargando: refrescando, textoCargando: 'Actualizando…' }}
      />
    );
  } else {
    contenido = (
      <SectionList<FilaHistorial, GrupoDia>
        style={estilos.lista}
        contentContainerStyle={estilos.contenidoLista}
        sections={grupos}
        keyExtractor={(fila) => fila.id}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => <EncabezadoDia grupo={section} hoy={hoy} />}
        renderItem={({ item }) => <Fila fila={item} mostrarVendedor={usuario.rolApp !== 'VENDEDOR'} />}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (consulta.hasNextPage && !consulta.isFetchingNextPage) void consulta.fetchNextPage();
        }}
        ListFooterComponent={
          consulta.isFetchingNextPage ? (
            <Esqueleto etiqueta="Cargando más cargas" style={estilos.pie}>
              <TarjetaEsqueleto titulo="titulo" cifra />
            </Esqueleto>
          ) : consulta.isFetchNextPageError ? (
            <BloqueError
              titulo="No se pudieron cargar más cargas"
              detalle={consulta.error instanceof ErrorRed ? 'Sin conexión: revisa tu señal.' : 'Intenta de nuevo en un momento.'}
              onReintentar={() => void consulta.fetchNextPage()}
              style={estilos.pie}
            />
          ) : null
        }
      />
    );
  }

  return (
    <SafeAreaView style={estilos.pantalla}>
      <BarraSuperior titulo="Historial de cargas">
        {alcance && <NotaEncabezado>{alcance}</NotaEncabezado>}
      </BarraSuperior>
      <AvisoSinLiquidar
        vendedores={resumen.data?.vendedores ?? []}
        incompleto={resumen.data?.incompleto ?? false}
        esVendedor={usuario.rolApp === 'VENDEDOR'}
        soloSinLiquidar={soloSinLiquidar}
        onAlternar={() => setSoloSinLiquidar((actual) => !actual)}
      />
      {contenido}
    </SafeAreaView>
  );
}

/**
 * Quién inició cargas con la ruta anterior sin liquidar en las últimas 2
 * semanas, de más a menos: si alguien acumula, se ve sin abrir nada. Sin
 * ninguna, no ocupa lugar. También alterna la lista a solo esas cargas.
 */
function AvisoSinLiquidar({
  vendedores,
  incompleto,
  esVendedor,
  soloSinLiquidar,
  onAlternar,
}: {
  vendedores: AcumuladoVendedor[];
  incompleto: boolean;
  esVendedor: boolean;
  soloSinLiquidar: boolean;
  onAlternar: () => void;
}) {
  if (vendedores.length === 0 && !soloSinLiquidar) return null;

  const total = vendedores.reduce((suma, v) => suma + v.cargas, 0);
  const mas = incompleto ? ' o más' : '';
  const periodo = `en los últimos ${DIAS_RESUMEN_SIN_LIQUIDAR} días`;
  const titulo = esVendedor
    ? total === 1
      ? `Iniciaste 1 carga sin liquidar la ruta anterior ${periodo}`
      : `Iniciaste ${total}${mas} cargas sin liquidar la ruta anterior ${periodo}`
    : `Cargas iniciadas sin liquidar ${periodo}`;

  return (
    <View style={estilos.aviso}>
      <View style={estilos.contenidoAviso}>
        {vendedores.length > 0 && (
          <Text style={estilos.tituloAviso} accessibilityRole="header">
            {titulo}
          </Text>
        )}
        {!esVendedor && vendedores.length > 0 && (
          <View style={estilos.vendedoresAviso}>
            {vendedores.map((v) => (
              <Etiqueta
                key={v.vendedor}
                texto={`${v.vendedor}  ${v.cargas}${mas && '+'}`}
                // Dos o más: el que acumula resalta sin tener que leer los números.
                tono={v.cargas > 1 ? 'discrepancia' : 'neutro'}
                relleno={v.cargas > 1 ? 'solida' : 'contorno'}
                accessibilityLabel={`${v.vendedor}: ${v.cargas}${mas} ${v.cargas === 1 ? 'carga' : 'cargas'} sin liquidar`}
              />
            ))}
          </View>
        )}
        <Boton
          texto={soloSinLiquidar ? 'Ver todas las cargas' : 'Ver solo las iniciadas sin liquidar'}
          variante="secundario"
          onPress={onAlternar}
        />
      </View>
    </View>
  );
}

function EncabezadoDia({ grupo, hoy }: { grupo: GrupoDia; hoy: string }) {
  const relativo = grupo.dia ? diaRelativo(grupo.dia, hoy) : null;
  const cantidad = grupo.data.length;
  return (
    <View style={estilos.encabezadoDia} accessibilityRole="header">
      <Text style={estilos.textoDia} numberOfLines={2}>
        {grupo.dia ? formatearDia(grupo.dia) : 'Sin fecha'}
        {relativo && <Text style={estilos.relativo}> · {relativo}</Text>}
      </Text>
      <Text style={estilos.cantidadDia}>{cantidad === 1 ? '1 carga' : `${cantidad} cargas`}</Text>
    </View>
  );
}

/** La forma de la lista mientras llega: un día y sus tarjetas. */
function EsqueletoHistorial() {
  return (
    <Esqueleto etiqueta="Cargando historial" style={estilos.esqueleto}>
      <View style={estilos.encabezadoDiaEsqueleto}>
        <LineaEsqueleto nivel="titulo" ancho="55%" />
      </View>
      {[0, 1, 2].map((i) => (
        <TarjetaEsqueleto key={i} titulo="titulo" cifra />
      ))}
    </Esqueleto>
  );
}

function Fila({ fila, mostrarVendedor }: { fila: FilaHistorial; mostrarVendedor: boolean }) {
  const conDiscrepancias = fila.discrepancias > 0;
  const tipo = fila.tipo ? ETIQUETAS_TIPO_CARGA[fila.tipo] : 'Carga';
  const personas = [
    mostrarVendedor && fila.vendedorNombre ? `Contó ${fila.vendedorNombre}` : null,
    fila.contadorNombre ? `Verificó ${fila.contadorNombre}` : null,
  ].filter(Boolean);
  const textoDiscrepancias = conDiscrepancias
    ? fila.discrepancias === 1
      ? '1 discrepancia'
      : `${fila.discrepancias} discrepancias`
    : 'Sin discrepancias';
  const banda = bandaDeEstado(fila.estado, tipo);

  return (
    <Tarjeta
      onPress={() => router.push({ pathname: '/historial/[eventoId]', params: { eventoId: fila.id } })}
      // El estado en la banda; las discrepancias, en ámbar: informativo, no
      // restrictivo (docs/06 §3.8). El detalle se abre igual.
      conAcento={banda}
      style={estilos.fila}
      accessibilityLabel={[
        `${fila.rutaNombre}, ${tipo}`,
        banda.titulo,
        fila.totalProductos !== null ? `${fila.totalProductos} productos` : null,
        textoDiscrepancias,
        fila.sinLiquidar ? `Iniciada sin liquidar con permiso de ${fila.sinLiquidar.otorgadoPor ?? 'un supervisor'}` : null,
        'Ver detalle',
      ]
        .filter(Boolean)
        .join('. ')}
    >
      <View style={estilos.contenidoFila}>
        <View style={estilos.cuerpoFila}>
          <Text style={estilos.ruta} numberOfLines={2}>
            {fila.rutaNombre}
          </Text>
          {personas.length > 0 && (
            <Text style={estilos.personas} numberOfLines={2}>
              {personas.join(' · ')}
            </Text>
          )}
          {/* Solo cuando hubo: lo que resalta en la lista es lo que pide mirar. */}
          {conDiscrepancias && (
            <View style={estilos.filaEtiquetas}>
              <Etiqueta texto={textoDiscrepancias} tono="discrepancia" relleno="tintada" />
            </View>
          )}
        </View>
        {fila.totalProductos !== null && (
          <View style={estilos.cifra}>
            <Text style={estilos.numeroCifra}>{fila.totalProductos}</Text>
            <Text style={estilos.unidadCifra}>productos</Text>
          </View>
        )}
        <Text style={estilos.flecha} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </View>
      {fila.sinLiquidar && (
        <View style={estilos.marcaSinLiquidar}>
          <Text style={estilos.tituloMarca}>Sin liquidar · permiso de {fila.sinLiquidar.otorgadoPor ?? 'un supervisor'}</Text>
          {fila.sinLiquidar.motivo && (
            <Text style={estilos.motivoMarca} numberOfLines={2}>
              “{fila.sinLiquidar.motivo}”
            </Text>
          )}
        </View>
      )}
      {fila.liquidacionNoVerificada && (
        <Text style={estilos.personas}>No se pudo confirmar en Handy la liquidación anterior</Text>
      )}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  // Lectura pausada: tarjetas blancas sobre el fondo tintado, con aire entre ellas.
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondoPantalla,
  },
  esqueleto: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: ESPACIADO.lg,
    paddingHorizontal: RITMO.margen,
  },
  encabezadoDiaEsqueleto: {
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
  // La fecha al frente: es lo primero que se busca ("qué cargué el martes").
  // Más aire arriba que abajo: el día agrupa las tarjetas que siguen.
  encabezadoDia: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: RITMO.relacionado,
    marginHorizontal: -RITMO.margen,
    paddingHorizontal: RITMO.margen,
    paddingTop: ESPACIADO.xxl,
    paddingBottom: ESPACIADO.xs,
    backgroundColor: COLORES.fondoPantalla,
  },
  textoDia: {
    flex: 1,
    ...TIPOGRAFIA.titulo,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.marcaOscuro,
  },
  relativo: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
  },
  cantidadDia: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
    ...CIFRAS,
  },
  fila: {
    marginTop: ESPACIADO.lg,
  },
  contenidoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
  },
  cuerpoFila: {
    flex: 1,
    gap: RITMO.interno,
  },
  ruta: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  filaEtiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: RITMO.interno,
  },
  // La cifra domina la tarjeta, como el total de un pedido; alineada a la derecha
  // para que los totales de todas las tarjetas queden en columna.
  cifra: {
    alignItems: 'flex-end',
  },
  numeroCifra: {
    ...TIPOGRAFIA.display,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.marcaOscuro,
    textAlign: 'right',
    ...CIFRAS,
  },
  unidadCifra: {
    ...TIPOGRAFIA.micro,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
    textTransform: 'uppercase',
  },
  personas: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
  },
  // Ámbar como las discrepancias: pide atención, no bloquea (docs/06 §3.8).
  aviso: {
    backgroundColor: COLORES.discrepanciaFondo,
  },
  contenidoAviso: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    padding: RITMO.margen,
  },
  tituloAviso: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.negrita,
    color: COLORES.discrepanciaTexto,
  },
  vendedoresAviso: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: RITMO.interno,
  },
  marcaSinLiquidar: {
    alignSelf: 'stretch',
    gap: ESPACIADO.xs,
    padding: RITMO.relacionado,
    backgroundColor: COLORES.discrepanciaFondo,
    borderRadius: RADIOS.chico,
  },
  tituloMarca: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.negrita,
    color: COLORES.discrepanciaTexto,
  },
  motivoMarca: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.regular,
    color: COLORES.texto,
  },
  flecha: {
    ...TIPOGRAFIA.display,
    fontWeight: PESOS.regular,
    color: COLORES.marca,
  },
  pie: {
    marginTop: ESPACIADO.lg,
  },
});

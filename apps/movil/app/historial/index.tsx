import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ETIQUETAS_TIPO_CARGA } from '../../src/api/cargas';
import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useHistorial } from '../../src/api/hooks-historial';
import { cerrarSesion, obtenerUsuarioSesion, type UsuarioSesion } from '../../src/api/sesion';
import {
  BloqueError,
  Datos,
  EstadoVacio,
  Esqueleto,
  Etiqueta,
  LineaEsqueleto,
  NotaEncabezado,
  Tarjeta,
  TarjetaEsqueleto,
  type Dato,
} from '../../src/componentes/base';
import { diaNegocio, diaRelativo, formatearDia } from '../../src/conteo/fecha-operativa';
import {
  ANCHO_MAXIMO_LISTA,
  bandaDeEstado,
  BarraSuperior,
  DetalleCancelacion,
} from '../../src/historial/ComponentesHistorial';
import { agruparPorDia, type FilaHistorial, type GrupoDia } from '../../src/historial/modelo-historial';
import { CIFRAS, COLORES, ESPACIADO, PESOS, RITMO, ROTULO, TIPOGRAFIA } from '../../src/theme/tokens';

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
  const consulta = useHistorial(usuario.id);
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
    void consulta.refetch().finally(() => setRefrescando(false));
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
      {contenido}
    </SafeAreaView>
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

/**
 * Un solo punto focal: la ruta (el día ya lo dice el encabezado del grupo).
 * Arriba, el estado como bloque tintado; abajo, separados por aire, quién
 * contó y verificó y cuántos productos, como rótulo y dato. Las discrepancias
 * solo aparecen cuando hubo: lo que resalta es lo que pide mirar.
 */
function Fila({ fila, mostrarVendedor }: { fila: FilaHistorial; mostrarVendedor: boolean }) {
  const conDiscrepancias = fila.discrepancias > 0;
  const tipo = fila.tipo ? ETIQUETAS_TIPO_CARGA[fila.tipo] : 'Carga';
  const datos: Dato[] = [];
  if (mostrarVendedor) datos.push({ rotulo: 'Contó', valor: fila.vendedorNombre });
  datos.push({ rotulo: 'Verificó', valor: fila.contadorNombre });
  if (fila.totalProductos !== null) datos.push({ rotulo: 'Productos', valor: String(fila.totalProductos), cifra: true });
  const textoDiscrepancias = conDiscrepancias
    ? fila.discrepancias === 1
      ? '1 discrepancia'
      : `${fila.discrepancias} discrepancias`
    : 'Sin discrepancias';
  const banda = bandaDeEstado(fila.estado, tipo);

  return (
    <Tarjeta
      onPress={() => router.push({ pathname: '/historial/[eventoId]', params: { eventoId: fila.id } })}
      // Las discrepancias son informativas, no restrictivas (docs/06 §3.8): el
      // detalle se abre igual, tenga o no.
      conAcento={banda}
      style={estilos.fila}
      accessibilityLabel={[
        `${fila.rutaNombre}, ${tipo}`,
        banda.titulo,
        fila.cancelacion?.motivo ? `Motivo: ${fila.cancelacion.motivo}` : null,
        fila.cancelacion?.porNombre ? `Canceló ${fila.cancelacion.porNombre}` : null,
        fila.totalProductos !== null ? `${fila.totalProductos} productos` : null,
        textoDiscrepancias,
        'Ver detalle',
      ]
        .filter(Boolean)
        .join('. ')}
    >
      <View style={estilos.lineaRuta}>
        <Text style={estilos.ruta} numberOfLines={2}>
          {fila.rutaNombre}
        </Text>
        <Text style={estilos.flecha} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </View>
      <View style={estilos.grupoDatos}>
        <Datos datos={datos} />
        {conDiscrepancias && (
          <View style={estilos.filaEtiquetas}>
            <Etiqueta texto={textoDiscrepancias} tono="discrepancia" />
          </View>
        )}
        {fila.cancelacion && <DetalleCancelacion cancelacion={fila.cancelacion} />}
      </View>
    </Tarjeta>
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
  // Mucho aire arriba (separa del día anterior) y casi nada abajo: el día se
  // lee pegado a sus cargas.
  encabezadoDia: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: RITMO.relacionado,
    marginHorizontal: -RITMO.margen,
    paddingHorizontal: RITMO.margen,
    paddingTop: RITMO.grupo,
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
    ...ROTULO,
    ...CIFRAS,
  },
  fila: {
    marginTop: ESPACIADO.lg,
  },
  lineaRuta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
  },
  // El punto focal de la tarjeta: nada más en ella tiene este tamaño ni peso.
  ruta: {
    flex: 1,
    ...TIPOGRAFIA.titulo,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.texto,
  },
  // Aire de grupo sobre los datos: la ruta y quién la contó son dos bloques.
  grupoDatos: {
    gap: RITMO.relacionado,
    marginTop: RITMO.grupo - RITMO.relacionado,
  },
  filaEtiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: RITMO.interno,
  },
  // Solo dice "se abre": no compite con la ruta.
  flecha: {
    ...TIPOGRAFIA.titulo,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
  },
  pie: {
    marginTop: ESPACIADO.lg,
  },
});

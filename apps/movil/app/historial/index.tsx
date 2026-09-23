import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ETIQUETAS_TIPO_CARGA } from '../../src/api/cargas';
import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useHistorial } from '../../src/api/hooks-historial';
import { cerrarSesion, obtenerUsuarioSesion, type UsuarioSesion } from '../../src/api/sesion';
import { diaNegocio, diaRelativo, formatearDia } from '../../src/conteo/fecha-operativa';
import {
  ANCHO_MAXIMO_LISTA,
  BarraSuperior,
  EstadoCentral,
  InsigniaEstado,
} from '../../src/historial/ComponentesHistorial';
import { agruparPorDia, type FilaHistorial, type GrupoDia } from '../../src/historial/modelo-historial';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../../src/theme/tokens';

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
        <ActivityIndicator style={estilos.cargando} size="large" color={COLORES.texto} />
      </SafeAreaView>
    );
  }

  if (usuario === null) {
    return (
      <SafeAreaView style={estilos.pantalla}>
        <BarraSuperior titulo="Historial de cargas" />
        <EstadoCentral
          titulo="Tu sesión terminó"
          detalle="Entra de nuevo para ver el historial."
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
    contenido = (
      <View style={estilos.centrado}>
        <ActivityIndicator size="large" color={COLORES.texto} />
        <Text style={estilos.textoCargando}>Cargando historial…</Text>
      </View>
    );
  } else if (consulta.isError && grupos.length === 0) {
    contenido = (
      <EstadoCentral
        titulo="No se pudo cargar el historial"
        detalle={
          consulta.error instanceof ErrorRed
            ? 'Sin conexión. El historial se consulta en el servidor: revisa tu señal.'
            : consulta.error instanceof Error && consulta.error.message
              ? consulta.error.message
              : 'Intenta de nuevo en un momento.'
        }
        accion={{ texto: 'Reintentar', onPress: () => void consulta.refetch() }}
      />
    );
  } else if (grupos.length === 0) {
    contenido = (
      <EstadoCentral
        titulo="Todavía no hay cargas"
        detalle={
          usuario.rolApp === 'SUPERVISOR'
            ? 'Cuando se registre la primera carga aparecerá aquí.'
            : 'Aquí aparecen las cargas de las últimas 2 semanas en cuanto se registren.'
        }
        accion={{ texto: 'Actualizar', onPress: refrescar }}
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
            <ActivityIndicator style={estilos.pie} color={COLORES.texto} />
          ) : consulta.isFetchNextPageError ? (
            <Pressable
              onPress={() => void consulta.fetchNextPage()}
              accessibilityRole="button"
              style={({ pressed }) => [estilos.botonPie, pressed && estilos.botonPiePresionado]}
            >
              <Text style={estilos.textoBotonPie}>No se pudieron cargar más. Reintentar</Text>
            </Pressable>
          ) : null
        }
      />
    );
  }

  return (
    <SafeAreaView style={estilos.pantalla}>
      <BarraSuperior titulo="Historial de cargas">
        {alcance && <Text style={estilos.alcance}>{alcance}</Text>}
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
      <Text style={estilos.textoDia} numberOfLines={1}>
        {grupo.dia ? formatearDia(grupo.dia) : 'Sin fecha'}
        {relativo && <Text style={estilos.relativo}> · {relativo}</Text>}
      </Text>
      <Text style={estilos.cantidadDia}>{cantidad === 1 ? '1 carga' : `${cantidad} cargas`}</Text>
    </View>
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

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/historial/[eventoId]', params: { eventoId: fila.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${fila.rutaNombre}, ${tipo}. ${textoDiscrepancias}. Ver detalle`}
      style={({ pressed }) => [
        estilos.fila,
        conDiscrepancias && estilos.filaConDiscrepancia,
        pressed && estilos.filaPresionada,
      ]}
    >
      <View style={estilos.cuerpoFila}>
        <View style={estilos.filaSuperior}>
          <Text style={estilos.ruta} numberOfLines={1}>
            {fila.rutaNombre}
          </Text>
          <Text style={estilos.tipo}>{tipo}</Text>
        </View>
        <View style={estilos.filaInferior}>
          <InsigniaEstado estado={fila.estado} />
          <Text style={[estilos.discrepancias, conDiscrepancias && estilos.discrepanciasMarcadas]}>
            {conDiscrepancias ? '⚠ ' : ''}
            {textoDiscrepancias}
          </Text>
        </View>
        {personas.length > 0 && (
          <Text style={estilos.personas} numberOfLines={1}>
            {personas.join(' · ')}
          </Text>
        )}
      </View>
      <Text style={estilos.flecha} accessibilityElementsHidden importantForAccessibility="no">
        ›
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  cargando: {
    marginTop: ESPACIADO.xxxl,
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ESPACIADO.md,
  },
  textoCargando: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.textoSecundario,
  },
  alcance: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.textoSecundario,
    paddingLeft: TOQUE_MINIMO,
  },
  lista: {
    flex: 1,
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
  },
  contenidoLista: {
    paddingHorizontal: ESPACIADO.md,
    paddingBottom: ESPACIADO.xxxl,
  },
  encabezadoDia: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: ESPACIADO.md,
    marginHorizontal: -ESPACIADO.md,
    paddingHorizontal: ESPACIADO.md,
    paddingTop: ESPACIADO.lg,
    paddingBottom: ESPACIADO.sm,
    backgroundColor: COLORES.fondo,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.borde,
  },
  textoDia: {
    flex: 1,
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  relativo: {
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.textoSecundario,
  },
  cantidadDia: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSecundario,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOQUE_MINIMO,
    marginTop: ESPACIADO.sm,
    paddingVertical: ESPACIADO.md,
    paddingHorizontal: ESPACIADO.md,
    gap: ESPACIADO.sm,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderLeftWidth: 6,
    borderLeftColor: COLORES.borde,
    borderRadius: RADIOS.md,
    backgroundColor: COLORES.fondo,
  },
  // Ámbar: informativo, no restrictivo (docs/06 §3.8). El detalle se abre igual.
  filaConDiscrepancia: {
    borderLeftColor: COLORES.discrepancia,
  },
  filaPresionada: {
    backgroundColor: COLORES.superficie,
  },
  cuerpoFila: {
    flex: 1,
    gap: ESPACIADO.xs,
  },
  filaSuperior: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: ESPACIADO.sm,
  },
  ruta: {
    flexShrink: 1,
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  tipo: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.textoSecundario,
  },
  filaInferior: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: ESPACIADO.sm,
  },
  discrepancias: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.textoSecundario,
  },
  discrepanciasMarcadas: {
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  personas: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    color: COLORES.textoSecundario,
  },
  flecha: {
    fontSize: TIPOGRAFIA.tamanos.xxl,
    color: COLORES.textoSecundario,
  },
  pie: {
    marginVertical: ESPACIADO.lg,
  },
  botonPie: {
    minHeight: TOQUE_MINIMO,
    marginTop: ESPACIADO.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
  },
  botonPiePresionado: {
    backgroundColor: COLORES.superficie,
  },
  textoBotonPie: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
});

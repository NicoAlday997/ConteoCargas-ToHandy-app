import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ETIQUETAS_TIPO_CARGA } from '../../src/api/cargas';
import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { DIAS_RESUMEN_SIN_LIQUIDAR, useHistorial, useResumenSinLiquidar } from '../../src/api/hooks-historial';
import { cerrarSesion, obtenerUsuarioSesion, type UsuarioSesion } from '../../src/api/sesion';
import { diaNegocio, diaRelativo, formatearDia } from '../../src/conteo/fecha-operativa';
import {
  ANCHO_MAXIMO_LISTA,
  BarraSuperior,
  EstadoCentral,
  InsigniaEstado,
} from '../../src/historial/ComponentesHistorial';
import {
  agruparPorDia,
  type AcumuladoVendedor,
  type FilaHistorial,
  type GrupoDia,
} from '../../src/historial/modelo-historial';
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
  } else if (grupos.length === 0 && soloSinLiquidar) {
    contenido = (
      <EstadoCentral
        titulo="Ninguna carga se inició sin liquidar"
        detalle="Todas las cargas iniciales de este historial arrancaron con la ruta anterior ya liquidada en Handy."
        accion={{ texto: 'Ver todas las cargas', onPress: () => setSoloSinLiquidar(false) }}
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
              <View
                key={v.vendedor}
                style={[estilos.vendedorAviso, v.cargas > 1 && estilos.vendedorAcumula]}
                accessibilityLabel={`${v.vendedor}: ${v.cargas}${mas} ${v.cargas === 1 ? 'carga' : 'cargas'} sin liquidar`}
              >
                <Text style={estilos.nombreVendedorAviso} numberOfLines={1}>
                  {v.vendedor}
                </Text>
                <Text style={estilos.numeroVendedorAviso}>
                  {v.cargas}
                  {mas && '+'}
                </Text>
              </View>
            ))}
          </View>
        )}
        <Pressable
          onPress={onAlternar}
          accessibilityRole="button"
          style={({ pressed }) => [estilos.botonAviso, pressed && estilos.botonAvisoPresionado]}
        >
          <Text style={estilos.textoBotonAviso}>
            {soloSinLiquidar ? 'Ver todas las cargas' : 'Ver solo las iniciadas sin liquidar'}
          </Text>
        </Pressable>
      </View>
    </View>
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
      accessibilityLabel={[
        `${fila.rutaNombre}, ${tipo}`,
        textoDiscrepancias,
        fila.sinLiquidar ? `Iniciada sin liquidar con permiso de ${fila.sinLiquidar.otorgadoPor ?? 'un supervisor'}` : null,
        'Ver detalle',
      ]
        .filter(Boolean)
        .join('. ')}
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
        {fila.sinLiquidar && (
          <View style={estilos.marcaSinLiquidar}>
            <Text style={estilos.tituloMarca}>
              Sin liquidar · permiso de {fila.sinLiquidar.otorgadoPor ?? 'un supervisor'}
            </Text>
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
  // Ámbar como las discrepancias: pide atención, no bloquea (docs/06 §3.8).
  aviso: {
    borderBottomWidth: 1,
    borderBottomColor: COLORES.borde,
    backgroundColor: COLORES.superficie,
  },
  contenidoAviso: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.md,
  },
  tituloAviso: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  vendedoresAviso: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ESPACIADO.sm,
  },
  vendedorAviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.sm,
    maxWidth: '100%',
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.xs,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.completo,
    backgroundColor: COLORES.fondo,
  },
  // Dos o más: el que acumula resalta sin tener que leer los números.
  vendedorAcumula: {
    borderWidth: 2,
    borderColor: COLORES.discrepancia,
  },
  nombreVendedorAviso: {
    flexShrink: 1,
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  numeroVendedorAviso: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    fontVariant: ['tabular-nums'],
  },
  botonAviso: {
    minHeight: TOQUE_MINIMO,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.md,
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
    backgroundColor: COLORES.fondo,
  },
  botonAvisoPresionado: {
    backgroundColor: COLORES.superficie,
  },
  textoBotonAviso: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
    textAlign: 'center',
  },
  marcaSinLiquidar: {
    alignSelf: 'stretch',
    marginTop: ESPACIADO.xs,
    paddingLeft: ESPACIADO.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORES.discrepancia,
  },
  tituloMarca: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  motivoMarca: {
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

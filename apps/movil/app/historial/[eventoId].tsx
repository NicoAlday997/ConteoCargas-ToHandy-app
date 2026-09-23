import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ETIQUETAS_TIPO_CARGA } from '../../src/api/cargas';
import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useDetalleHistorial } from '../../src/api/hooks-historial';
import { cerrarSesion } from '../../src/api/sesion';
import { factorEfectivo } from '../../src/conteo/estado-conteo';
import { diaNegocio, textoSalida } from '../../src/conteo/fecha-operativa';
import { EtiquetaFactor } from '../../src/conteo/FilaProducto';
import { formatearEnPaquetes, formatearTotalPiezas } from '../../src/conteo/formato-cantidad';
import {
  ANCHO_MAXIMO_LISTA,
  BarraSuperior,
  EstadoCentral,
  InsigniaEstado,
  volver,
} from '../../src/historial/ComponentesHistorial';
import type { CargaDetalle, FamiliaDetalle, ProductoDetalle } from '../../src/historial/modelo-historial';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA } from '../../src/theme/tokens';

/**
 * Vista consolidada de una carga. Es la que el supervisor abre en el celular
 * antes de subirse al camión: por familia, como se acomoda físicamente, y
 * con la cantidad final en paquetes y piezas, que es como se cuenta a la vista.
 * Tenga o no discrepancias se muestra con el mismo detalle (auditoría pareja).
 */

function parametro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

interface SeccionFamilia {
  familia: FamiliaDetalle;
  data: ProductoDetalle[];
}

export default function PantallaDetalleHistorial() {
  const params = useLocalSearchParams<{ eventoId: string }>();
  const eventoId = parametro(params.eventoId);
  const consulta = useDetalleHistorial(eventoId);
  const [refrescando, setRefrescando] = useState(false);

  const sesionVencida = consulta.error instanceof ErrorApi && consulta.error.estado === 401;
  useEffect(() => {
    if (sesionVencida) void cerrarSesion().then(() => router.replace('/login'));
  }, [sesionVencida]);

  const carga = consulta.data ?? null;
  const secciones = useMemo<SeccionFamilia[]>(
    () => carga?.familias.map((familia) => ({ familia, data: familia.productos })) ?? [],
    [carga],
  );

  if (!eventoId) {
    return (
      <Pantalla titulo="Carga">
        <EstadoCentral titulo="No se encontró la carga" accion={{ texto: 'Volver', onPress: volver }} />
      </Pantalla>
    );
  }

  if (consulta.isPending) {
    return (
      <Pantalla titulo="Carga">
        <View style={estilos.centrado}>
          <ActivityIndicator size="large" color={COLORES.texto} />
          <Text style={estilos.textoCargando}>Cargando carga…</Text>
        </View>
      </Pantalla>
    );
  }

  if (consulta.isError && !carga) {
    return (
      <Pantalla titulo="Carga">
        <ErrorDetalle error={consulta.error} onReintentar={() => void consulta.refetch()} />
      </Pantalla>
    );
  }

  if (!carga) {
    return (
      <Pantalla titulo="Carga">
        <EstadoCentral
          titulo="No se pudo leer esta carga"
          detalle="El servidor respondió algo que la app no entiende. Intenta de nuevo."
          accion={{ texto: 'Reintentar', onPress: () => void consulta.refetch() }}
        />
      </Pantalla>
    );
  }

  const refrescar = () => {
    setRefrescando(true);
    void consulta.refetch().finally(() => setRefrescando(false));
  };

  return (
    <Pantalla titulo={carga.evento.rutaNombre} carga={carga}>
      {secciones.length === 0 ? (
        <EstadoCentral
          titulo="Sin productos contados"
          detalle="Esta carga todavía no tiene productos capturados."
          accion={{ texto: 'Actualizar', onPress: refrescar }}
        />
      ) : (
        <SectionList<ProductoDetalle, SeccionFamilia>
          style={estilos.lista}
          contentContainerStyle={estilos.contenidoLista}
          sections={secciones}
          keyExtractor={(p) => p.code}
          stickySectionHeadersEnabled
          initialNumToRender={30}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
          renderSectionHeader={({ section }) => <EncabezadoFamilia familia={section.familia} />}
          renderItem={({ item }) => <FilaProducto producto={item} />}
        />
      )}
    </Pantalla>
  );
}

function Pantalla({ titulo, carga, children }: { titulo: string; carga?: CargaDetalle; children: ReactNode }) {
  return (
    <SafeAreaView style={estilos.pantalla}>
      <BarraSuperior titulo={titulo}>{carga && <Resumen carga={carga} />}</BarraSuperior>
      {children}
    </SafeAreaView>
  );
}

/** Ruta en el título; aquí para qué día es, quién contó y verificó, y cuántas discrepancias. */
function Resumen({ carga }: { carga: CargaDetalle }) {
  const { evento, totalProductos, totalDiscrepancias } = carga;
  const tipo = evento.tipo ? ETIQUETAS_TIPO_CARGA[evento.tipo] : 'Carga';
  return (
    <View style={estilos.resumen}>
      <Text style={estilos.salida}>
        {tipo}
        {evento.dia ? ` · ${textoSalida(evento.dia, diaNegocio(new Date()))}` : ''}
      </Text>
      <Text style={estilos.personas}>
        Contó <Text style={estilos.nombre}>{evento.vendedorNombre ?? '—'}</Text>
        {'  ·  '}
        Verificó <Text style={estilos.nombre}>{evento.contadorNombre ?? 'pendiente'}</Text>
      </Text>
      <View style={estilos.filaResumen}>
        <InsigniaEstado estado={evento.estado} />
        <Text style={estilos.totales}>
          {totalProductos === 1 ? '1 producto' : `${totalProductos} productos`}
          {totalDiscrepancias > 0 && (
            <Text style={estilos.totalDiscrepancias}>
              {'  ·  ⚠ '}
              {totalDiscrepancias === 1 ? '1 con discrepancia' : `${totalDiscrepancias} con discrepancia`}
            </Text>
          )}
        </Text>
      </View>
    </View>
  );
}

function EncabezadoFamilia({ familia }: { familia: FamiliaDetalle }) {
  return (
    <View style={estilos.encabezadoFamilia} accessibilityRole="header">
      <Text style={estilos.nombreFamilia} numberOfLines={1}>
        {familia.familia}
      </Text>
      <Text style={estilos.conteoFamilia}>
        {familia.conDiscrepancia > 0 && <Text style={estilos.totalDiscrepancias}>⚠ {familia.conDiscrepancia} · </Text>}
        {familia.productos.length}
      </Text>
    </View>
  );
}

function cantidad(piezas: number | null, factor: number | null): string {
  return piezas === null ? 'Sin dato' : formatearEnPaquetes(piezas, factor);
}

function FilaProducto({ producto }: { producto: ProductoDetalle }) {
  const factor = factorEfectivo(producto);
  const { discrepancia, cantidadFinal } = producto;
  const sinResolver = discrepancia !== null && cantidadFinal === null;

  return (
    <View style={[estilos.fila, discrepancia && estilos.filaDiscrepancia]}>
      <EtiquetaFactor producto={producto} grande />
      <View style={estilos.cuerpoFila}>
        <Text style={estilos.nombreProducto}>{producto.nombre}</Text>
        {sinResolver ? (
          <Text style={[estilos.cantidadFinal, estilos.sinResolver]}>Sin resolver</Text>
        ) : (
          <Text style={estilos.cantidadFinal}>
            {cantidad(cantidadFinal, factor)}
            {factor !== null && cantidadFinal !== null && cantidadFinal >= factor && (
              <Text style={estilos.totalPiezas}> {formatearTotalPiezas(cantidadFinal)}</Text>
            )}
          </Text>
        )}
        {discrepancia && (
          <View style={estilos.bloqueDiscrepancia}>
            <Text style={estilos.tituloDiscrepancia}>⚠ Tuvo discrepancia</Text>
            <Text style={estilos.lineaDiscrepancia}>
              Vendedor contó <Text style={estilos.nombre}>{cantidad(discrepancia.vendedor, factor)}</Text>
            </Text>
            <Text style={estilos.lineaDiscrepancia}>
              Contador contó <Text style={estilos.nombre}>{cantidad(discrepancia.contador, factor)}</Text>
            </Text>
            <Text style={estilos.lineaDiscrepancia}>
              Final capturada por <Text style={estilos.nombre}>{discrepancia.capturadaPor ?? 'nadie aún'}</Text>
              {' · '}confirmada por <Text style={estilos.nombre}>{discrepancia.confirmadaPor ?? 'nadie aún'}</Text>
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ErrorDetalle({ error, onReintentar }: { error: unknown; onReintentar: () => void }) {
  if (error instanceof ErrorApi && error.estado === 403) {
    return (
      <EstadoCentral
        titulo="No tienes acceso a esta carga"
        detalle="Solo puedes abrir las cargas que aparecen en tu historial."
        accion={{ texto: 'Volver', onPress: volver }}
      />
    );
  }
  if (error instanceof ErrorApi && error.estado === 404) {
    return <EstadoCentral titulo="Esta carga no existe" accion={{ texto: 'Volver', onPress: volver }} />;
  }
  return (
    <EstadoCentral
      titulo="No se pudo cargar la carga"
      detalle={
        error instanceof ErrorRed
          ? 'Sin conexión. El detalle se consulta en el servidor: revisa tu señal.'
          : error instanceof Error && error.message
            ? error.message
            : 'Intenta de nuevo en un momento.'
      }
      accion={{ texto: 'Reintentar', onPress: onReintentar }}
    />
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
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
  resumen: {
    gap: ESPACIADO.xs,
  },
  salida: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  personas: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    color: COLORES.textoSecundario,
  },
  nombre: {
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  filaResumen: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: ESPACIADO.sm,
    marginTop: ESPACIADO.xs,
  },
  totales: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSecundario,
  },
  totalDiscrepancias: {
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
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
  // Igual que en el conteo: la familia fija arriba mientras se recorre.
  encabezadoFamilia: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ESPACIADO.md,
    marginHorizontal: -ESPACIADO.md,
    paddingHorizontal: ESPACIADO.md,
    paddingVertical: ESPACIADO.sm,
    backgroundColor: COLORES.fondo,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.borde,
  },
  nombreFamilia: {
    flex: 1,
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    textTransform: 'uppercase',
  },
  conteoFamilia: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSecundario,
    fontVariant: ['tabular-nums'],
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ESPACIADO.md,
    paddingVertical: ESPACIADO.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.superficie,
  },
  // Ámbar a la izquierda: se distingue de un vistazo al recorrer la lista.
  filaDiscrepancia: {
    marginHorizontal: -ESPACIADO.md,
    paddingHorizontal: ESPACIADO.md - 6,
    borderLeftWidth: 6,
    borderLeftColor: COLORES.discrepancia,
  },
  cuerpoFila: {
    flex: 1,
    gap: 2,
  },
  nombreProducto: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  cantidadFinal: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    fontVariant: ['tabular-nums'],
  },
  totalPiezas: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.textoSecundario,
  },
  sinResolver: {
    color: COLORES.error,
  },
  bloqueDiscrepancia: {
    marginTop: ESPACIADO.xs,
    padding: ESPACIADO.sm,
    gap: 2,
    borderRadius: RADIOS.sm,
    backgroundColor: COLORES.superficie,
  },
  tituloDiscrepancia: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    textTransform: 'uppercase',
  },
  lineaDiscrepancia: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    color: COLORES.textoSecundario,
  },
});

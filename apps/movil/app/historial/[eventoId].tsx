import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ETIQUETAS_TIPO_CARGA } from '../../src/api/cargas';
import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useDetalleHistorial } from '../../src/api/hooks-historial';
import { cerrarSesion } from '../../src/api/sesion';
import {
  BloqueError,
  EstadoVacio,
  Esqueleto,
  Etiqueta,
  FilaDato,
  LineaEsqueleto,
  Tarjeta,
  TarjetaEsqueleto,
} from '../../src/componentes/base';
import { factorEfectivo } from '../../src/conteo/estado-conteo';
import { diaNegocio, textoSalida } from '../../src/conteo/fecha-operativa';
import { EtiquetaFactor } from '../../src/conteo/FilaProducto';
import { formatearEnPaquetes, formatearTotalPiezas } from '../../src/conteo/formato-cantidad';
import { ANCHO_MAXIMO_LISTA, bandaDeEstado, BarraSuperior, volver } from '../../src/historial/ComponentesHistorial';
import type { CargaDetalle, FamiliaDetalle, ProductoDetalle } from '../../src/historial/modelo-historial';
import { CIFRAS, COLORES, ESPACIADO, PESOS, RADIOS, RITMO, TIPOGRAFIA } from '../../src/theme/tokens';

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
        <EstadoVacio
          icono="lista"
          titulo="No se encontró la carga"
          detalle="El enlace no trae qué carga abrir. Vuelve al historial y elígela de la lista."
          accion={{ texto: 'Volver', onPress: volver }}
        />
      </Pantalla>
    );
  }

  if (consulta.isPending) {
    return (
      <Pantalla titulo="Carga">
        <EsqueletoDetalle />
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
        <View style={estilos.contenedorAviso}>
          <BloqueError
            titulo="No se pudo leer esta carga"
            detalle="El servidor respondió algo que la app no entiende. Intenta de nuevo."
            onReintentar={() => void consulta.refetch()}
            reintentando={consulta.isFetching}
          />
        </View>
      </Pantalla>
    );
  }

  const refrescar = () => {
    setRefrescando(true);
    void consulta.refetch().finally(() => setRefrescando(false));
  };

  return (
    <Pantalla {...titulosCarga(carga)}>
      {secciones.length === 0 ? (
        <>
          <View style={estilos.contenidoLista}>
            <Resumen carga={carga} />
          </View>
          <EstadoVacio
            icono="caja"
            titulo="Sin productos contados"
            detalle="Aquí aparecerán los productos por familia en cuanto se capturen en el conteo."
            accion={{ texto: 'Actualizar', onPress: refrescar, cargando: refrescando, textoCargando: 'Actualizando…' }}
          />
        </>
      ) : (
        <SectionList<ProductoDetalle, SeccionFamilia>
          style={estilos.lista}
          contentContainerStyle={estilos.contenidoLista}
          sections={secciones}
          keyExtractor={(p) => p.code}
          stickySectionHeadersEnabled
          initialNumToRender={30}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
          ListHeaderComponent={<Resumen carga={carga} />}
          renderSectionHeader={({ section }) => <EncabezadoFamilia familia={section.familia} />}
          renderItem={({ item }) => <FilaProducto producto={item} />}
        />
      )}
    </Pantalla>
  );
}

/**
 * El día al frente, como en un comprobante: es lo que se busca al abrir una
 * carga. La ruta y el tipo acompañan debajo.
 */
function titulosCarga({ evento }: CargaDetalle): { titulo: string; subtitulo: string } {
  const tipo = evento.tipo ? ETIQUETAS_TIPO_CARGA[evento.tipo] : 'Carga';
  if (!evento.dia) return { titulo: evento.rutaNombre, subtitulo: tipo };
  return { titulo: textoSalida(evento.dia, diaNegocio(new Date())), subtitulo: `${evento.rutaNombre} · ${tipo}` };
}

function Pantalla({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={estilos.pantalla}>
      <BarraSuperior titulo={titulo} subtitulo={subtitulo} />
      {children}
    </SafeAreaView>
  );
}

/**
 * Al frente de la lista, como el total de un pedido: el estado en la banda y
 * las cifras en grande. Día, ruta y tipo ya van en el encabezado.
 */
function Resumen({ carga }: { carga: CargaDetalle }) {
  const { evento, totalProductos, totalDiscrepancias } = carga;
  return (
    <Tarjeta conAcento={bandaDeEstado(evento.estado)} style={estilos.resumen}>
      <View style={estilos.cifras}>
        <View style={estilos.cifra} accessible accessibilityLabel={`${totalProductos} productos`}>
          <Text style={estilos.numero}>{totalProductos}</Text>
          <Text style={estilos.unidad}>{totalProductos === 1 ? 'producto' : 'productos'}</Text>
        </View>
        {totalDiscrepancias > 0 ? (
          <View
            style={[estilos.cifra, estilos.cifraTintada]}
            accessible
            accessibilityLabel={`${totalDiscrepancias} con discrepancia`}
          >
            <Text style={[estilos.numero, estilos.numeroDiscrepancia]}>{totalDiscrepancias}</Text>
            <Text style={[estilos.unidad, estilos.unidadDiscrepancia]}>con discrepancia</Text>
          </View>
        ) : (
          <Etiqueta texto="Sin discrepancias" tono="capturado" relleno="tintada" tamano="destacada" />
        )}
      </View>
      <View>
        <FilaDato etiqueta="Contó" valor={evento.vendedorNombre ?? '—'} separado />
        <FilaDato etiqueta="Verificó" valor={evento.contadorNombre ?? 'pendiente'} />
      </View>
      {evento.sinLiquidar && (
        <View style={estilos.marcaSinLiquidar}>
          <Text style={estilos.tituloMarca}>Iniciada con la ruta anterior sin liquidar en Handy</Text>
          <Text style={estilos.textoMarca}>
            Permiso de <Text style={estilos.nombre}>{evento.sinLiquidar.otorgadoPor ?? 'un supervisor'}</Text>
            {evento.sinLiquidar.motivo ? `: “${evento.sinLiquidar.motivo}”` : ''}
          </Text>
        </View>
      )}
      {evento.liquidacionNoVerificada && (
        <Text style={estilos.nota}>Al iniciarla no se pudo confirmar en Handy la liquidación anterior.</Text>
      )}
    </Tarjeta>
  );
}

function EncabezadoFamilia({ familia }: { familia: FamiliaDetalle }) {
  return (
    <View style={estilos.encabezadoFamilia} accessibilityRole="header">
      <Text style={estilos.nombreFamilia} numberOfLines={1}>
        {familia.familia}
      </Text>
      {familia.conDiscrepancia > 0 && (
        <Text style={estilos.discrepanciasFamilia}>
          {familia.conDiscrepancia === 1 ? '1 con discrepancia' : `${familia.conDiscrepancia} con discrepancia`}
        </Text>
      )}
    </View>
  );
}

/** La forma del detalle mientras llega: el resumen y los primeros productos. */
function EsqueletoDetalle() {
  return (
    <Esqueleto etiqueta="Cargando la carga" style={estilos.esqueleto}>
      <TarjetaEsqueleto titulo="numero" lineas={['50%', '50%']} />
      <View style={estilos.encabezadoFamiliaEsqueleto}>
        <LineaEsqueleto nivel="cuerpo" ancho="35%" />
      </View>
      {[0, 1, 2, 3].map((i) => (
        <TarjetaEsqueleto key={i} compacta lineas={['40%']} />
      ))}
    </Esqueleto>
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
    // Ámbar a la izquierda: se distingue de un vistazo al recorrer la lista.
    <Tarjeta compacta acento={discrepancia ? 'discrepancia' : undefined} style={estilos.fila}>
      <View style={estilos.lineaProducto}>
        <EtiquetaFactor producto={producto} grande />
        <Text style={estilos.nombreProducto}>{producto.nombre}</Text>
      </View>
      {/* A la derecha y con dígitos del mismo ancho: las cantidades de todas las tarjetas quedan en columna. */}
      {sinResolver ? (
        <Text style={[estilos.cantidadFinal, estilos.sinResolver]}>Sin resolver</Text>
      ) : (
        <View style={estilos.lineaCantidad}>
          {factor !== null && cantidadFinal !== null && cantidadFinal >= factor && (
            <Text style={estilos.totalPiezas}>{formatearTotalPiezas(cantidadFinal)}</Text>
          )}
          <Text style={estilos.cantidadFinal}>{cantidad(cantidadFinal, factor)}</Text>
        </View>
      )}
      {discrepancia && (
        <Tarjeta elevacion={0} tintada="discrepancia" compacta>
          <Text style={estilos.tituloDiscrepancia}>Tuvo discrepancia</Text>
          <View>
              <FilaDato etiqueta="Vendedor contó" valor={cantidad(discrepancia.vendedor, factor)} />
              <FilaDato etiqueta="Contador contó" valor={cantidad(discrepancia.contador, factor)} />
              <FilaDato etiqueta="Final capturada por" valor={discrepancia.capturadaPor ?? 'nadie aún'} separado />
              <FilaDato etiqueta="Confirmada por" valor={discrepancia.confirmadaPor ?? 'nadie aún'} />
          </View>
        </Tarjeta>
      )}
    </Tarjeta>
  );
}

function ErrorDetalle({ error, onReintentar }: { error: unknown; onReintentar: () => void }) {
  if (error instanceof ErrorApi && error.estado === 403) {
    return (
      <EstadoVacio
        icono="candado"
        titulo="No tienes acceso a esta carga"
        detalle="Solo puedes abrir las cargas que aparecen en tu historial."
        accion={{ texto: 'Volver', onPress: volver }}
      />
    );
  }
  if (error instanceof ErrorApi && error.estado === 404) {
    return (
      <EstadoVacio
        icono="lista"
        titulo="Esta carga no existe"
        detalle="Pudo haberse eliminado. Vuelve al historial para ver las cargas vigentes."
        accion={{ texto: 'Volver', onPress: volver }}
      />
    );
  }
  const sinRed = error instanceof ErrorRed;
  return (
    <View style={estilos.contenedorAviso}>
      <BloqueError
        titulo={sinRed ? 'Sin conexión' : 'No se pudo abrir la carga'}
        detalle={
          sinRed
            ? 'El detalle se consulta en el servidor: revisa tu señal y vuelve a intentarlo.'
            : error instanceof Error && error.message
              ? error.message
              : 'Intenta de nuevo en un momento.'
        }
        tono={sinRed ? 'atencion' : 'error'}
        onReintentar={onReintentar}
        secundaria={{ texto: 'Volver', onPress: volver }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  // Lectura pausada: tarjetas blancas sobre el fondo tintado, cada producto un bloque aparte.
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondoPantalla,
  },
  esqueleto: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    padding: RITMO.margen,
  },
  encabezadoFamiliaEsqueleto: {
    paddingTop: ESPACIADO.lg,
  },
  contenedorAviso: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    padding: RITMO.margen,
  },
  resumen: {
    marginTop: RITMO.margen,
  },
  cifras: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: RITMO.margen,
  },
  cifra: {
    alignItems: 'flex-start',
  },
  cifraTintada: {
    paddingHorizontal: RITMO.margen,
    paddingVertical: ESPACIADO.sm,
    backgroundColor: COLORES.discrepanciaFondo,
    borderRadius: RADIOS.medio,
  },
  numero: {
    ...TIPOGRAFIA.numero,
    color: COLORES.marcaOscuro,
    ...CIFRAS,
  },
  numeroDiscrepancia: {
    color: COLORES.discrepanciaTexto,
  },
  unidad: {
    ...TIPOGRAFIA.micro,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
    textTransform: 'uppercase',
  },
  unidadDiscrepancia: {
    color: COLORES.discrepanciaTexto,
  },
  nombre: {
    fontWeight: PESOS.negrita,
  },
  nota: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
  },
  marcaSinLiquidar: {
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
  textoMarca: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.regular,
    color: COLORES.texto,
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
  // Igual que en el conteo: la familia fija arriba mientras se recorre. Más
  // aire arriba que abajo: agrupa los productos que siguen.
  encabezadoFamilia: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: RITMO.interno,
    marginHorizontal: -RITMO.margen,
    paddingHorizontal: RITMO.margen,
    paddingTop: ESPACIADO.xl,
    paddingBottom: ESPACIADO.xs,
    backgroundColor: COLORES.fondoPantalla,
  },
  nombreFamilia: {
    flex: 1,
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.marcaOscuro,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  discrepanciasFamilia: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.negrita,
    color: COLORES.discrepanciaTexto,
    ...CIFRAS,
  },
  fila: {
    marginTop: RITMO.relacionado,
  },
  lineaProducto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
  },
  nombreProducto: {
    flex: 1,
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.semiNegrita,
    color: COLORES.texto,
  },
  lineaCantidad: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: RITMO.interno,
  },
  // La cantidad final domina la tarjeta: es lo que se carga al camión.
  cantidadFinal: {
    ...TIPOGRAFIA.titulo,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.marcaOscuro,
    textAlign: 'right',
    ...CIFRAS,
  },
  totalPiezas: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
    ...CIFRAS,
  },
  sinResolver: {
    color: COLORES.error,
  },
  tituloDiscrepancia: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.negrita,
    color: COLORES.discrepanciaTexto,
    textTransform: 'uppercase',
  },
});

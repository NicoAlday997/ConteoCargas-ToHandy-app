import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ETIQUETAS_TIPO_CARGA } from '../api/cargas';
import { ErrorApi, ErrorRed } from '../api/cliente';
import {
  BloqueError,
  Datos,
  EstadoVacio,
  Esqueleto,
  Etiqueta,
  LineaEsqueleto,
  Personas,
  Tarjeta,
  TarjetaEsqueleto,
  type Persona,
} from '../componentes/base';
import { factorEfectivo, unidadCompleta, type ProductoConteo } from '../conteo/estado-conteo';
import { diaNegocio, textoSalida } from '../conteo/fecha-operativa';
import { EtiquetaFactor } from '../conteo/FilaProducto';
import { formatearCifra, formatearEnPaquetes, formatearTotalPiezas } from '../conteo/formato-cantidad';
import { CIFRAS, COLORES, ESPACIADO, PESOS, RITMO, ROTULO, TIPOGRAFIA, type ColorEstado } from '../theme/tokens';
import { ANCHO_MAXIMO_LISTA, bandaDeEstado, volver } from './ComponentesHistorial';
import type { CargaDetalle, FamiliaDetalle, ProductoDetalle } from './modelo-historial';

/**
 * Vista consolidada de una carga: por familia, como se acomoda físicamente, y
 * con la cantidad final en paquetes y piezas, que es como se cuenta a la vista.
 * La comparten el historial y la autorización del supervisor: lo que se
 * autoriza se ve exactamente igual que lo que queda en el historial.
 */

export interface SeccionFamilia {
  familia: FamiliaDetalle;
  data: ProductoDetalle[];
}

export function seccionesDeCarga(carga: CargaDetalle | null): SeccionFamilia[] {
  return carga?.familias.map((familia) => ({ familia, data: familia.productos })) ?? [];
}

/**
 * El día al frente, como en un comprobante: es lo que se busca al abrir una
 * carga. La ruta y el tipo acompañan debajo.
 */
export function titulosCarga({ evento }: CargaDetalle): { titulo: string; subtitulo: string } {
  const tipo = evento.tipo ? ETIQUETAS_TIPO_CARGA[evento.tipo] : 'Carga';
  if (!evento.dia) return { titulo: evento.rutaNombre, subtitulo: tipo };
  return { titulo: textoSalida(evento.dia, diaNegocio(new Date())), subtitulo: `${evento.rutaNombre} · ${tipo}` };
}

/** En la unidad en que se contó: paquetes y piezas, o la unidad de lo que se vende completo. */
export function cantidadEnUnidad(piezas: number | null, producto: ProductoConteo): string {
  return piezas === null ? 'Sin dato' : formatearEnPaquetes(piezas, factorEfectivo(producto), unidadCompleta(producto));
}

/**
 * Al frente de la lista, como el total de un pedido. Tres bloques separados por
 * aire: el estado; el total de piezas (el único dato en grande) con productos y
 * discrepancias; y quién participó. Día, ruta y tipo ya van en el encabezado.
 */
export function ResumenCarga({ carga }: { carga: CargaDetalle }) {
  const { evento, totalProductos, totalDiscrepancias, totalPiezas, sinResolver } = carga;
  const personas: Persona[] = [
    { rol: 'Contó', nombre: evento.vendedorNombre },
    { rol: 'Verificó', nombre: evento.contadorNombre },
  ];
  if (evento.autorizadaPorNombre) personas.push({ rol: 'Autorizó', nombre: evento.autorizadaPorNombre });

  return (
    <Tarjeta conAcento={bandaDeEstado(evento.estado)} style={estilos.resumen}>
      <View style={estilos.grupo}>
        <View accessible accessibilityLabel={`${totalPiezas} piezas en total${sinResolver > 0 ? ', sin contar las que faltan por resolver' : ''}`}>
          <Text style={estilos.rotulo}>{sinResolver > 0 ? 'Piezas resueltas' : 'Piezas en total'}</Text>
          <Text style={estilos.numero}>{formatearCifra(totalPiezas)}</Text>
        </View>
        <View style={estilos.filaDatos}>
          <Datos datos={[{ rotulo: 'Productos', valor: String(totalProductos), cifra: true }]} />
          {totalDiscrepancias > 0 ? (
            <Etiqueta
              texto={totalDiscrepancias === 1 ? '1 con discrepancia' : `${totalDiscrepancias} con discrepancia`}
              tono="discrepancia"
            />
          ) : (
            <Etiqueta texto="Sin discrepancias" tono="capturado" />
          )}
          {sinResolver > 0 && <Etiqueta texto={`${sinResolver} sin resolver`} tono="error" />}
        </View>
      </View>
      <View style={estilos.grupo}>
        <Personas personas={personas} />
      </View>
    </Tarjeta>
  );
}

export function EncabezadoFamilia({ familia }: { familia: FamiliaDetalle }) {
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
export function EsqueletoCarga() {
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

/**
 * Un solo punto focal: la cantidad final, que es lo que se sube al camión. El
 * nombre y el empaque la acompañan; la discrepancia, si hubo, va aparte en un
 * bloque tintado con dos grupos: cuánto contó cada quien y quién la resolvió.
 *
 * `pie` va al final de la tarjeta (los controles del supervisor) y `acento`
 * reemplaza la barra ámbar de la discrepancia (p. ej. un producto marcado).
 */
export function TarjetaProducto({
  producto,
  pie,
  acento,
}: {
  producto: ProductoDetalle;
  pie?: ReactNode;
  acento?: ColorEstado;
}) {
  const factor = factorEfectivo(producto);
  const { discrepancia, cantidadFinal } = producto;
  const sinResolver = discrepancia !== null && cantidadFinal === null;

  return (
    // Ámbar a la izquierda: se distingue de un vistazo al recorrer la lista.
    <Tarjeta compacta acento={acento ?? (discrepancia ? 'discrepancia' : undefined)} style={estilos.fila}>
      <View style={estilos.lineaProducto}>
        <EtiquetaFactor producto={producto} />
        <Text style={estilos.nombreProducto}>{producto.nombre}</Text>
      </View>
      {/* A la derecha y con dígitos del mismo ancho: las cantidades de todas las tarjetas quedan en columna. */}
      {sinResolver ? (
        <View style={estilos.lineaCantidad}>
          <Etiqueta texto="Sin resolver" tono="error" tamano="destacada" />
        </View>
      ) : (
        <View style={estilos.lineaCantidad}>
          {factor !== null && cantidadFinal !== null && cantidadFinal >= factor && (
            <Text style={estilos.totalPiezas}>{formatearTotalPiezas(cantidadFinal)}</Text>
          )}
          <Text style={estilos.cantidadFinal}>{cantidadEnUnidad(cantidadFinal, producto)}</Text>
        </View>
      )}
      {discrepancia && (
        <Tarjeta elevacion={0} tintada="discrepancia" compacta style={estilos.bloqueDiscrepancia}>
          <Text style={estilos.tituloDiscrepancia}>Tuvo discrepancia</Text>
          <Datos
            datos={[
              { rotulo: 'Vendedor contó', valor: cantidadEnUnidad(discrepancia.vendedor, producto), cifra: true },
              { rotulo: 'Contador contó', valor: cantidadEnUnidad(discrepancia.contador, producto), cifra: true },
            ]}
          />
          <View style={estilos.grupoDiscrepancia}>
            <Personas
              personas={[
                { rol: 'Capturó la final', nombre: discrepancia.capturadaPor },
                { rol: 'Confirmó', nombre: discrepancia.confirmadaPor },
              ]}
            />
          </View>
        </Tarjeta>
      )}
      {pie}
    </Tarjeta>
  );
}

export function ErrorCarga({ error, onReintentar }: { error: unknown; onReintentar: () => void }) {
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

/** La respuesta llegó pero no trae una carga identificable. */
export function CargaIlegible({ onReintentar, reintentando }: { onReintentar: () => void; reintentando: boolean }) {
  return (
    <View style={estilos.contenedorAviso}>
      <BloqueError
        titulo="No se pudo leer esta carga"
        detalle="El servidor respondió algo que la app no entiende. Intenta de nuevo."
        onReintentar={onReintentar}
        reintentando={reintentando}
      />
    </View>
  );
}

export const estilosVistaCarga = StyleSheet.create({
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
});

const estilos = StyleSheet.create({
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
  // Entre grupos del resumen, aire de grupo; dentro, poco.
  resumen: {
    marginTop: RITMO.margen,
    gap: RITMO.grupo,
  },
  grupo: {
    gap: RITMO.relacionado,
  },
  filaDatos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: RITMO.grupo,
    rowGap: RITMO.relacionado,
  },
  rotulo: ROTULO,
  // El único dato en grande de la pantalla: lo que se sube al camión.
  numero: {
    ...TIPOGRAFIA.numero,
    color: COLORES.marcaOscuro,
    ...CIFRAS,
  },
  // Igual que en el conteo: la familia fija arriba mientras se recorre. Mucho
  // aire arriba y casi nada abajo: agrupa los productos que siguen.
  encabezadoFamilia: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: RITMO.relacionado,
    marginHorizontal: -RITMO.margen,
    paddingHorizontal: RITMO.margen,
    paddingTop: RITMO.grupo,
    paddingBottom: ESPACIADO.xs,
    backgroundColor: COLORES.fondoPantalla,
  },
  nombreFamilia: {
    flex: 1,
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.marcaOscuro,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  discrepanciasFamilia: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.discrepanciaTexto,
    ...CIFRAS,
  },
  fila: {
    marginTop: ESPACIADO.sm,
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
    gap: ESPACIADO.sm,
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
  bloqueDiscrepancia: {
    gap: RITMO.relacionado,
  },
  grupoDiscrepancia: {
    marginTop: RITMO.grupo - RITMO.relacionado,
  },
  tituloDiscrepancia: {
    ...TIPOGRAFIA.etiqueta,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.discrepanciaTexto,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

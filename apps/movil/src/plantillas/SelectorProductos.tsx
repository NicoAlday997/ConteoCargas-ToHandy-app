import { useMemo, useState } from 'react';
import { Modal, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ErrorApi, ErrorRed } from '../api/cliente';
import { useFactoresCatalogo } from '../api/hooks-factores';
import { useAgregarProductos } from '../api/hooks-plantillas';
import {
  BloqueError,
  Boton,
  CampoTexto,
  Encabezado,
  EstadoVacio,
  Esqueleto,
  LineaEsqueleto,
  NotaEncabezado,
  TarjetaEsqueleto,
} from '../componentes/base';
import { contarPendientes, textoProductos } from '../factores/modelo-factores';
import { ANCHO_MAXIMO_LISTA } from '../historial/ComponentesHistorial';
import { COLORES, ESPACIADO, RITMO } from '../theme/tokens';
import { avisoDeError, BarraAcciones, EncabezadoFamilia, FilaProducto, estilosPlantillas } from './ComponentesPlantillas';
import { alternar, alternarVarios, familiasSelector, todosMarcados, type FamiliaSelector, type ProductoSelector } from './modelo-plantillas';

interface Props {
  visible: boolean;
  plantillaId: string;
  nombrePlantilla: string;
  /** Los códigos que ya tiene: se muestran marcados como incluidos y no se pueden volver a agregar. */
  incluidos: ReadonlySet<string>;
  onCerrar: () => void;
  /** Cuántos entraron de verdad (los que ya estaban no cuentan). */
  onAgregados: (cantidad: number) => void;
}

/**
 * El catálogo completo de Handy, por familia, para elegir varios productos y
 * agregarlos de una vez. Con ~100 productos buscar sí hace falta aquí (en el
 * conteo no: ahí se recorre el camión en orden).
 */
export function SelectorProductos(props: Props) {
  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onCerrar}>
      {/* El modal vive fuera del árbol de la app: necesita su propio proveedor de márgenes. */}
      <SafeAreaProvider>{props.visible && <Contenido {...props} />}</SafeAreaProvider>
    </Modal>
  );
}

function Contenido({ plantillaId, nombrePlantilla, incluidos, onCerrar, onAgregados }: Props) {
  const catalogo = useFactoresCatalogo(true);
  const agregar = useAgregarProductos(plantillaId);
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());

  const familias = useMemo(
    () => familiasSelector(catalogo.data ?? [], incluidos, busqueda),
    [catalogo.data, incluidos, busqueda],
  );
  const encontrados = contarPendientes(familias);
  const enviando = agregar.isPending;

  const cerrar = () => {
    if (!enviando) onCerrar();
  };

  const guardar = () => {
    agregar.mutate([...seleccion], {
      onSuccess: (respuesta) => {
        onAgregados(typeof respuesta?.agregados === 'number' ? respuesta.agregados : seleccion.size);
        onCerrar();
      },
    });
  };

  const error = agregar.isError ? avisoDeError(agregar.error, 'No se pudieron agregar') : null;

  let lista;
  if (catalogo.isPending) {
    lista = (
      <Esqueleto etiqueta="Cargando el catálogo" style={estilos.esqueleto}>
        <View style={estilos.encabezadoEsqueleto}>
          <LineaEsqueleto nivel="titulo" ancho="45%" />
        </View>
        {[0, 1, 2, 3].map((i) => (
          <TarjetaEsqueleto key={i} compacta lineas={['35%']} />
        ))}
      </Esqueleto>
    );
  } else if (catalogo.isError && !catalogo.data?.length) {
    const sinRed = catalogo.error instanceof ErrorRed;
    lista = (
      <View style={estilos.aviso}>
        <BloqueError
          titulo={sinRed ? 'Sin conexión' : 'No se pudo cargar el catálogo'}
          detalle={
            sinRed
              ? 'El catálogo se consulta en el servidor: revisa tu señal y vuelve a intentarlo.'
              : catalogo.error instanceof ErrorApi && catalogo.error.message
                ? catalogo.error.message
                : 'Intenta de nuevo en un momento.'
          }
          tono={sinRed ? 'atencion' : 'error'}
          onReintentar={() => void catalogo.refetch()}
          reintentando={catalogo.isFetching}
        />
      </View>
    );
  } else if (familias.length === 0) {
    lista = busqueda.trim() ? (
      <EstadoVacio
        icono="caja"
        titulo={`Ningún producto coincide con “${busqueda.trim()}”`}
        detalle="Prueba con una parte del nombre, como “pepsi” o “600”."
        accion={{ texto: 'Borrar búsqueda', onPress: () => setBusqueda('') }}
      />
    ) : (
      <EstadoVacio
        icono="caja"
        titulo="No hay productos activos"
        detalle="Sincroniza el catálogo con Handy para traerlos."
        accion={{ texto: 'Actualizar', onPress: () => void catalogo.refetch() }}
      />
    );
  } else {
    lista = (
      <SectionList<ProductoSelector, FamiliaSelector>
        style={estilos.lista}
        contentContainerStyle={estilos.contenidoLista}
        sections={familias}
        keyExtractor={(p) => p.code}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderSectionHeader={({ section }) => (
          <EncabezadoFamilia
            titulo={section.titulo}
            detalle={
              section.disponibles.length === 0
                ? 'Todos ya están'
                : section.disponibles.length === section.data.length
                  ? textoProductos(section.data.length)
                  : `${section.disponibles.length} de ${section.data.length} por agregar`
            }
            accion={
              section.disponibles.length > 1
                ? {
                    texto: todosMarcados(seleccion, section.disponibles) ? 'Desmarcar' : 'Marcar todos',
                    onPress: () => setSeleccion((s) => alternarVarios(s, section.disponibles)),
                    accessibilityLabel: todosMarcados(seleccion, section.disponibles)
                      ? `Desmarcar la familia ${section.titulo}`
                      : `Marcar los ${section.disponibles.length} productos de ${section.titulo} que faltan`,
                  }
                : undefined
            }
          />
        )}
        renderItem={({ item }) => (
          <FilaProducto
            nombre={item.nombre}
            empaque={item.confirmado}
            modo={
              item.incluido
                ? { tipo: 'incluido' }
                : {
                    tipo: 'seleccion',
                    marcado: seleccion.has(item.code),
                    tono: 'marca',
                    onAlternar: () => setSeleccion((s) => alternar(s, item.code)),
                  }
            }
          />
        )}
      />
    );
  }

  return (
    <SafeAreaView style={estilos.pantalla}>
      <Encabezado
        titulo="Agregar productos"
        subtitulo={nombrePlantilla}
        onVolver={cerrar}
        etiquetaVolver="Cerrar sin agregar"
        marca
      >
        <NotaEncabezado>Marca los que debe ver el vendedor al contar. Los que ya están no se repiten.</NotaEncabezado>
      </Encabezado>
      {/* Fuera de la lista: si viviera en su encabezado, cada letra lo redibujaría y perdería el foco. */}
      <View style={estilos.buscador}>
        <CampoTexto
          etiqueta="Buscar producto"
          valor={busqueda}
          onCambiar={setBusqueda}
          ejemplo="Nombre, familia o código"
          ayuda={busqueda.trim() && catalogo.data ? `${textoProductos(encontrados)} encontrados` : null}
          maxLength={60}
        />
      </View>
      {lista}
      <BarraAcciones>
        {error && <BloqueError titulo={error.titulo} detalle={error.detalle} tono={error.tono} />}
        <View style={estilosPlantillas.filaBotones}>
          <Boton texto="Cancelar" variante="secundario" onPress={cerrar} deshabilitado={enviando} style={estilosPlantillas.botonFila} />
          <Boton
            texto={seleccion.size === 0 ? 'Agregar' : `Agregar ${seleccion.size}`}
            onPress={guardar}
            deshabilitado={seleccion.size === 0}
            cargando={enviando}
            textoCargando="Agregando…"
            accessibilityLabel={seleccion.size === 0 ? 'Agregar: marca al menos un producto' : `Agregar ${textoProductos(seleccion.size)}`}
            style={estilosPlantillas.botonFila}
          />
        </View>
      </BarraAcciones>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondoPantalla,
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
    paddingBottom: ESPACIADO.xl,
  },
  esqueleto: {
    flex: 1,
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    paddingHorizontal: RITMO.margen,
  },
  encabezadoEsqueleto: {
    paddingTop: ESPACIADO.xl,
  },
  aviso: {
    flex: 1,
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    padding: RITMO.margen,
  },
});

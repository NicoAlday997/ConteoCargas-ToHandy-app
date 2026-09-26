import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useEditarPlantilla, usePlantilla, useQuitarProductos } from '../../src/api/hooks-plantillas';
import { CODIGO_PLANTILLA_EN_USO } from '../../src/api/plantillas';
import {
  BloqueError,
  Boton,
  Encabezado,
  EstadoVacio,
  Esqueleto,
  LineaEsqueleto,
  NotaEncabezado,
  Seccion,
  Tarjeta,
  TarjetaEsqueleto,
} from '../../src/componentes/base';
import { textoProductos } from '../../src/factores/modelo-factores';
import { ANCHO_MAXIMO_LISTA, volver } from '../../src/historial/ComponentesHistorial';
import {
  avisoDeError,
  BarraAcciones,
  EncabezadoFamilia,
  estilosPlantillas,
  FilaProducto,
  sesionVencida,
} from '../../src/plantillas/ComponentesPlantillas';
import { ModalDatosPlantilla } from '../../src/plantillas/ModalDatosPlantilla';
import { ModalRutas } from '../../src/plantillas/ModalRutas';
import {
  alternar,
  alternarVarios,
  codigosDe,
  textoCantidadRutas,
  textoRutas,
  todosMarcados,
  type DetallePlantilla,
  type FamiliaPlantilla,
  type ProductoPlantilla,
} from '../../src/plantillas/modelo-plantillas';
import { SelectorProductos } from '../../src/plantillas/SelectorProductos';
import { ModalConfirmacion } from '../../src/supervisor/ModalConfirmacion';
import { useEsSupervisor } from '../../src/supervisor/useEsSupervisor';
import { COLORES, ESPACIADO, FUENTE, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../../src/theme/tokens';

/**
 * Detalle de una plantilla (solo Supervisor): sus productos por familia, en
 * el mismo orden en que el vendedor los verá al contar, y las rutas que la
 * usan. Desde aquí se agregan y quitan productos y se asigna a rutas.
 *
 * Quitar un producto no toca las cargas ya creadas: sus conteos se conservan
 * y una carga en curso que ya lo contó lo sigue mostrando. Solo las cargas
 * nuevas dejan de verlo.
 */

/** El botón "Editar" del encabezado mide lo que el título; el toque se completa con hitSlop. */
const ALTO_BOTON_EDITAR = ESPACIADO.xxl;

function parametro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

export default function PantallaPlantilla() {
  const params = useLocalSearchParams<{ plantillaId: string }>();
  const plantillaId = parametro(params.plantillaId);
  const esSupervisor = useEsSupervisor();

  if (esSupervisor === undefined) {
    return (
      <Pantalla titulo="Plantilla">
        <EsqueletoDetalle />
      </Pantalla>
    );
  }

  if (!esSupervisor) {
    return (
      <Pantalla titulo="Plantilla">
        <EstadoVacio
          icono="candado"
          titulo="Solo para supervisores"
          detalle="Qué productos ve cada ruta al contar lo decide un supervisor. Si falta un producto en tu lista, avísale."
          accion={{ texto: 'Volver', onPress: volver }}
        />
      </Pantalla>
    );
  }

  return <Detalle plantillaId={plantillaId} />;
}

function Pantalla({
  titulo,
  subtitulo,
  nota,
  accion,
  children,
}: {
  titulo: string;
  subtitulo?: string | null;
  nota?: string | null;
  accion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={estilos.pantalla}>
      <Encabezado titulo={titulo} subtitulo={subtitulo} onVolver={volver} accion={accion}>
        {nota ? <NotaEncabezado>{nota}</NotaEncabezado> : null}
      </Encabezado>
      {children}
    </SafeAreaView>
  );
}

type Modo = 'ver' | 'quitar';

function Detalle({ plantillaId }: { plantillaId: string }) {
  const consulta = usePlantilla(plantillaId, true);
  const editar = useEditarPlantilla(plantillaId);
  const quitar = useQuitarProductos(plantillaId);
  const [modo, setModo] = useState<Modo>('ver');
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [viendoRutas, setViendoRutas] = useState(false);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);
  const [confirmandoDesactivar, setConfirmandoDesactivar] = useState(false);
  /** Lo que acaba de pasar ("Se agregaron 3 productos"): se ve hasta la siguiente acción. */
  const [aviso, setAviso] = useState<string | null>(null);

  const plantilla = consulta.data ?? null;
  const incluidos = useMemo(() => codigosDe(plantilla?.familias ?? []), [plantilla]);

  const vencida = consulta.error instanceof ErrorApi && consulta.error.estado === 401;
  useEffect(() => {
    if (vencida) sesionVencida();
  }, [vencida]);

  const cambiarModo = (nuevo: Modo) => {
    setAviso(null);
    setSeleccion(new Set());
    setModo(nuevo);
  };

  if (consulta.isPending) {
    return (
      <Pantalla titulo="Plantilla">
        <EsqueletoDetalle />
      </Pantalla>
    );
  }

  if (!plantilla) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.estado === 404;
    const sinRed = consulta.error instanceof ErrorRed;
    return (
      <Pantalla titulo="Plantilla">
        {noExiste ? (
          <EstadoVacio
            icono="caja"
            titulo="Esta plantilla ya no existe"
            detalle="Vuelve a la lista para ver las plantillas actuales."
            accion={{ texto: 'Volver', onPress: volver }}
          />
        ) : (
          <View style={estilos.aviso}>
            <BloqueError
              titulo={sinRed ? 'Sin conexión' : 'No se pudo cargar la plantilla'}
              detalle={
                sinRed
                  ? 'La plantilla se consulta en el servidor: revisa tu señal y vuelve a intentarlo.'
                  : (consulta.error instanceof Error && consulta.error.message) || 'Intenta de nuevo en un momento.'
              }
              tono={sinRed ? 'atencion' : 'error'}
              onReintentar={() => void consulta.refetch()}
              reintentando={consulta.isFetching}
              secundaria={{ texto: 'Volver', onPress: volver }}
            />
          </View>
        )}
      </Pantalla>
    );
  }

  const seleccionados = plantilla.familias.flatMap((f) => f.data).filter((p) => seleccion.has(p.code));

  const confirmarQuitar = () => {
    quitar.mutate(
      seleccionados.map((p) => p.code),
      {
        onSuccess: () => {
          setConfirmandoQuitar(false);
          cambiarModo('ver');
          setAviso(
            seleccionados.length === 1
              ? `Se quitó ${seleccionados[0]?.nombre}.`
              : `Se quitaron ${textoProductos(seleccionados.length)}.`,
          );
        },
      },
    );
  };

  const errorQuitar = quitar.isError ? avisoDeError(quitar.error, 'No se pudieron quitar') : null;
  const errorEstado = editar.isError && !editandoDatos ? errorDeEstado(editar.error) : null;

  const encabezadoLista =
    modo === 'ver' ? (
      <View style={estilos.encabezadoLista}>
        {!plantilla.activa && (
          <BloqueError
            tono="atencion"
            titulo="Plantilla desactivada"
            detalle="Ninguna ruta puede usarla mientras esté desactivada. Puedes prepararla y activarla después."
            onReintentar={() => {
              editar.reset();
              editar.mutate({ activa: true }, { onSuccess: () => setAviso('La plantilla está activa de nuevo.') });
            }}
            textoReintentar="Activar"
            reintentando={editar.isPending}
          />
        )}
        {errorEstado && <BloqueError titulo={errorEstado.titulo} detalle={errorEstado.detalle} tono={errorEstado.tono} />}
        {aviso && (
          <Tarjeta tintada="capturado" compacta accessible accessibilityLabel={aviso}>
            <Text style={estilos.textoAviso} accessibilityLiveRegion="polite">
              {aviso}
            </Text>
          </Tarjeta>
        )}
        <Seccion
          texto="Rutas que la usan"
          accion={{
            texto: 'Cambiar',
            onPress: () => {
              setAviso(null);
              setViendoRutas(true);
            },
            accessibilityLabel: 'Cambiar las rutas que usan esta plantilla',
          }}
        >
          <Tarjeta compacta>
            <Text style={plantilla.rutas.length > 0 ? estilos.rutas : estilos.sinRutas}>
              {plantilla.rutas.length > 0 ? textoRutas(plantilla.rutas) : 'Ninguna ruta la usa: ningún vendedor ve estos productos.'}
            </Text>
          </Tarjeta>
        </Seccion>
        <Seccion texto="Productos" detalle={textoProductos(plantilla.totalProductos)}>
          <View style={estilosPlantillas.filaBotones}>
            <Boton
              texto="Agregar"
              onPress={() => {
                setAviso(null);
                setAgregando(true);
              }}
              accessibilityLabel="Agregar productos del catálogo"
              style={estilosPlantillas.botonFila}
            />
            <Boton
              texto="Quitar"
              variante="secundario"
              onPress={() => cambiarModo('quitar')}
              deshabilitado={plantilla.totalProductos === 0}
              accessibilityLabel="Quitar productos de la plantilla"
              style={estilosPlantillas.botonFila}
            />
          </View>
        </Seccion>
      </View>
    ) : (
      <View style={estilos.encabezadoLista}>
        <Text style={estilos.instruccion}>
          Marca los productos que quieres quitar. Las cargas ya iniciadas y el historial no cambian.
        </Text>
      </View>
    );

  const pieLista =
    modo === 'ver' ? (
      <PieEstado
        plantilla={plantilla}
        onDesactivar={() => {
          editar.reset();
          setAviso(null);
          setConfirmandoDesactivar(true);
        }}
      />
    ) : null;

  return (
    <Pantalla
      titulo={plantilla.nombre}
      subtitulo={`${textoProductos(plantilla.totalProductos)} · ${textoCantidadRutas(plantilla.rutas.length)}`}
      nota={plantilla.descripcion}
      accion={
        modo === 'ver' ? (
          <BotonEditar
            onPress={() => {
              editar.reset();
              setAviso(null);
              setEditandoDatos(true);
            }}
          />
        ) : undefined
      }
    >
      <SectionList<ProductoPlantilla, FamiliaPlantilla>
        style={estilos.lista}
        contentContainerStyle={estilos.contenidoLista}
        sections={plantilla.familias}
        keyExtractor={(p) => p.code}
        stickySectionHeadersEnabled={false}
        refreshing={consulta.isRefetching && !editar.isPending && !quitar.isPending}
        onRefresh={() => void consulta.refetch()}
        ListHeaderComponent={encabezadoLista}
        ListFooterComponent={pieLista}
        ListEmptyComponent={
          <EstadoVacio
            icono="caja"
            titulo="La plantilla no tiene productos"
            detalle="Agrégale los que deben ver los vendedores de sus rutas al contar."
            accion={{ texto: 'Agregar productos', onPress: () => setAgregando(true) }}
            enLinea
          />
        }
        renderSectionHeader={({ section }) => {
          const codes = section.data.map((p) => p.code);
          const todos = todosMarcados(seleccion, codes);
          return (
            <EncabezadoFamilia
              titulo={section.titulo}
              detalle={textoProductos(section.data.length)}
              accion={
                modo === 'quitar' && codes.length > 1
                  ? {
                      texto: todos ? 'Desmarcar' : 'Marcar todos',
                      onPress: () => setSeleccion((s) => alternarVarios(s, codes)),
                      accessibilityLabel: todos
                        ? `Desmarcar la familia ${section.titulo}`
                        : `Marcar los ${codes.length} productos de ${section.titulo} para quitarlos`,
                    }
                  : undefined
              }
            />
          );
        }}
        renderItem={({ item }) => (
          <FilaProducto
            nombre={item.nombre}
            empaque={item.empaque}
            inactivo={!item.activo}
            modo={
              modo === 'quitar'
                ? {
                    tipo: 'seleccion',
                    marcado: seleccion.has(item.code),
                    tono: 'error',
                    onAlternar: () => setSeleccion((s) => alternar(s, item.code)),
                  }
                : { tipo: 'lectura' }
            }
          />
        )}
      />

      {modo === 'quitar' && (
        <BarraAcciones>
          <View style={estilosPlantillas.filaBotones}>
            <Boton texto="Cancelar" variante="secundario" onPress={() => cambiarModo('ver')} style={estilosPlantillas.botonFila} />
            <Boton
              texto={seleccion.size === 0 ? 'Quitar' : `Quitar ${seleccion.size}`}
              variante="peligro"
              onPress={() => {
                quitar.reset();
                setConfirmandoQuitar(true);
              }}
              deshabilitado={seleccion.size === 0}
              accessibilityLabel={seleccion.size === 0 ? 'Quitar: marca al menos un producto' : `Quitar ${textoProductos(seleccion.size)}`}
              style={estilosPlantillas.botonFila}
            />
          </View>
        </BarraAcciones>
      )}

      <ModalConfirmacion
        visible={confirmandoQuitar}
        titulo={seleccionados.length === 1 ? '¿Quitar 1 producto?' : `¿Quitar ${textoProductos(seleccionados.length)}?`}
        textoConfirmar="Quitar"
        textoCargando="Quitando…"
        variante="peligro"
        cargando={quitar.isPending}
        error={errorQuitar}
        onConfirmar={confirmarQuitar}
        onCerrar={() => setConfirmandoQuitar(false)}
      >
        <Tarjeta elevacion={0} compacta>
          {seleccionados.slice(0, MAXIMO_LISTADOS).map((p) => (
            <Text key={p.code} style={estilos.productoListado} numberOfLines={2}>
              {p.nombre}
            </Text>
          ))}
          {seleccionados.length > MAXIMO_LISTADOS && (
            <Text style={estilos.detalleModal}>y {textoProductos(seleccionados.length - MAXIMO_LISTADOS)} más</Text>
          )}
        </Tarjeta>
        <Text style={estilos.detalleModal}>
          {plantilla.rutas.length > 0
            ? `Las próximas cargas de ${textoRutas(plantilla.rutas)} ya no los mostrarán.`
            : 'Las cargas que usen esta plantilla ya no los mostrarán.'}{' '}
          Lo ya contado no se pierde: las cargas iniciadas los conservan y el historial no cambia.
        </Text>
      </ModalConfirmacion>

      <ModalConfirmacion
        visible={confirmandoDesactivar}
        titulo="¿Desactivar la plantilla?"
        textoConfirmar="Desactivar"
        textoCargando="Desactivando…"
        variante="peligro"
        cargando={editar.isPending}
        error={editar.isError ? errorDeEstado(editar.error) : null}
        onConfirmar={() =>
          editar.mutate(
            { activa: false },
            {
              onSuccess: () => {
                setConfirmandoDesactivar(false);
                setAviso('La plantilla quedó desactivada.');
              },
            },
          )
        }
        onCerrar={() => {
          editar.reset();
          setConfirmandoDesactivar(false);
        }}
      >
        <Text style={estilos.detalleModal}>
          Deja de poder asignarse a rutas. Sus productos se conservan y puedes volver a activarla cuando quieras.
        </Text>
      </ModalConfirmacion>

      <ModalDatosPlantilla
        visible={editandoDatos}
        titulo="Editar plantilla"
        textoGuardar="Guardar"
        inicial={{ nombre: plantilla.nombre, descripcion: plantilla.descripcion }}
        guardando={editar.isPending}
        error={editar.error}
        onCerrar={() => {
          editar.reset();
          setEditandoDatos(false);
        }}
        onGuardar={(datos) => editar.mutate(datos, { onSuccess: () => setEditandoDatos(false) })}
      />

      <SelectorProductos
        visible={agregando}
        plantillaId={plantilla.id}
        nombrePlantilla={plantilla.nombre}
        incluidos={incluidos}
        onCerrar={() => setAgregando(false)}
        onAgregados={(cantidad) =>
          setAviso(cantidad === 1 ? 'Se agregó 1 producto.' : `Se agregaron ${textoProductos(cantidad)}.`)
        }
      />

      <ModalRutas
        visible={viendoRutas}
        plantilla={plantilla}
        onCerrar={() => setViendoRutas(false)}
      />
    </Pantalla>
  );
}

/** Cuántos nombres caben en la confirmación antes de resumir el resto. */
const MAXIMO_LISTADOS = 8;

/** El 409 de "en uso" se explica con qué hacer; lo demás, como cualquier error. */
function errorDeEstado(e: unknown) {
  if (e instanceof ErrorApi && e.cuerpo?.codigo === CODIGO_PLANTILLA_EN_USO) {
    return {
      titulo: 'Hay rutas que la usan',
      detalle: 'Asigna otra plantilla a esas rutas antes de desactivarla.',
      tono: 'atencion' as const,
    };
  }
  return avisoDeError(e, 'No se pudo cambiar');
}

/**
 * Desactivar va al final y en secundario: se usa poco. Con rutas que la usan
 * no se ofrece; se dice qué hacer primero.
 */
function PieEstado({ plantilla, onDesactivar }: { plantilla: DetallePlantilla; onDesactivar: () => void }) {
  if (!plantilla.activa) return null;
  const enUso = plantilla.rutas.length > 0;
  return (
    <Seccion texto="Desactivar" style={estilos.pie}>
      <Text style={estilos.instruccion}>
        {enUso
          ? `La usa${plantilla.rutas.length === 1 ? '' : 'n'} ${textoRutas(plantilla.rutas)}. Para desactivarla, primero asigna otra plantilla a ${plantilla.rutas.length === 1 ? 'esa ruta' : 'esas rutas'}.`
          : 'Ninguna ruta la usa. Desactivada deja de poder asignarse, pero conserva sus productos.'}
      </Text>
      <Boton texto="Desactivar plantilla" variante="secundario" onPress={onDesactivar} deshabilitado={enUso} />
    </Seccion>
  );
}

/** Pastilla clara sobre el azul del encabezado: se ve tocable sin competir con el nombre. */
function BotonEditar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Editar nombre y descripción"
      hitSlop={{ top: (TOQUE_MINIMO - ALTO_BOTON_EDITAR) / 2, bottom: (TOQUE_MINIMO - ALTO_BOTON_EDITAR) / 2 }}
      style={({ pressed }) => [estilos.botonEditar, pressed && estilos.botonEditarPresionado]}
    >
      {({ pressed }) => <Text style={[estilos.textoEditar, pressed && estilos.textoInvertido]}>Editar</Text>}
    </Pressable>
  );
}

function EsqueletoDetalle() {
  return (
    <Esqueleto etiqueta="Cargando la plantilla" style={estilos.esqueleto}>
      <TarjetaEsqueleto compacta lineas={['60%']} />
      <View style={estilos.encabezadoEsqueleto}>
        <LineaEsqueleto nivel="titulo" ancho="45%" />
      </View>
      {[0, 1, 2].map((i) => (
        <TarjetaEsqueleto key={i} compacta lineas={['35%']} />
      ))}
    </Esqueleto>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
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
  encabezadoLista: {
    gap: RITMO.grupo,
    paddingTop: RITMO.margen,
  },
  pie: {
    marginTop: RITMO.seccion,
  },
  aviso: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    padding: RITMO.margen,
  },
  esqueleto: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    padding: RITMO.margen,
  },
  encabezadoEsqueleto: {
    paddingTop: ESPACIADO.xl,
  },
  textoAviso: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    color: COLORES.capturadoTexto,
  },
  rutas: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  sinRutas: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },
  instruccion: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },
  detalleModal: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  productoListado: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    color: COLORES.texto,
  },
  botonEditar: {
    height: ALTO_BOTON_EDITAR,
    paddingHorizontal: ESPACIADO.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
    backgroundColor: COLORES.superficieHonda,
  },
  botonEditarPresionado: {
    backgroundColor: COLORES.texto,
  },
  textoEditar: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.negrita,
    color: COLORES.texto,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
});

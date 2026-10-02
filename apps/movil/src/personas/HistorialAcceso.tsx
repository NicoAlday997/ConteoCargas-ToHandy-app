import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorRed } from '../api/cliente';
import {
  ACCESOS_RECIENTES,
  useAccesosRecientes,
  useAccesosTodos,
} from '../api/hooks-personas';
import {
  BloqueError,
  Boton,
  Encabezado,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  Glifo,
  Tarjeta,
  TarjetaEsqueleto,
  TituloSeccion,
} from '../componentes/base';
import {
  ANCHO_MAXIMO_LISTA,
  COLORES,
  ESPACIADO,
  FUENTE,
  RITMO,
  TIPOGRAFIA,
} from '../theme/tokens';
import {
  normalizarAccesos,
  SIN_MOTIVO,
  textoBloqueoQuitado,
  textoMomento,
  textoVerTodo,
  tituloMovimiento,
  type MovimientoAcceso,
} from './modelo-accesos';
import type { Persona } from './modelo-personas';

/**
 * Historial de acceso de una persona: quién le restableció el PIN o le quitó
 * el bloqueo, y cuándo. SOLO LECTURA, para todos y siempre: ni aquí ni en el
 * servidor hay forma de editar o borrar un renglón. Si algo hubiera que
 * corregir, se agrega un renglón nuevo que lo explique.
 */

const NOTA_SOLO_LECTURA =
  'Queda registro de cada restablecimiento y desbloqueo. No se puede editar ni borrar.';

function textoError(error: unknown): string {
  if (error instanceof ErrorRed)
    return 'Sin conexión: revisa tu señal y vuelve a intentarlo.';
  return error instanceof Error && error.message
    ? error.message
    : 'Intenta de nuevo en un momento.';
}

/** La sección de la ficha: los últimos movimientos y, si hay más, «Ver todo». */
export function SeccionHistorialAcceso({
  personaId,
  ahora,
  onVerTodo,
}: {
  personaId: string;
  ahora: number;
  onVerTodo: () => void;
}) {
  const consulta = useAccesosRecientes(personaId);
  const movimientos = normalizarAccesos(consulta.data?.items);
  const total = consulta.data?.total ?? movimientos.length;

  let contenido;
  if (consulta.isPending) {
    contenido = (
      <Esqueleto etiqueta="Cargando historial de acceso">
        <TarjetaEsqueleto compacta />
      </Esqueleto>
    );
  } else if (consulta.isError) {
    contenido = (
      <BloqueError
        titulo="No se pudo cargar el historial de acceso"
        detalle={textoError(consulta.error)}
        tono={consulta.error instanceof ErrorRed ? 'atencion' : 'error'}
        onReintentar={() => void consulta.refetch()}
        reintentando={consulta.isFetching}
      />
    );
  } else if (movimientos.length === 0) {
    contenido = (
      <EstadoVacio
        enLinea
        icono="candado"
        titulo="Sin movimientos de acceso"
        detalle="A esta persona nunca se le ha restablecido el PIN ni quitado un bloqueo. Cuando pase, quedará aquí."
      />
    );
  } else {
    contenido = (
      <>
        <ListaMovimientos movimientos={movimientos} ahora={ahora} />
        {total > ACCESOS_RECIENTES && (
          <Boton
            texto={textoVerTodo(total)}
            variante="secundario"
            onPress={onVerTodo}
          />
        )}
      </>
    );
  }

  return (
    <View style={estilos.bloque}>
      <TituloSeccion texto="Historial de acceso" nivel="grupo" />
      <Text style={estilos.nota}>{NOTA_SOLO_LECTURA}</Text>
      {contenido}
    </View>
  );
}

/** Todo el historial, por páginas, al tocar «Ver todo». */
export function PantallaHistorialAcceso({
  persona,
  ahora,
  onVolver,
}: {
  persona: Persona;
  ahora: number;
  onVolver: () => void;
}) {
  const consulta = useAccesosTodos(persona.id);
  const movimientos = normalizarAccesos(
    consulta.data?.pages.flatMap((p) => p?.items ?? []),
  );

  let contenido;
  if (consulta.isPending) {
    contenido = (
      <Esqueleto
        etiqueta="Cargando historial de acceso"
        style={estilos.contenido}
      >
        <TarjetaEsqueleto compacta />
        <TarjetaEsqueleto compacta />
      </Esqueleto>
    );
  } else if (consulta.isError && movimientos.length === 0) {
    contenido = (
      <View style={estilos.contenido}>
        <BloqueError
          titulo="No se pudo cargar el historial de acceso"
          detalle={textoError(consulta.error)}
          tono={consulta.error instanceof ErrorRed ? 'atencion' : 'error'}
          onReintentar={() => void consulta.refetch()}
          reintentando={consulta.isFetching}
        />
      </View>
    );
  } else {
    contenido = (
      <FlatList
        contentContainerStyle={estilos.contenido}
        data={movimientos}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <Movimiento movimiento={item} ahora={ahora} />
        )}
        ListHeaderComponent={
          <Text style={estilos.nota}>{NOTA_SOLO_LECTURA}</Text>
        }
        ListEmptyComponent={
          <EstadoVacio
            enLinea
            icono="candado"
            titulo="Sin movimientos de acceso"
          />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (consulta.hasNextPage && !consulta.isFetchingNextPage)
            void consulta.fetchNextPage();
        }}
        ListFooterComponent={
          consulta.isFetchingNextPage ? (
            <Esqueleto etiqueta="Cargando más movimientos">
              <TarjetaEsqueleto compacta />
            </Esqueleto>
          ) : consulta.isFetchNextPageError ? (
            <BloqueError
              titulo="No se pudieron cargar más movimientos"
              detalle={textoError(consulta.error)}
              onReintentar={() => void consulta.fetchNextPage()}
            />
          ) : null
        }
      />
    );
  }

  return (
    <SafeAreaView style={estilos.pantalla} edges={['left', 'right', 'bottom']}>
      <Encabezado
        variante="barra"
        titulo="Historial de acceso"
        subtitulo={persona.nombre}
        onVolver={onVolver}
      />
      {contenido}
    </SafeAreaView>
  );
}

function ListaMovimientos({
  movimientos,
  ahora,
}: {
  movimientos: readonly MovimientoAcceso[];
  ahora: number;
}) {
  return (
    <View style={estilos.lista}>
      {movimientos.map((m) => (
        <Movimiento key={m.id} movimiento={m} ahora={ahora} />
      ))}
    </View>
  );
}

/**
 * Un renglón. El de línea de comandos va aparte, en rojo y con la etiqueta
 * «Emergencia»: nadie inició sesión para hacerlo, solo quedó el motivo, y no
 * debe confundirse con la acción normal de un supervisor.
 */
function Movimiento({
  movimiento: m,
  ahora,
}: {
  movimiento: MovimientoAcceso;
  ahora: number;
}) {
  const titulo = tituloMovimiento(m);
  const cuando = textoMomento(m.fecha, ahora);

  if (m.tipo === 'pin-emergencia') {
    const motivo = m.motivo || SIN_MOTIVO;
    return (
      <Tarjeta
        tintada="error"
        elevacion={0}
        compacta
        style={estilos.emergencia}
        accessible
        accessibilityLabel={`Intervención de emergencia. ${titulo}. Motivo: ${motivo}. ${cuando}`}
      >
        <View style={estilos.fila}>
          <Glifo nombre="alerta" color={COLORES.errorTexto} />
          <View style={estilos.textos}>
            <View style={estilos.cabeza}>
              <Etiqueta texto="Emergencia" tono="error" relleno="solida" />
            </View>
            <Text style={[estilos.titulo, estilos.tituloEmergencia]}>
              {titulo}
            </Text>
            <Text style={estilos.motivo}>
              {m.motivo ? `«${m.motivo}»` : SIN_MOTIVO}
            </Text>
            <Text style={estilos.cuandoEmergencia}>{cuando}</Text>
          </View>
        </View>
      </Tarjeta>
    );
  }

  const extra = m.tipo === 'desbloqueo' ? textoBloqueoQuitado(m) : null;
  return (
    <Tarjeta
      elevacion={0}
      compacta
      accessible
      accessibilityLabel={[titulo, extra, cuando].filter(Boolean).join('. ')}
    >
      <View style={estilos.fila}>
        <Glifo
          nombre={m.tipo === 'pin' ? 'candado' : 'reloj'}
          color={COLORES.textoSecundario}
        />
        <View style={estilos.textos}>
          <Text style={estilos.titulo}>{titulo}</Text>
          {extra && <Text style={estilos.detalle}>{extra}</Text>}
          <Text style={estilos.cuando}>{cuando}</Text>
        </View>
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  contenido: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    padding: RITMO.margen,
    paddingBottom: ESPACIADO.xxxl,
  },
  bloque: {
    gap: RITMO.relacionado,
  },
  lista: {
    gap: ESPACIADO.sm,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ESPACIADO.md,
  },
  textos: {
    flex: 1,
    gap: ESPACIADO.xs,
  },
  cabeza: {
    flexDirection: 'row',
  },
  emergencia: {
    borderLeftWidth: ESPACIADO.xs,
    borderLeftColor: COLORES.error,
  },
  titulo: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    color: COLORES.texto,
  },
  tituloEmergencia: {
    color: COLORES.errorTexto,
  },
  motivo: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.errorTexto,
  },
  detalle: {
    ...TIPOGRAFIA.micro,
    color: COLORES.texto,
  },
  cuando: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoSecundario,
  },
  cuandoEmergencia: {
    ...TIPOGRAFIA.micro,
    color: COLORES.errorTexto,
  },
  nota: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoSecundario,
  },
});

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useCrearPlantilla, usePlantillas } from '../../src/api/hooks-plantillas';
import {
  BloqueError,
  Boton,
  Chevron,
  Esqueleto,
  EstadoVacio,
  NotaEncabezado,
  Seccion,
  Tarjeta,
  TarjetaEsqueleto,
} from '../../src/componentes/base';
import { textoProductos } from '../../src/factores/modelo-factores';
import { ANCHO_MAXIMO_LISTA, BarraSuperior, volver } from '../../src/historial/ComponentesHistorial';
import { sesionVencida } from '../../src/plantillas/ComponentesPlantillas';
import { ModalDatosPlantilla } from '../../src/plantillas/ModalDatosPlantilla';
import { textoRutas, type Plantilla } from '../../src/plantillas/modelo-plantillas';
import { useEsSupervisor } from '../../src/supervisor/useEsSupervisor';
import { CIFRAS, COLORES, ESPACIADO, ETIQUETA_DATO, FUENTE, RITMO, ROTULO, TIPOGRAFIA } from '../../src/theme/tokens';

/**
 * Plantillas de carga (solo Supervisor): qué productos ve el vendedor de cada
 * ruta al contar. Cuando entra un producto nuevo a Handy, aquí se agrega a la
 * plantilla que corresponda; si no, el vendedor nunca lo ve.
 */

const TITULO = 'Plantillas de carga';

function abrir(plantillaId: string) {
  router.push({ pathname: '/plantillas/[plantillaId]', params: { plantillaId } });
}

export default function PantallaPlantillas() {
  const esSupervisor = useEsSupervisor();

  if (esSupervisor === undefined) {
    return (
      <Pantalla>
        <EsqueletoLista />
      </Pantalla>
    );
  }

  if (!esSupervisor) {
    return (
      <Pantalla>
        <EstadoVacio
          icono="candado"
          titulo="Solo para supervisores"
          detalle="Qué productos ve cada ruta al contar lo decide un supervisor. Si falta un producto en tu lista, avísale."
          accion={{ texto: 'Volver', onPress: volver }}
        />
      </Pantalla>
    );
  }

  return <Lista />;
}

function Pantalla({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={estilos.pantalla}>
      <BarraSuperior titulo={TITULO} marca={false}>
        <NotaEncabezado>Qué productos ve cada ruta al contar.</NotaEncabezado>
      </BarraSuperior>
      {children}
    </SafeAreaView>
  );
}

function Lista() {
  const consulta = usePlantillas(true);
  const crear = useCrearPlantilla();
  const [creando, setCreando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const { refetch } = consulta;

  // Al volver del detalle: lo que se cambió allá ya cambió la lista.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const vencida = consulta.error instanceof ErrorApi && consulta.error.estado === 401;
  useEffect(() => {
    if (vencida) sesionVencida();
  }, [vencida]);

  const refrescar = () => {
    setRefrescando(true);
    void refetch().finally(() => setRefrescando(false));
  };

  const abrirCreacion = () => {
    crear.reset();
    setCreando(true);
  };

  let contenido;
  if (consulta.isPending) {
    contenido = <EsqueletoLista />;
  } else if (consulta.isError && !consulta.data) {
    const sinRed = consulta.error instanceof ErrorRed;
    contenido = (
      <BloqueError
        titulo={sinRed ? 'Sin conexión' : 'No se pudieron cargar las plantillas'}
        detalle={
          sinRed
            ? 'Las plantillas se consultan en el servidor: revisa tu señal y vuelve a intentarlo.'
            : (consulta.error instanceof Error && consulta.error.message) || 'Intenta de nuevo en un momento.'
        }
        tono={sinRed ? 'atencion' : 'error'}
        onReintentar={() => void refetch()}
        reintentando={consulta.isFetching}
        secundaria={{ texto: 'Volver', onPress: volver }}
      />
    );
  } else {
    const { activas, inactivas } = consulta.data ?? { activas: [], inactivas: [] };
    contenido = (
      <>
        <Boton texto="Crear plantilla" onPress={abrirCreacion} />
        {activas.length === 0 ? (
          <EstadoVacio
            icono="caja"
            titulo="No hay plantillas activas"
            detalle="Sin plantilla, el vendedor ve todo el catálogo al contar. Crea una y agrégale los productos de sus rutas."
            enLinea
          />
        ) : (
          <Seccion texto="Activas" detalle={activas.length === 1 ? '1 plantilla' : `${activas.length} plantillas`}>
            {activas.map((p) => (
              <TarjetaPlantilla key={p.id} plantilla={p} />
            ))}
          </Seccion>
        )}
        {inactivas.length > 0 && (
          <Seccion texto="Desactivadas" detalle="Ninguna ruta las usa">
            {inactivas.map((p) => (
              <TarjetaPlantilla key={p.id} plantilla={p} />
            ))}
          </Seccion>
        )}
      </>
    );
  }

  return (
    <Pantalla>
      <ScrollView
        style={estilos.cuerpo}
        contentContainerStyle={estilos.contenido}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      >
        {contenido}
      </ScrollView>
      <ModalDatosPlantilla
        visible={creando}
        titulo="Nueva plantilla"
        textoGuardar="Crear"
        inicial={{ nombre: '', descripcion: null }}
        guardando={crear.isPending}
        error={crear.error}
        onCerrar={() => setCreando(false)}
        onGuardar={(datos) =>
          crear.mutate(datos, {
            onSuccess: (respuesta) => {
              setCreando(false);
              // Nace vacía: lo siguiente es agregarle productos, en su detalle.
              if (respuesta?.id) abrir(respuesta.id);
            },
          })
        }
      />
    </Pantalla>
  );
}

/** Nombre, cuántos productos y qué rutas la usan: lo que decide si es la que se busca. */
function TarjetaPlantilla({ plantilla }: { plantilla: Plantilla }) {
  const rutas = textoRutas(plantilla.rutas);
  return (
    <Tarjeta
      onPress={() => abrir(plantilla.id)}
      accessibilityLabel={[
        plantilla.nombre,
        plantilla.activa ? null : 'Desactivada',
        textoProductos(plantilla.totalProductos),
        rutas,
      ]
        .filter(Boolean)
        .join('. ')}
      accessibilityHint="Ver y editar sus productos y rutas"
    >
      <View style={estilos.lineaTitulo}>
        <Text style={estilos.nombre} numberOfLines={2}>
          {plantilla.nombre}
        </Text>
        <View style={estilos.cifra}>
          <Text style={estilos.numero}>{plantilla.totalProductos}</Text>
          <Text style={estilos.unidad}>{plantilla.totalProductos === 1 ? 'producto' : 'productos'}</Text>
        </View>
        <Chevron />
      </View>
      {plantilla.descripcion && (
        <Text style={estilos.descripcion} numberOfLines={2}>
          {plantilla.descripcion}
        </Text>
      )}
      <View>
        <Text style={estilos.rotulo}>Rutas</Text>
        <Text style={plantilla.rutas.length > 0 ? estilos.rutas : estilos.sinRutas}>{rutas}</Text>
      </View>
    </Tarjeta>
  );
}

function EsqueletoLista() {
  return (
    <Esqueleto etiqueta="Cargando plantillas" style={estilos.esqueleto}>
      {[0, 1].map((i) => (
        <TarjetaEsqueleto key={i} titulo="titulo" lineas={['30%', '60%']} cifra />
      ))}
    </Esqueleto>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  cuerpo: {
    flex: 1,
  },
  contenido: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.seccion,
    padding: RITMO.margen,
    paddingBottom: ESPACIADO.xxxl,
  },
  esqueleto: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    padding: RITMO.margen,
  },
  lineaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
  },
  nombre: {
    flex: 1,
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  cifra: {
    alignItems: 'flex-end',
  },
  numero: {
    ...TIPOGRAFIA.display,
    color: COLORES.texto,
    ...CIFRAS,
  },
  // La unidad de la cifra se lee de un vistazo, en mayúsculas; el rótulo de un dato, no.
  unidad: ROTULO,
  rotulo: ETIQUETA_DATO,
  descripcion: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },
  rutas: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    color: COLORES.texto,
  },
  sinRutas: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },
});

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ErrorApi } from '../../src/api/cliente';
import { useDetalleHistorial } from '../../src/api/hooks-historial';
import { cerrarSesion } from '../../src/api/sesion';
import { EstadoVacio } from '../../src/componentes/base';
import { CancelarCargaSupervisor } from '../../src/supervisor/CancelarCargaSupervisor';
import { accionCancelacion } from '../../src/supervisor/modelo-supervisor';
import { useEsSupervisor } from '../../src/supervisor/useEsSupervisor';
import { BarraSuperior, volver } from '../../src/historial/ComponentesHistorial';
import type { ProductoDetalle } from '../../src/historial/modelo-historial';
import {
  CargaIlegible,
  EncabezadoFamilia,
  ErrorCarga,
  EsqueletoCarga,
  estilosVistaCarga,
  ResumenCarga,
  seccionesDeCarga,
  TarjetaProducto,
  titulosCarga,
  type SeccionFamilia,
} from '../../src/historial/VistaCarga';
import { COLORES, ESPACIADO, RITMO } from '../../src/theme/tokens';

/**
 * Vista consolidada de una carga. Es la que el supervisor abre en el celular
 * antes de subirse al camión: por familia, como se acomoda físicamente, y
 * con la cantidad final en paquetes y piezas, que es como se cuenta a la vista.
 * Tenga o no discrepancias se muestra con el mismo detalle (auditoría pareja).
 * Al supervisor, al final, le ofrece cancelarla: una carga abierta por error
 * (o ya enviada) no pasa por su cola de autorización.
 */

function parametro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? '';
}

export default function PantallaDetalleHistorial() {
  const params = useLocalSearchParams<{ eventoId: string }>();
  const eventoId = parametro(params.eventoId);
  const consulta = useDetalleHistorial(eventoId);
  const esSupervisor = useEsSupervisor();
  const [refrescando, setRefrescando] = useState(false);

  const sesionVencida = consulta.error instanceof ErrorApi && consulta.error.estado === 401;
  useEffect(() => {
    if (sesionVencida) void cerrarSesion().then(() => router.replace('/login'));
  }, [sesionVencida]);

  const carga = consulta.data ?? null;
  const secciones = useMemo(() => seccionesDeCarga(carga), [carga]);

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
        <EsqueletoCarga />
      </Pantalla>
    );
  }

  if (consulta.isError && !carga) {
    return (
      <Pantalla titulo="Carga">
        <ErrorCarga error={consulta.error} onReintentar={() => void consulta.refetch()} />
      </Pantalla>
    );
  }

  if (!carga) {
    return (
      <Pantalla titulo="Carga">
        <CargaIlegible onReintentar={() => void consulta.refetch()} reintentando={consulta.isFetching} />
      </Pantalla>
    );
  }

  const refrescar = () => {
    setRefrescando(true);
    void consulta.refetch().finally(() => setRefrescando(false));
  };

  const cancelar =
    esSupervisor && accionCancelacion(carga.evento.estado) !== null ? (
      <View style={estilos.pie}>
        <CancelarCargaSupervisor
          carga={carga}
          onSesionVencida={() => void cerrarSesion().then(() => router.replace('/login'))}
        />
      </View>
    ) : null;

  return (
    <Pantalla {...titulosCarga(carga)}>
      {secciones.length === 0 ? (
        <>
          <View style={estilosVistaCarga.contenidoLista}>
            <ResumenCarga carga={carga} />
          </View>
          <EstadoVacio
            icono="caja"
            titulo="Sin productos contados"
            detalle="Aquí aparecerán los productos por familia en cuanto se capturen en el conteo."
            accion={{ texto: 'Actualizar', onPress: refrescar, cargando: refrescando, textoCargando: 'Actualizando…' }}
          />
          {cancelar && <View style={estilosVistaCarga.contenidoLista}>{cancelar}</View>}
        </>
      ) : (
        <SectionList<ProductoDetalle, SeccionFamilia>
          style={estilosVistaCarga.lista}
          contentContainerStyle={estilosVistaCarga.contenidoLista}
          sections={secciones}
          keyExtractor={(p) => p.code}
          stickySectionHeadersEnabled
          initialNumToRender={30}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
          ListHeaderComponent={<ResumenCarga carga={carga} />}
          ListFooterComponent={cancelar}
          renderSectionHeader={({ section }) => <EncabezadoFamilia familia={section.familia} />}
          renderItem={({ item }) => <TarjetaProducto producto={item} />}
        />
      )}
    </Pantalla>
  );
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

const estilos = StyleSheet.create({
  // Lectura pausada: tarjetas blancas sobre el fondo tintado, cada producto un bloque aparte.
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondoPantalla,
  },
  // Separada de los productos: es una decisión aparte, no parte de la lista.
  pie: {
    marginTop: RITMO.grupo,
    paddingBottom: ESPACIADO.xl,
  },
});

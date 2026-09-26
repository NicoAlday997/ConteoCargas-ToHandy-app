import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ErrorRed } from '../api/cliente';
import { useAsignarRuta, useRutasConPlantilla } from '../api/hooks-plantillas';
import { BloqueError, Boton, Encabezado, Esqueleto, Etiqueta, TarjetaEsqueleto, Tarjeta } from '../componentes/base';
import { textoProductos } from '../factores/modelo-factores';
import { ANCHO_MODAL, COLORES, ESPACIADO, ETIQUETA_DATO, FUENTE, RADIOS, RITMO, TIPOGRAFIA } from '../theme/tokens';
import { avisoDeError, estilosPlantillas } from './ComponentesPlantillas';
import { rutasRespectoA, type RutaAsignable } from './modelo-plantillas';

interface Props {
  visible: boolean;
  plantilla: { id: string; nombre: string; activa: boolean; totalProductos: number };
  onCerrar: () => void;
}

/**
 * Qué rutas usan la plantilla y a cuáles asignársela. Asignar mueve la ruta
 * desde su plantilla anterior; no hay "quitar" suelto porque dejaría al
 * vendedor viendo los ~100 productos del catálogo: se le asigna otra.
 */
export function ModalRutas({ visible, plantilla, onCerrar }: Props) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCerrar}>
      <View style={estilos.fondo}>
        <ScrollView contentContainerStyle={estilos.centrado} bounces={false}>
          {visible && <Contenido plantilla={plantilla} onCerrar={onCerrar} />}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Contenido({ plantilla, onCerrar }: Omit<Props, 'visible'>) {
  const consulta = useRutasConPlantilla(true);
  const asignar = useAsignarRuta(plantilla.id);
  const [confirmando, setConfirmando] = useState<RutaAsignable | null>(null);
  const rutas = rutasRespectoA(consulta.data, plantilla.id);

  const cerrar = () => {
    if (!asignar.isPending) onCerrar();
  };

  if (confirmando) {
    const error = asignar.isError ? avisoDeError(asignar.error, 'No se pudo asignar') : null;
    return (
      <View style={estilos.modal}>
        <Encabezado titulo={`¿Asignar “${plantilla.nombre}” a ${confirmando.nombre}?`} variante="plano" lineasTitulo={3} />
        <Tarjeta elevacion={0} compacta>
          <Text style={estilos.rotulo}>Hoy</Text>
          <Text style={estilos.detalle}>{confirmando.actual}</Text>
        </Tarjeta>
        <Text style={estilos.detalle}>
          {confirmando.vendedores.length === 1 ? `${confirmando.vendedores[0]} verá` : 'Sus vendedores verán'}{' '}
          <Text style={estilos.negrita}>{textoProductos(plantilla.totalProductos)}</Text> desde su próxima carga. Las cargas ya
          iniciadas no cambian.
        </Text>
        {error && <BloqueError titulo={error.titulo} detalle={error.detalle} tono={error.tono} />}
        <View style={estilosPlantillas.filaBotones}>
          <Boton
            texto="Atrás"
            variante="secundario"
            onPress={() => {
              asignar.reset();
              setConfirmando(null);
            }}
            deshabilitado={asignar.isPending}
            style={estilosPlantillas.botonFila}
          />
          <Boton
            texto={asignar.isError ? 'Reintentar' : 'Asignar'}
            onPress={() => asignar.mutate(confirmando.id, { onSuccess: () => setConfirmando(null) })}
            cargando={asignar.isPending}
            textoCargando="Asignando…"
            style={estilosPlantillas.botonFila}
          />
        </View>
      </View>
    );
  }

  let cuerpo;
  if (consulta.isPending) {
    cuerpo = (
      <Esqueleto etiqueta="Cargando rutas" style={estilos.lista}>
        {[0, 1, 2].map((i) => (
          <TarjetaEsqueleto key={i} compacta lineas={['50%', '70%']} />
        ))}
      </Esqueleto>
    );
  } else if (consulta.isError && !consulta.data) {
    const sinRed = consulta.error instanceof ErrorRed;
    cuerpo = (
      <BloqueError
        titulo={sinRed ? 'Sin conexión' : 'No se pudieron cargar las rutas'}
        detalle={
          sinRed
            ? 'Las rutas se consultan en el servidor: revisa tu señal y vuelve a intentarlo.'
            : (consulta.error instanceof Error && consulta.error.message) || 'Intenta de nuevo en un momento.'
        }
        tono={sinRed ? 'atencion' : 'error'}
        onReintentar={() => void consulta.refetch()}
        reintentando={consulta.isFetching}
      />
    );
  } else if (rutas.length === 0) {
    cuerpo = <Text style={estilos.detalle}>No hay rutas activas.</Text>;
  } else {
    cuerpo = (
      <View style={estilos.lista}>
        {rutas.map((r) => (
          <FilaRuta
            key={r.id}
            ruta={r}
            puedeAsignar={plantilla.activa}
            onAsignar={() => {
              asignar.reset();
              setConfirmando(r);
            }}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={estilos.modal}>
      <Encabezado titulo="Rutas" subtitulo={plantilla.nombre} variante="plano" />
      <Text style={estilos.detalle}>
        Al asignarla, la ruta deja la plantilla que tenía. Para quitársela a una ruta, asígnale otra desde esa plantilla.
      </Text>
      {!plantilla.activa && (
        <BloqueError
          tono="atencion"
          titulo="La plantilla está desactivada"
          detalle="Actívala antes de asignarla a una ruta."
        />
      )}
      {cuerpo}
      <Boton texto="Cerrar" variante="secundario" onPress={cerrar} />
    </View>
  );
}

function FilaRuta({ ruta, puedeAsignar, onAsignar }: { ruta: RutaAsignable; puedeAsignar: boolean; onAsignar: () => void }) {
  return (
    <Tarjeta
      elevacion={0}
      compacta
      accessible={!ruta.asignable || ruta.usaEsta || !puedeAsignar}
      accessibilityLabel={[ruta.nombre, ruta.vendedores.join(', '), ruta.usaEsta ? 'Usa esta plantilla' : ruta.actual].filter(Boolean).join('. ')}
    >
      <View style={estilos.filaRuta}>
        <View style={estilos.datosRuta}>
          <Text style={estilos.nombreRuta}>{ruta.nombre}</Text>
          {ruta.vendedores.length > 0 && <Text style={estilos.rotulo}>{ruta.vendedores.join(', ')}</Text>}
          {!ruta.usaEsta && <Text style={estilos.detalle}>{ruta.actual}</Text>}
        </View>
        {ruta.usaEsta ? (
          <Etiqueta texto="Usa esta" tono="capturado" />
        ) : ruta.asignable && puedeAsignar ? (
          <Boton
            texto="Asignar"
            variante="secundario"
            onPress={onAsignar}
            accessibilityLabel={`Asignar a ${ruta.nombre}. ${ruta.actual}`}
          />
        ) : null}
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: COLORES.velo,
  },
  centrado: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: RITMO.margen,
  },
  modal: {
    width: '100%',
    maxWidth: ANCHO_MODAL,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    padding: ESPACIADO.xl,
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.grande,
  },
  lista: {
    gap: RITMO.relacionado,
  },
  filaRuta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
  },
  datosRuta: {
    flex: 1,
    gap: RITMO.interno,
  },
  nombreRuta: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.negrita,
    color: COLORES.texto,
  },
  rotulo: ETIQUETA_DATO,
  detalle: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  negrita: {
    fontFamily: FUENTE.negrita,
  },
});

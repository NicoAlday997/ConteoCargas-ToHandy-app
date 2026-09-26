import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { CODIGO_COLOR_INVALIDO } from '../../src/api/familias';
import { useAsignarColorFamilia, useFamilias, type FamiliaConColor } from '../../src/api/hooks-familias';
import { BloqueError, Esqueleto, EstadoVacio, NotaEncabezado, TarjetaEsqueleto } from '../../src/componentes/base';
import { formatearNombreFamilia } from '../../src/conteo/formato-nombre';
import { textoProductos } from '../../src/factores/modelo-factores';
import { ANCHO_MAXIMO_LISTA, BarraSuperior, volver } from '../../src/historial/ComponentesHistorial';
import { sesionVencida } from '../../src/plantillas/ComponentesPlantillas';
import { useEsSupervisor } from '../../src/supervisor/useEsSupervisor';
import {
  COLORES_FAMILIA,
  NOMBRES_COLOR_FAMILIA,
  TONOS_COLOR_FAMILIA,
  type ColorFamilia,
} from '../../src/theme/colores-familia';
import {
  ANCHO_MODAL,
  BORDES,
  COLORES,
  ESPACIADO,
  RADIOS,
  RITMO,
  TIPOGRAFIA,
  TOQUE_MINIMO,
} from '../../src/theme/tokens';

/**
 * Colores de familias (solo Supervisor): a cada familia del catálogo se le da
 * un color de la paleta cerrada para ubicarla más rápido entre 60 productos
 * al contar. Por omisión ninguna tiene color y todo se ve neutro.
 *
 * En el conteo el color va SOLO en el punto y la pastilla del encabezado de
 * familia: identifica. El estado de cada fila lo comunica otro sistema de
 * color y nunca se pisan (docs/06 §1).
 */

const TITULO = 'Colores de familias';
/** Círculo del color en cada renglón. */
const MUESTRA = 28;
/** Círculo de la hoja de colores: visible grande, con el toque mínimo alrededor. */
const CIRCULO = 44;
const ANILLO = 3;

export default function PantallaFamilias() {
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
          detalle="Los colores de las familias los asigna un supervisor."
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
        <NotaEncabezado>Se ven en el conteo, junto al nombre de cada familia.</NotaEncabezado>
      </BarraSuperior>
      {children}
    </SafeAreaView>
  );
}

function EsqueletoLista() {
  return (
    <Esqueleto etiqueta="Cargando familias" style={estilos.contenido}>
      <TarjetaEsqueleto lineas={['60%', '45%', '70%', '50%']} />
    </Esqueleto>
  );
}

function Lista() {
  const consulta = useFamilias(true);
  const asignar = useAsignarColorFamilia();
  const [abierta, setAbierta] = useState<FamiliaConColor | null>(null);
  const [errorAsignar, setErrorAsignar] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const vencida = [consulta.error, asignar.error].some((e) => e instanceof ErrorApi && e.estado === 401);
  useEffect(() => {
    if (vencida) sesionVencida();
  }, [vencida]);

  const elegir = (familia: FamiliaConColor, color: ColorFamilia | null) => {
    setAbierta(null);
    setErrorAsignar(null);
    if (familia.color === color) return;
    asignar.mutate(
      { familia: familia.familia, color },
      {
        onError: (e) => {
          const nombre = formatearNombreFamilia(familia.familia);
          if (e instanceof ErrorRed) setErrorAsignar(`Sin conexión: no se guardó el color de ${nombre}.`);
          else if (e instanceof ErrorApi && e.estado === 404) setErrorAsignar(`${nombre} ya no está en el catálogo.`);
          else if (e instanceof ErrorApi && e.cuerpo?.codigo === CODIGO_COLOR_INVALIDO)
            setErrorAsignar('Ese color no está en la paleta.');
          else setErrorAsignar(e.message || `No se guardó el color de ${nombre}.`);
        },
      },
    );
  };

  if (consulta.isPending) {
    return (
      <Pantalla>
        <EsqueletoLista />
      </Pantalla>
    );
  }

  if (consulta.isError && !consulta.data) {
    const sinRed = consulta.error instanceof ErrorRed;
    return (
      <Pantalla>
        <View style={estilos.contenido}>
          <BloqueError
            titulo={sinRed ? 'Sin conexión' : 'No se pudieron cargar las familias'}
            detalle={
              sinRed
                ? 'Las familias se consultan en el servidor: revisa tu señal.'
                : (consulta.error instanceof Error && consulta.error.message) || null
            }
            tono={sinRed ? 'atencion' : 'error'}
            onReintentar={() => void consulta.refetch()}
            reintentando={consulta.isFetching}
            secundaria={{ texto: 'Volver', onPress: volver }}
          />
        </View>
      </Pantalla>
    );
  }

  const familias = consulta.data ?? [];

  return (
    <Pantalla>
      <ScrollView
        contentContainerStyle={estilos.contenido}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true);
              void consulta.refetch().finally(() => setRefrescando(false));
            }}
          />
        }
      >
        {errorAsignar && <BloqueError titulo="No se guardó el color" detalle={errorAsignar} />}
        {familias.length === 0 ? (
          <EstadoVacio
            icono="caja"
            titulo="No hay familias en el catálogo"
            detalle="Las familias vienen de Handy con cada producto. Cuando el catálogo las tenga, aparecerán aquí."
            enLinea
          />
        ) : (
          <View style={estilos.tarjeta}>
            {familias.map((f) => (
              <RenglonFamilia key={f.familia} familia={f} onPress={() => setAbierta(f)} />
            ))}
          </View>
        )}
      </ScrollView>
      <HojaColores familia={abierta} onElegir={elegir} onCerrar={() => setAbierta(null)} />
    </Pantalla>
  );
}

function RenglonFamilia({ familia, onPress }: { familia: FamiliaConColor; onPress: () => void }) {
  const nombre = formatearNombreFamilia(familia.familia);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nombre}, ${textoProductos(familia.productos)}. ${
        familia.color ? `Color ${NOMBRES_COLOR_FAMILIA[familia.color]}` : 'Sin color'
      }`}
      accessibilityHint="Elegir el color de la familia"
      style={({ pressed }) => [estilos.renglon, pressed && estilos.renglonPresionado]}
    >
      <View style={estilos.textosRenglon}>
        <Text style={estilos.nombre} numberOfLines={1}>
          {nombre}
        </Text>
        <Text style={estilos.detalle}>{textoProductos(familia.productos)}</Text>
      </View>
      <Muestra color={familia.color} lado={MUESTRA} />
    </Pressable>
  );
}

/** El círculo del color; sin color, un círculo de contorno punteado. */
function Muestra({ color, lado }: { color: ColorFamilia | null; lado: number }) {
  const forma = { width: lado, height: lado, borderRadius: lado / 2 };
  if (color === null) return <View style={[forma, estilos.sinColor]} />;
  return <View style={[forma, { backgroundColor: TONOS_COLOR_FAMILIA[color].solido }]} />;
}

/**
 * Hoja inferior con los 10 colores y "Sin color". El seleccionado lleva un
 * anillo. Un toque asigna y cierra.
 */
function HojaColores({
  familia,
  onElegir,
  onCerrar,
}: {
  familia: FamiliaConColor | null;
  onElegir: (familia: FamiliaConColor, color: ColorFamilia | null) => void;
  onCerrar: () => void;
}) {
  const margenes = useSafeAreaInsets();
  // Se conserva la última mientras la hoja se cierra, para que no quede vacía al deslizar.
  const [mostrada, setMostrada] = useState<FamiliaConColor | null>(familia);
  if (familia && familia !== mostrada) setMostrada(familia);

  return (
    <Modal visible={familia !== null} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={estilos.velo} onPress={onCerrar} accessibilityLabel="Cerrar sin cambiar" />
      {mostrada && (
        <View style={[estilos.hoja, { paddingBottom: ESPACIADO.xl + margenes.bottom }]}>
          <View style={estilos.asa} />
          <Text style={estilos.tituloHoja} accessibilityRole="header">
            {formatearNombreFamilia(mostrada.familia)}
          </Text>
          <View style={estilos.rejilla}>
            {COLORES_FAMILIA.map((color) => (
              <OpcionColor
                key={color}
                color={color}
                seleccionado={mostrada.color === color}
                onPress={() => onElegir(mostrada, color)}
              />
            ))}
          </View>
          <Pressable
            onPress={() => onElegir(mostrada, null)}
            accessibilityRole="button"
            accessibilityState={{ selected: mostrada.color === null }}
            style={({ pressed }) => [estilos.opcionSinColor, pressed && estilos.renglonPresionado]}
          >
            <View style={[estilos.anillo, mostrada.color === null && estilos.anilloActivo]}>
              <Muestra color={null} lado={CIRCULO - ESPACIADO.sm} />
            </View>
            <Text style={estilos.textoSinColor}>Sin color</Text>
          </Pressable>
        </View>
      )}
    </Modal>
  );
}

function OpcionColor({ color, seleccionado, onPress }: { color: ColorFamilia; seleccionado: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={NOMBRES_COLOR_FAMILIA[color]}
      accessibilityState={{ selected: seleccionado }}
      style={({ pressed }) => [estilos.opcion, pressed && estilos.opcionPresionada]}
    >
      <View style={[estilos.anillo, seleccionado && { borderColor: TONOS_COLOR_FAMILIA[color].solido }]}>
        <Muestra color={color} lado={CIRCULO} />
      </View>
    </Pressable>
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
  tarjeta: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.grande,
    overflow: 'hidden',
    paddingVertical: ESPACIADO.xs,
  },
  renglon: {
    minHeight: TOQUE_MINIMO + ESPACIADO.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
    paddingHorizontal: RITMO.margen,
  },
  renglonPresionado: {
    backgroundColor: COLORES.superficieHonda,
  },
  textosRenglon: {
    flex: 1,
  },
  nombre: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  detalle: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoTerciario,
  },
  sinColor: {
    borderWidth: BORDES.medio,
    borderStyle: 'dashed',
    borderColor: COLORES.borde,
  },
  velo: {
    flex: 1,
    backgroundColor: COLORES.velo,
  },
  hoja: {
    width: '100%',
    maxWidth: ANCHO_MODAL,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    paddingHorizontal: RITMO.margen,
    paddingTop: ESPACIADO.md,
    backgroundColor: COLORES.superficie,
    borderTopLeftRadius: RADIOS.encabezado,
    borderTopRightRadius: RADIOS.encabezado,
  },
  asa: {
    alignSelf: 'center',
    width: ESPACIADO.xxl + ESPACIADO.sm,
    height: ESPACIADO.xs,
    borderRadius: RADIOS.completo,
    backgroundColor: COLORES.divisor,
  },
  tituloHoja: {
    ...TIPOGRAFIA.tituloBarra,
    color: COLORES.texto,
    textAlign: 'center',
  },
  // Cinco por renglón en teléfono: dos renglones de colores.
  rejilla: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: ESPACIADO.sm,
  },
  opcion: {
    width: TOQUE_MINIMO + ESPACIADO.xs,
    height: TOQUE_MINIMO + ESPACIADO.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
  },
  opcionPresionada: {
    backgroundColor: COLORES.superficieHonda,
  },
  // Espacio del anillo siempre reservado: seleccionar no mueve nada.
  anillo: {
    padding: ANILLO,
    borderWidth: ANILLO,
    borderColor: 'transparent',
    borderRadius: RADIOS.completo,
  },
  anilloActivo: {
    borderColor: COLORES.texto,
  },
  opcionSinColor: {
    minHeight: TOQUE_MINIMO,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: ESPACIADO.sm,
    paddingHorizontal: ESPACIADO.md,
    borderRadius: RADIOS.medio,
  },
  textoSinColor: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
});

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { ETIQUETAS_TIPO_CARGA } from '../../src/api/cargas';
import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useColaAutorizacion, usePorEnviar } from '../../src/api/hooks-supervisor';
import { cerrarSesion } from '../../src/api/sesion';
import {
  BloqueError,
  Datos,
  EstadoVacio,
  Esqueleto,
  Etiqueta,
  NotaEncabezado,
  Seccion,
  Tarjeta,
  TarjetaEsqueleto,
  type Dato,
} from '../../src/componentes/base';
import { diaNegocio, textoSalida } from '../../src/conteo/fecha-operativa';
import { ANCHO_MAXIMO_LISTA, bandaDeEstado, BarraSuperior, volver } from '../../src/historial/ComponentesHistorial';
import type { FilaHistorial } from '../../src/historial/modelo-historial';
import { tomarAviso, type AvisoCola } from '../../src/supervisor/aviso-cola';
import { ACENTO_ESPERA, bandaDeEspera, espera, useAhora } from '../../src/supervisor/ComponentesSupervisor';
import type { CargaEnEspera } from '../../src/supervisor/modelo-supervisor';
import { useEsSupervisor } from '../../src/supervisor/useEsSupervisor';
import { COLORES, ESPACIADO, PESOS, RITMO, TIPOGRAFIA } from '../../src/theme/tokens';

/**
 * Cargas que esperan el visto bueno del supervisor. Ninguna llega a Handy sin
 * él, y mientras espera el camión no sale: por eso van de la que más lleva
 * esperando a la más reciente, y la espera domina cada tarjeta.
 */

function abrir(eventoId: string) {
  router.push({ pathname: '/supervisor/[eventoId]', params: { eventoId } });
}

export default function PantallaColaSupervisor() {
  const esSupervisor = useEsSupervisor();

  if (esSupervisor === undefined) {
    return (
      <Pantalla>
        <EsqueletoCola />
      </Pantalla>
    );
  }

  if (!esSupervisor) {
    return (
      <Pantalla>
        <EstadoVacio
          icono="candado"
          titulo="Solo para supervisores"
          detalle="La autorización de cargas la da un supervisor. Si crees que deberías tener acceso, avisa al administrador."
          accion={{ texto: 'Volver', onPress: volver }}
        />
      </Pantalla>
    );
  }

  return <Cola />;
}

function Cola() {
  const cola = useColaAutorizacion(true);
  const porEnviar = usePorEnviar(true);
  const ahora = useAhora();
  const [aviso, setAviso] = useState<AvisoCola | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const { refetch: releerCola } = cola;
  const { refetch: releerPorEnviar } = porEnviar;

  // Al volver del detalle: lo que se hizo allá ya cambió la cola.
  useFocusEffect(
    useCallback(() => {
      const nuevo = tomarAviso();
      if (nuevo) setAviso(nuevo);
      void releerCola();
      void releerPorEnviar();
    }, [releerCola, releerPorEnviar]),
  );

  const vencida = [cola.error, porEnviar.error].some((e) => e instanceof ErrorApi && e.estado === 401);
  useEffect(() => {
    if (vencida) void cerrarSesion().then(() => router.replace('/login'));
  }, [vencida]);

  const refrescar = () => {
    setRefrescando(true);
    void Promise.all([releerCola(), releerPorEnviar()]).finally(() => setRefrescando(false));
  };

  const cargas = cola.data ?? [];
  const enviables = porEnviar.data ?? [];
  const hoy = diaNegocio(new Date(ahora));

  let contenido;
  if (cola.isPending) {
    contenido = <EsqueletoCola />;
  } else if (cola.isError && !cola.data) {
    const sinRed = cola.error instanceof ErrorRed;
    contenido = (
      <BloqueError
        titulo={sinRed ? 'Sin conexión' : 'No se pudo cargar la lista'}
        detalle={
          sinRed
            ? 'Las cargas por autorizar se consultan en el servidor: revisa tu señal y vuelve a intentarlo.'
            : (cola.error instanceof Error && cola.error.message) || 'Intenta de nuevo en un momento.'
        }
        tono={sinRed ? 'atencion' : 'error'}
        onReintentar={() => void releerCola()}
        reintentando={cola.isFetching}
        secundaria={{ texto: 'Volver', onPress: volver }}
      />
    );
  } else {
    contenido = (
      <>
        {aviso && <AvisoRegreso aviso={aviso} />}
        {cargas.length === 0 ? (
          <EstadoVacio
            icono="listo"
            tono="capturado"
            titulo="Nada por autorizar"
            detalle="Aquí aparece cada carga en cuanto vendedor y contador terminan y resuelven sus diferencias. La lista se actualiza sola."
            enLinea
          />
        ) : (
          <Seccion texto="Esperan tu autorización" detalle={cargas.length === 1 ? '1 carga' : `${cargas.length} cargas`}>
            {cargas.map((c) => (
              <TarjetaEnEspera key={c.id} carga={c} ahora={ahora} hoy={hoy} />
            ))}
          </Seccion>
        )}
        {enviables.length > 0 && (
          <Seccion texto="Autorizadas, sin enviar a Handy" detalle={enviables.length === 1 ? '1 carga' : `${enviables.length} cargas`}>
            {enviables.map((c) => (
              <TarjetaPorEnviar key={c.id} fila={c} hoy={hoy} />
            ))}
          </Seccion>
        )}
      </>
    );
  }

  return (
    <Pantalla>
      <ScrollView
        style={estilos.scroll}
        contentContainerStyle={estilos.contenido}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      >
        {contenido}
      </ScrollView>
    </Pantalla>
  );
}

function Pantalla({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={estilos.pantalla}>
      <BarraSuperior titulo="Autorizar cargas">
        <NotaEncabezado>Ninguna carga llega a Handy sin tu visto bueno</NotaEncabezado>
      </BarraSuperior>
      {children}
    </SafeAreaView>
  );
}

function EsqueletoCola() {
  return (
    <Esqueleto etiqueta="Cargando cargas por autorizar" style={estilos.esqueleto}>
      {[0, 1, 2].map((i) => (
        <TarjetaEsqueleto key={i} titulo="titulo" lineas={['50%', '70%']} />
      ))}
    </Esqueleto>
  );
}

/** Lo que pasó en el detalle: la carga ya no está en la lista y hay que decir por qué. */
function AvisoRegreso({ aviso }: { aviso: AvisoCola }) {
  const titulo = `${aviso.ruta} volvió a diferencias por resolver`;
  const detalle =
    aviso.tipo === 'modificada'
      ? `Propusiste ${aviso.cantidad} de ${aviso.producto}. No queda aplicada hasta que el vendedor o el contador la confirmen con su PIN. Cuando lo hagan, la carga regresará aquí para tu autorización.`
      : `${aviso.productos === 1 ? 'El producto que rechazaste vuelve' : `Los ${aviso.productos} productos que rechazaste vuelven`} a resolverse: alguien captura la cantidad y otra persona la confirma con su PIN. El resto de la carga no se tocó. Regresará aquí para tu autorización.`;
  return (
    <Tarjeta tintada="discrepancia" elevacion={0} compacta style={estilos.aviso} accessible accessibilityLabel={`${titulo}. ${detalle}`}>
      <Text style={estilos.tituloAviso} accessibilityRole="header">
        {titulo}
      </Text>
      <Text style={estilos.textoAviso}>{detalle}</Text>
    </Tarjeta>
  );
}

function textoDiscrepancias(n: number): string {
  return n === 0 ? 'Sin discrepancias' : n === 1 ? '1 con discrepancia' : `${n} con discrepancia`;
}

function datosCarga(fila: FilaHistorial): Dato[] {
  const datos: Dato[] = [
    { rotulo: 'Contó', valor: fila.vendedorNombre },
    { rotulo: 'Verificó', valor: fila.contadorNombre },
  ];
  if (fila.totalProductos !== null) datos.push({ rotulo: 'Productos', valor: String(fila.totalProductos), cifra: true });
  return datos;
}

/**
 * La espera arriba, en la banda, con el color de cuánto pesa; la ruta es el
 * punto focal; debajo, el día que sale, quién contó y verificó y cuántos
 * productos, y si hubo discrepancias (lo que pide mirar con más cuidado).
 */
function TarjetaEnEspera({ carga, ahora, hoy }: { carga: CargaEnEspera; ahora: number; hoy: string }) {
  const e = espera(carga.esperaDesde, ahora);
  const tipo = carga.tipo ? ETIQUETAS_TIPO_CARGA[carga.tipo] : 'Carga';
  const salida = carga.dia ? textoSalida(carga.dia, hoy) : null;

  return (
    <Tarjeta
      onPress={() => abrir(carga.id)}
      conAcento={bandaDeEspera(e, tipo)}
      acento={ACENTO_ESPERA[e.nivel]}
      accessibilityLabel={[`${carga.rutaNombre}, ${tipo}`, e.titulo, salida, textoDiscrepancias(carga.discrepancias), 'Revisar y autorizar']
        .filter(Boolean)
        .join('. ')}
    >
      <CuerpoCarga fila={carga} salida={salida} />
    </Tarjeta>
  );
}

function TarjetaPorEnviar({ fila, hoy }: { fila: FilaHistorial; hoy: string }) {
  const tipo = fila.tipo ? ETIQUETAS_TIPO_CARGA[fila.tipo] : 'Carga';
  const salida = fila.dia ? textoSalida(fila.dia, hoy) : null;
  const banda = bandaDeEstado(fila.estado, tipo);
  return (
    <Tarjeta
      onPress={() => abrir(fila.id)}
      conAcento={banda}
      accessibilityLabel={[`${fila.rutaNombre}, ${tipo}`, banda.titulo, salida, 'Abrir para enviar a Handy'].filter(Boolean).join('. ')}
    >
      <CuerpoCarga fila={fila} salida={salida} />
    </Tarjeta>
  );
}

function CuerpoCarga({ fila, salida }: { fila: FilaHistorial; salida: string | null }) {
  return (
    <>
      <View style={estilos.lineaRuta}>
        <View style={estilos.titulos}>
          <Text style={estilos.ruta} numberOfLines={2}>
            {fila.rutaNombre}
          </Text>
          {salida && <Text style={estilos.salida}>{salida}</Text>}
        </View>
        <Text style={estilos.flecha} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </View>
      <View style={estilos.grupoDatos}>
        <Datos datos={datosCarga(fila)} />
        <View style={estilos.filaEtiquetas}>
          <Etiqueta texto={textoDiscrepancias(fila.discrepancias)} tono={fila.discrepancias > 0 ? 'discrepancia' : 'capturado'} />
        </View>
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondoPantalla,
  },
  scroll: {
    flex: 1,
  },
  // Entre la cola y lo que falta enviar, aire de sección: son decisiones distintas.
  contenido: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.seccion,
    padding: RITMO.margen,
    paddingTop: ESPACIADO.xl,
    paddingBottom: ESPACIADO.xxxl,
  },
  esqueleto: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    padding: RITMO.margen,
    paddingTop: ESPACIADO.xl,
  },
  aviso: {
    gap: RITMO.interno,
  },
  tituloAviso: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.negrita,
    color: COLORES.discrepanciaTexto,
  },
  textoAviso: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  lineaRuta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
  },
  titulos: {
    flex: 1,
  },
  // El punto focal de la tarjeta: nada más en ella tiene este tamaño ni peso.
  ruta: {
    ...TIPOGRAFIA.titulo,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.texto,
  },
  salida: {
    ...TIPOGRAFIA.cuerpo,
    fontWeight: PESOS.semiNegrita,
    color: COLORES.textoSecundario,
  },
  // Aire de grupo sobre los datos: la ruta y quién la contó son dos bloques.
  grupoDatos: {
    gap: RITMO.relacionado,
    marginTop: RITMO.grupo - RITMO.relacionado,
  },
  filaEtiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: RITMO.interno,
  },
  // Solo dice "se abre": no compite con la ruta.
  flecha: {
    ...TIPOGRAFIA.titulo,
    fontWeight: PESOS.regular,
    color: COLORES.textoSecundario,
  },
});

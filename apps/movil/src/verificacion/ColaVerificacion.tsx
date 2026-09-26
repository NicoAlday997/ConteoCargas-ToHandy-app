import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { ETIQUETAS_TIPO_CARGA, type CargaPendienteApi, type TipoCarga } from '../api/cargas';
import { ErrorApi, ErrorRed } from '../api/cliente';
import { useAbrirSesion, useDesbloquearCarga, usePendientesVerificacion } from '../api/hooks-cargas';
import {
  BloqueError,
  Boton,
  Chevron,
  EstadoVacio,
  Esqueleto,
  Datos,
  Etiqueta,
  LineaEsqueleto,
  Seccion,
  TarjetaEsqueleto,
  TituloSeccion,
} from '../componentes/base';
import type { CargaAbierta } from '../conteo/almacen-conteo';
import { estaConectado } from '../conteo/cola-sincronizacion';
import { horaNegocio } from '../conteo/fecha-operativa';
import {
  ANCHO_MODAL,
  COLORES,
  ESPACIADO,
  ETIQUETA_DATO,
  OPACIDAD,
  FUENTE,
  RADIOS,
  RITMO,
  TIPOGRAFIA,
  TOQUE_MINIMO,
  type ColorTono,
} from '../theme/tokens';

const MENSAJE_SIN_RED =
  'Para empezar a verificar necesitas señal: el servidor abre tu conteo y te manda la lista de productos. Ya abierto, puedes contar sin señal.';

/** Fila ya validada: sin id no hay carga que abrir. */
interface CargaEnCola {
  id: string;
  rutaNombre: string;
  vendedorNombre: string | null;
  tipo: TipoCarga | null;
  fechaConteo: Date | null;
  totalProductos: number | null;
  estado: 'lista' | 'propia' | 'bloqueada' | 'otro';
  miSesionId: string | null;
  verificandoPor: string | null;
}

function normalizar(fila: CargaPendienteApi): CargaEnCola | null {
  if (!fila.id) return null;
  const fecha = fila.fechaConteo ? new Date(fila.fechaConteo) : null;
  let estado: CargaEnCola['estado'] = 'lista';
  if (fila.estadoVerificacion === 'BLOQUEADA_CORTE_PENDIENTE' || fila.bloqueadaPorCorte) estado = 'bloqueada';
  else if (fila.estadoVerificacion === 'EN_CURSO_PROPIA' && fila.miSesionId) estado = 'propia';
  else if (fila.estadoVerificacion === 'EN_CURSO_OTRO') estado = 'otro';
  return {
    id: fila.id,
    rutaNombre: fila.rutaNombre?.trim() || 'Ruta sin nombre',
    vendedorNombre: fila.vendedorNombre?.trim() || null,
    tipo: fila.tipo,
    fechaConteo: fecha && !Number.isNaN(fecha.getTime()) ? fecha : null,
    totalProductos: typeof fila.totalProductos === 'number' ? fila.totalProductos : null,
    estado,
    miSesionId: fila.miSesionId,
    verificandoPor: fila.verificandoPor?.trim() || null,
  };
}

interface Props {
  /** La sesión ya está abierta en el servidor: guardarla y llevar al conteo. */
  onAbrir: (carga: CargaAbierta) => void;
  /** Sesión vencida: volver al login. */
  onSesionVencida: () => void;
}

/**
 * Cola del contador (docs/06 §3.3), agrupada por color de estado: verde las que
 * se pueden verificar, ámbar las bloqueadas por corte pendiente, gris las que
 * ya verifica otra persona. El contador cuenta en la MISMA pantalla que el
 * vendedor y a ciegas: aquí nunca se ven cantidades, solo cuántos productos.
 */
export function ColaVerificacion({ onAbrir, onSesionVencida }: Props) {
  const consulta = usePendientesVerificacion(true);
  const abrir = useAbrirSesion();
  const [bloqueada, setBloqueada] = useState<CargaEnCola | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [error, setError] = useState<{ mensaje: string; sinRed: boolean } | null>(null);

  const sesionVencida = consulta.error instanceof ErrorApi && consulta.error.estado === 401;
  useEffect(() => {
    if (sesionVencida) onSesionVencida();
  }, [sesionVencida, onSesionVencida]);

  const cargas = (consulta.data ?? []).map(normalizar).filter((c): c is CargaEnCola => c !== null);
  const listas = cargas.filter((c) => c.estado === 'lista' || c.estado === 'propia');
  const bloqueadas = cargas.filter((c) => c.estado === 'bloqueada');
  const deOtros = cargas.filter((c) => c.estado === 'otro');

  const verificar = async (carga: CargaEnCola) => {
    setError(null);
    if (carga.estado === 'bloqueada') {
      setBloqueada(carga);
      return;
    }
    // Ya la había empezado (quizá en otro dispositivo): se continúa, no se abre otra.
    if (carga.estado === 'propia' && carga.miSesionId) {
      onAbrir({ eventoId: carga.id, sesionId: carga.miSesionId, tipo: carga.tipo });
      return;
    }
    if (!estaConectado(await NetInfo.fetch())) {
      setError({ mensaje: MENSAJE_SIN_RED, sinRed: true });
      return;
    }
    setAbriendo(carga.id);
    try {
      const sesion = await abrir.mutateAsync(carga.id);
      if (!sesion?.id) throw new Error('El servidor no devolvió la sesión de conteo.');
      setBloqueada(null);
      onAbrir({ eventoId: carga.id, sesionId: sesion.id, tipo: carga.tipo });
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 401) return onSesionVencida();
      if (e instanceof ErrorRed) return setError({ mensaje: MENSAJE_SIN_RED, sinRed: true });
      if (e instanceof ErrorApi && e.estado === 409) {
        // El servidor revisa el corte al abrir: puede haberse bloqueado recién.
        const actualizada = (await consulta.refetch()).data?.map(normalizar).find((c) => c?.id === carga.id);
        if (actualizada?.estado === 'bloqueada') {
          setBloqueada(actualizada);
          return;
        }
      }
      // El aviso vive en la lista: el panel se cierra para que se lea.
      setBloqueada(null);
      setError({ mensaje: e instanceof Error && e.message ? e.message : 'Intenta de nuevo en un momento.', sinRed: false });
    } finally {
      setAbriendo(null);
    }
  };

  if (consulta.isPending) {
    return (
      <Esqueleto etiqueta="Cargando cargas por verificar" style={estilos.contenedor}>
        <LineaEsqueleto nivel="subtitulo" ancho="50%" />
        <TarjetaEsqueleto compacta titulo="titulo" />
        <TarjetaEsqueleto compacta titulo="titulo" />
      </Esqueleto>
    );
  }

  if (consulta.isError && !consulta.data) {
    const sinRed = consulta.error instanceof ErrorRed;
    return (
      <Seccion texto="Cargas por verificar">
        <BloqueError
          titulo={sinRed ? 'Sin conexión' : 'No se pudo consultar la cola'}
          detalle={
            sinRed
              ? 'La lista de cargas por verificar vive en el servidor: revisa tu señal.'
              : consulta.error.message || 'Intenta de nuevo en un momento.'
          }
          tono={sinRed ? 'atencion' : 'error'}
          onReintentar={() => void consulta.refetch()}
          reintentando={consulta.isFetching}
        />
      </Seccion>
    );
  }

  return (
    <View style={estilos.contenedor}>
      <TituloSeccion
        texto="Cargas por verificar"
        accion={{
          texto: consulta.isFetching ? 'Actualizando…' : 'Actualizar',
          onPress: () => void consulta.refetch(),
          accessibilityLabel: 'Actualizar la lista de cargas por verificar',
        }}
      />

      {cargas.length === 0 && (
        <EstadoVacio
          enLinea
          icono="listo"
          tono="capturado"
          titulo="No hay cargas esperando"
          detalle="Cuando un vendedor termine su conteo, su carga aparecerá aquí para que la verifiques."
        />
      )}

      {error && (
        <BloqueError
          titulo={error.sinRed ? 'Sin conexión' : 'No se pudo abrir la verificación'}
          detalle={error.mensaje}
          tono={error.sinRed ? 'atencion' : 'error'}
        />
      )}

      <Grupo titulo="Listas para verificar" cargas={listas} abriendo={abriendo} onPress={(c) => void verificar(c)} />
      <Grupo titulo="Bloqueadas por corte pendiente" cargas={bloqueadas} abriendo={abriendo} onPress={(c) => void verificar(c)} />
      <Grupo titulo="Las verifica otra persona" cargas={deOtros} abriendo={abriendo} />

      <PanelBloqueada
        carga={bloqueada}
        abriendo={abriendo !== null}
        onVerificar={(c) => void verificar({ ...c, estado: 'lista' })}
        onCerrar={() => setBloqueada(null)}
      />
    </View>
  );
}

function Grupo({
  titulo,
  cargas,
  abriendo,
  onPress,
}: {
  titulo: string;
  cargas: CargaEnCola[];
  abriendo: string | null;
  onPress?: (carga: CargaEnCola) => void;
}) {
  if (cargas.length === 0) return null;
  return (
    <Seccion texto={titulo} detalle={String(cargas.length)} nivel="grupo">
      {cargas.map((c) => (
        <FilaCarga key={c.id} carga={c} abriendo={abriendo === c.id} deshabilitada={abriendo !== null} onPress={onPress} />
      ))}
    </Seccion>
  );
}

function FilaCarga({
  carga,
  abriendo,
  deshabilitada,
  onPress,
}: {
  carga: CargaEnCola;
  abriendo: boolean;
  deshabilitada: boolean;
  onPress?: (carga: CargaEnCola) => void;
}) {
  const tipo = carga.tipo ? ETIQUETAS_TIPO_CARGA[carga.tipo] : 'Carga';
  const hora = carga.fechaConteo ? horaNegocio(carga.fechaConteo) : null;
  const detalle = [
    carga.totalProductos !== null ? `${carga.totalProductos} ${carga.totalProductos === 1 ? 'producto' : 'productos'}` : null,
    hora ? `terminó a las ${hora}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  let accion: string | null = null;
  let estado: { texto: string; tono: ColorTono } | null = null;
  switch (carga.estado) {
    case 'lista':
      accion = abriendo ? 'Abriendo…' : 'Verificar';
      break;
    case 'propia':
      accion = 'Continuar';
      estado = { texto: 'Ya empezaste a verificarla', tono: 'marca' };
      break;
    case 'bloqueada':
      accion = 'Ver';
      estado = { texto: 'Corte de venta pendiente en Handy', tono: 'discrepancia' };
      break;
    case 'otro':
      estado = {
        texto: carga.verificandoPor ? `La verifica ${carga.verificandoPor}` : 'La verifica otra persona',
        tono: 'pendiente',
      };
      break;
  }

  // Un solo punto focal: la ruta. El tipo es su rótulo; abajo, separados por
  // aire, quién contó y cuánto, como rótulo y dato; el estado, como bloque.
  const contenido = (presionada: boolean) => (
    <>
      <View style={estilos.cuerpoFila}>
        <View>
          <Text style={[estilos.tipo, presionada && estilos.textoInvertido]}>{tipo}</Text>
          <Text style={[estilos.ruta, presionada && estilos.textoInvertido]} numberOfLines={1}>
            {carga.rutaNombre}
          </Text>
        </View>
        <Datos
          invertido={presionada}
          datos={[
            { rotulo: 'Contó', valor: carga.vendedorNombre, ausente: 'Sin nombre' },
            ...(carga.totalProductos !== null
              ? [{ rotulo: 'Productos', valor: String(carga.totalProductos), cifra: true }]
              : []),
            ...(hora ? [{ rotulo: 'Terminó', valor: hora, cifra: true }] : []),
          ]}
        />
        {estado && (
          <View style={estilos.filaEstado}>
            <Etiqueta texto={estado.texto} tono={estado.tono} />
          </View>
        )}
      </View>
      {accion && (
        <View style={estilos.accion}>
          <Text style={[estilos.textoAccion, presionada && estilos.textoInvertido]}>{accion}</Text>
          <Chevron color={presionada ? COLORES.textoSobreColor : undefined} />
        </View>
      )}
    </>
  );

  if (!onPress) {
    return (
      <View style={[estilos.fila, estilos.filaInactiva]} accessible accessibilityLabel={`${carga.rutaNombre}, ${tipo}. ${estado?.texto ?? ''}`}>
        {contenido(false)}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(carga)}
      disabled={deshabilitada}
      accessibilityRole="button"
      accessibilityLabel={`${carga.rutaNombre}, ${tipo}. ${carga.vendedorNombre ? `Contó ${carga.vendedorNombre}. ` : ''}${detalle}. ${estado?.texto ?? ''}`}
      accessibilityState={{ disabled: deshabilitada, busy: abriendo }}
      style={({ pressed }) => [estilos.fila, pressed && estilos.filaPresionada, deshabilitada && !abriendo && estilos.deshabilitado]}
    >
      {({ pressed }) => contenido(pressed)}
    </Pressable>
  );
}

type ResultadoReintento = { tipo: 'sigue'; mensaje: string } | { tipo: 'libre' } | { tipo: 'error'; mensaje: string };

/**
 * Explica por qué no se puede verificar y ofrece reintentar: el servidor vuelve
 * a preguntar a Handy si el vendedor ya cerró su corte.
 */
function PanelBloqueada({
  carga,
  abriendo,
  onVerificar,
  onCerrar,
}: {
  carga: CargaEnCola | null;
  abriendo: boolean;
  onVerificar: (carga: CargaEnCola) => void;
  onCerrar: () => void;
}) {
  const desbloquear = useDesbloquearCarga();
  const [resultado, setResultado] = useState<ResultadoReintento | null>(null);

  const cerrar = () => {
    if (desbloquear.isPending) return;
    setResultado(null);
    onCerrar();
  };

  const reintentar = () => {
    if (!carga) return;
    setResultado(null);
    desbloquear.mutate(carga.id, {
      onSuccess: (r) => {
        if (r?.sigueBloqueado === false) setResultado({ tipo: 'libre' });
        else
          setResultado({
            tipo: 'sigue',
            mensaje: r?.mensaje || 'El vendedor todavía no cierra su corte de venta pendiente en Handy.',
          });
      },
      onError: (e) =>
        setResultado({
          tipo: 'error',
          mensaje: e instanceof ErrorRed ? 'Sin conexión con el servidor. Revisa tu señal y reintenta.' : e.message || 'Intenta de nuevo en un momento.',
        }),
    });
  };

  const vendedor = carga?.vendedorNombre ?? 'El vendedor';
  const libre = resultado?.tipo === 'libre';

  return (
    <Modal visible={carga !== null} transparent animationType="none" onRequestClose={cerrar}>
      <View style={estilos.fondoModal}>
        <View style={estilos.modal}>
          <Text style={[estilos.tituloModal, libre && estilos.tituloLibre]} accessibilityRole="header">
            {libre ? 'Ya se puede verificar' : 'No se puede verificar todavía'}
          </Text>
          {carga && (
            <Text style={estilos.subtituloModal}>
              {carga.rutaNombre} · {carga.tipo ? ETIQUETAS_TIPO_CARGA[carga.tipo] : 'Carga'}
            </Text>
          )}
          {libre ? (
            <Text style={estilos.textoModal}>{vendedor} ya cerró su corte de venta. Puedes empezar tu conteo.</Text>
          ) : (
            <>
              <Text style={estilos.textoModal}>
                {vendedor} tiene un corte de venta pendiente en Handy: una ruta anterior que no ha cerrado. Hasta que lo cierre,
                esta carga no se puede verificar.
              </Text>
              <Text style={estilos.textoModal}>Cuando te avise que ya lo cerró, toca Reintentar.</Text>
            </>
          )}
          <View style={estilos.zonaResultado} accessibilityLiveRegion="polite">
            {desbloquear.isPending && <Text style={estilos.textoModal}>Consultando a Handy…</Text>}
            {resultado?.tipo === 'sigue' && (
              <BloqueError titulo="Sigue pendiente" detalle={resultado.mensaje} tono="atencion" />
            )}
            {resultado?.tipo === 'error' && (
              <BloqueError titulo="No se pudo consultar a Handy" detalle={resultado.mensaje} />
            )}
          </View>
          <View style={estilos.botonesModal}>
            <Boton
              texto="Cerrar"
              variante="secundario"
              onPress={cerrar}
              deshabilitado={desbloquear.isPending || abriendo}
              style={estilos.botonModal}
            />
            {libre && carga ? (
              <Boton
                texto="Verificar ahora"
                cargando={abriendo}
                textoCargando="Abriendo…"
                onPress={() => {
                  setResultado(null);
                  onVerificar(carga);
                }}
                style={estilos.botonModal}
              />
            ) : (
              <Boton
                texto="Reintentar"
                cargando={desbloquear.isPending}
                textoCargando="Consultando…"
                onPress={reintentar}
                style={estilos.botonModal}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  // Del título a los grupos, más aire que dentro de cada grupo.
  contenedor: {
    width: '100%',
    gap: RITMO.grupo,
  },
  fila: {
    minHeight: TOQUE_MINIMO + ESPACIADO.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.margen,
    paddingHorizontal: RITMO.margen,
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.grande,
    overflow: 'hidden',
  },
  filaInactiva: {
    backgroundColor: COLORES.pendienteFondo,
  },
  // Inversión completa: el toque se nota aun con poca luz.
  filaPresionada: {
    backgroundColor: COLORES.marca,
  },
  // Entre la ruta y sus datos, aire de grupo: se leen como dos bloques.
  cuerpoFila: {
    flex: 1,
    gap: RITMO.relacionado,
    paddingVertical: RITMO.margen,
  },
  tipo: ETIQUETA_DATO,
  ruta: {
    ...TIPOGRAFIA.titulo,
    fontFamily: FUENTE.negrita,
    color: COLORES.texto,
  },
  filaEstado: {
    flexDirection: 'row',
  },
  accion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.interno,
  },
  textoAccion: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  deshabilitado: {
    opacity: OPACIDAD.deshabilitado,
  },
  fondoModal: {
    flex: 1,
    justifyContent: 'center',
    padding: RITMO.margen,
    backgroundColor: COLORES.velo,
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
  tituloModal: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  tituloLibre: {
    color: COLORES.capturadoTexto,
  },
  subtituloModal: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },
  textoModal: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  // Altura reservada: el resultado no mueve los botones bajo el dedo.
  zonaResultado: {
    minHeight: ESPACIADO.xxxl,
    justifyContent: 'center',
  },
  botonesModal: {
    flexDirection: 'row',
    gap: RITMO.relacionado,
  },
  botonModal: {
    flex: 1,
  },
});

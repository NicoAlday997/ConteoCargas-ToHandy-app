import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { ETIQUETAS_TIPO_CARGA, type CargaPendienteApi, type TipoCarga } from '../api/cargas';
import { ErrorApi, ErrorRed } from '../api/cliente';
import { useAbrirSesion, useDesbloquearCarga, usePendientesVerificacion } from '../api/hooks-cargas';
import type { CargaAbierta } from '../conteo/almacen-conteo';
import { estaConectado } from '../conteo/cola-sincronizacion';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';

const ANCHO_BARRA_ESTADO = 6;

const MENSAJE_SIN_RED =
  'Sin conexión. Para empezar a verificar necesitas señal: el servidor abre tu conteo y te manda la lista de productos. Ya abierto, puedes contar sin señal.';

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

/** Hora local HH:MM sin depender de Intl (Hermes no siempre lo trae completo). */
function formatearHora(fecha: Date): string {
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`;
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
  const [error, setError] = useState<string | null>(null);

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
      setError(MENSAJE_SIN_RED);
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
      if (e instanceof ErrorRed) return setError(MENSAJE_SIN_RED);
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
      setError(e instanceof Error && e.message ? e.message : 'No se pudo abrir la verificación.');
    } finally {
      setAbriendo(null);
    }
  };

  if (consulta.isPending) {
    return <ActivityIndicator style={estilos.cargando} color={COLORES.texto} accessibilityLabel="Cargando cargas por verificar" />;
  }

  if (consulta.isError && !consulta.data) {
    return (
      <View style={estilos.contenedor}>
        <Text style={estilos.aviso}>
          {consulta.error instanceof ErrorRed
            ? 'Sin conexión: no se pudo consultar qué cargas esperan verificación.'
            : consulta.error.message || 'No se pudo consultar qué cargas esperan verificación.'}
        </Text>
        <BotonTexto texto={consulta.isFetching ? 'Consultando…' : 'Reintentar'} onPress={() => void consulta.refetch()} />
      </View>
    );
  }

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.filaTitulo}>
        <Text style={estilos.titulo} accessibilityRole="header">
          Cargas por verificar
        </Text>
        <BotonTexto texto={consulta.isFetching ? 'Actualizando…' : 'Actualizar'} onPress={() => void consulta.refetch()} />
      </View>

      {cargas.length === 0 && (
        <Text style={estilos.aviso}>Ninguna carga espera verificación. Aparecen aquí cuando un vendedor termina su conteo.</Text>
      )}

      {error && (
        <Text style={estilos.error} accessibilityRole="alert">
          {error}
        </Text>
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
    <View style={estilos.grupo}>
      <Text style={estilos.tituloGrupo}>
        {titulo} · {cargas.length}
      </Text>
      {cargas.map((c) => (
        <FilaCarga key={c.id} carga={c} abriendo={abriendo === c.id} deshabilitada={abriendo !== null} onPress={onPress} />
      ))}
    </View>
  );
}

const COLOR_ESTADO: Record<CargaEnCola['estado'], string> = {
  lista: COLORES.capturado,
  propia: COLORES.capturado,
  bloqueada: COLORES.discrepancia,
  otro: COLORES.pendiente,
};

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
  const detalle = [
    carga.vendedorNombre ? `Contó ${carga.vendedorNombre}` : null,
    carga.totalProductos !== null ? `${carga.totalProductos} productos` : null,
    carga.fechaConteo ? formatearHora(carga.fechaConteo) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  let accion: string | null = null;
  let estadoTexto: string | null = null;
  switch (carga.estado) {
    case 'lista':
      accion = abriendo ? 'Abriendo…' : 'Verificar ›';
      break;
    case 'propia':
      accion = 'Continuar ›';
      estadoTexto = 'Ya empezaste a verificarla';
      break;
    case 'bloqueada':
      accion = 'Ver ›';
      estadoTexto = 'El vendedor tiene un corte de venta pendiente en Handy';
      break;
    case 'otro':
      estadoTexto = carga.verificandoPor ? `La está verificando ${carga.verificandoPor}` : 'Otra persona la está verificando';
      break;
  }

  const contenido = (presionada: boolean) => (
    <>
      <View style={[estilos.barraEstado, { backgroundColor: COLOR_ESTADO[carga.estado] }]} />
      <View style={estilos.cuerpoFila}>
        <Text style={[estilos.ruta, presionada && estilos.textoInvertido]} numberOfLines={1}>
          {carga.rutaNombre}
        </Text>
        <Text style={[estilos.tipo, presionada && estilos.textoInvertido]}>{tipo}</Text>
        {detalle.length > 0 && (
          <Text style={[estilos.detalle, presionada && estilos.textoInvertido]} numberOfLines={2}>
            {detalle}
          </Text>
        )}
        {estadoTexto && (
          <Text
            style={[
              estilos.estadoTexto,
              carga.estado === 'bloqueada' && estilos.estadoBloqueada,
              presionada && estilos.textoInvertido,
            ]}
          >
            {estadoTexto}
          </Text>
        )}
      </View>
      {accion && <Text style={[estilos.accion, presionada && estilos.textoInvertido]}>{accion}</Text>}
    </>
  );

  if (!onPress) {
    return (
      <View style={[estilos.fila, estilos.filaInactiva]} accessible accessibilityLabel={`${carga.rutaNombre}, ${tipo}. ${estadoTexto ?? ''}`}>
        {contenido(false)}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(carga)}
      disabled={deshabilitada}
      accessibilityRole="button"
      accessibilityLabel={`${carga.rutaNombre}, ${tipo}. ${detalle}. ${estadoTexto ?? ''}`}
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
          mensaje: e instanceof ErrorRed ? 'Sin conexión: no se pudo consultar a Handy.' : e.message || 'No se pudo consultar a Handy.',
        }),
    });
  };

  const vendedor = carga?.vendedorNombre ?? 'El vendedor';
  const libre = resultado?.tipo === 'libre';

  return (
    <Modal visible={carga !== null} transparent animationType="none" onRequestClose={cerrar}>
      <View style={estilos.fondoModal}>
        <View style={[estilos.modal, libre && estilos.modalLibre]}>
          <Text style={estilos.tituloModal} accessibilityRole="header">
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
            {resultado?.tipo === 'sigue' && <Text style={[estilos.textoModal, estilos.estadoBloqueada]}>{resultado.mensaje}</Text>}
            {resultado?.tipo === 'error' && <Text style={estilos.error}>{resultado.mensaje}</Text>}
          </View>
          <View style={estilos.botonesModal}>
            <BotonModal texto="Cerrar" onPress={cerrar} deshabilitado={desbloquear.isPending || abriendo} />
            {libre && carga ? (
              <BotonModal
                texto={abriendo ? 'Abriendo…' : 'Verificar ahora'}
                principal
                deshabilitado={abriendo}
                onPress={() => {
                  setResultado(null);
                  onVerificar(carga);
                }}
              />
            ) : (
              <BotonModal
                texto={desbloquear.isPending ? 'Consultando…' : 'Reintentar'}
                principal
                deshabilitado={desbloquear.isPending}
                onPress={reintentar}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BotonTexto({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={ESPACIADO.sm}
      style={({ pressed }) => [estilos.botonTexto, pressed && estilos.filaPresionada]}
    >
      {({ pressed }) => <Text style={[estilos.textoBotonTexto, pressed && estilos.textoInvertido]}>{texto}</Text>}
    </Pressable>
  );
}

function BotonModal({
  texto,
  onPress,
  principal = false,
  deshabilitado = false,
}: {
  texto: string;
  onPress: () => void;
  principal?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado }}
      style={({ pressed }) => [
        estilos.botonModal,
        principal && estilos.botonModalPrincipal,
        pressed && estilos.botonModalPresionado,
        deshabilitado && estilos.deshabilitado,
      ]}
    >
      {({ pressed }) => (
        <Text style={[estilos.textoBotonModal, (principal || pressed) && estilos.textoInvertido]}>{texto}</Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    width: '100%',
    gap: ESPACIADO.md,
  },
  cargando: {
    marginTop: ESPACIADO.xl,
  },
  filaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ESPACIADO.md,
  },
  titulo: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  aviso: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.textoSecundario,
  },
  error: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.error,
  },
  grupo: {
    gap: ESPACIADO.sm,
  },
  tituloGrupo: {
    marginTop: ESPACIADO.sm,
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.textoSecundario,
    textTransform: 'uppercase',
  },
  fila: {
    minHeight: TOQUE_MINIMO + ESPACIADO.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.md,
    paddingRight: ESPACIADO.md,
    backgroundColor: COLORES.fondo,
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
    overflow: 'hidden',
  },
  filaInactiva: {
    borderColor: COLORES.borde,
    backgroundColor: COLORES.superficie,
  },
  filaPresionada: {
    backgroundColor: COLORES.texto,
  },
  barraEstado: {
    alignSelf: 'stretch',
    width: ANCHO_BARRA_ESTADO,
  },
  cuerpoFila: {
    flex: 1,
    paddingVertical: ESPACIADO.md,
    gap: 2,
  },
  ruta: {
    fontSize: TIPOGRAFIA.tamanos.xl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  tipo: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  detalle: {
    fontSize: TIPOGRAFIA.tamanos.sm,
    color: COLORES.textoSecundario,
  },
  estadoTexto: {
    marginTop: ESPACIADO.xs,
    fontSize: TIPOGRAFIA.tamanos.sm,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSecundario,
  },
  estadoBloqueada: {
    color: COLORES.discrepancia,
    fontWeight: TIPOGRAFIA.pesos.negrita,
  },
  accion: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  deshabilitado: {
    opacity: 0.5,
  },
  botonTexto: {
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.md,
    borderRadius: RADIOS.md,
  },
  textoBotonTexto: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
    textDecorationLine: 'underline',
  },
  fondoModal: {
    flex: 1,
    justifyContent: 'center',
    padding: ESPACIADO.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  modal: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: ESPACIADO.md,
    padding: ESPACIADO.lg,
    backgroundColor: COLORES.fondo,
    borderRadius: RADIOS.lg,
    borderTopWidth: ANCHO_BARRA_ESTADO,
    borderTopColor: COLORES.discrepancia,
  },
  modalLibre: {
    borderTopColor: COLORES.capturado,
  },
  tituloModal: {
    fontSize: TIPOGRAFIA.tamanos.xxl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
  subtituloModal: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.textoSecundario,
  },
  textoModal: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.texto,
  },
  zonaResultado: {
    minHeight: 44,
    justifyContent: 'center',
  },
  botonesModal: {
    flexDirection: 'row',
    gap: ESPACIADO.md,
  },
  botonModal: {
    flex: 1,
    minHeight: TOQUE_MINIMO,
    paddingHorizontal: ESPACIADO.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
  },
  botonModalPrincipal: {
    backgroundColor: COLORES.texto,
  },
  botonModalPresionado: {
    backgroundColor: COLORES.textoSecundario,
    borderColor: COLORES.textoSecundario,
  },
  textoBotonModal: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
    textAlign: 'center',
  },
});

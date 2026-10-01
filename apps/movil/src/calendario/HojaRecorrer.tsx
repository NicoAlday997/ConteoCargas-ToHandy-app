import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CODIGO_CONFLICTO_EN_DESTINO } from '../api/calendario';
import { ErrorApi, ErrorRed } from '../api/cliente';
import { useCargasDelDia, useRecorrerCargas } from '../api/hooks-calendario';
import { useFechasOperativasDisponibles } from '../api/hooks-cargas';
import {
  AccionesHoja,
  BloqueError,
  BloqueEsqueleto,
  Boton,
  CampoTexto,
  Esqueleto,
  Etiqueta,
  Hoja,
  Pulsable,
} from '../componentes/base';
import { formatearDia } from '../conteo/fecha-operativa';
import { bandaDeEstado } from '../historial/ComponentesHistorial';
import { MOTIVO_MINIMO_CANCELACION } from '../supervisor/modelo-supervisor';
import { BORDES, COLORES, ESCALA_PRESIONADO, ESPACIADO, FUENTE, ONDA, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';
import {
  preguntaRecorrer,
  rutasEnConflicto,
  textoConflicto,
  textoRecorridas,
  type CargaDelDia,
} from './recorrer-cargas';

/** El mismo mínimo que valida el servidor: mueve trabajo de otros. */
const MOTIVO_MINIMO = MOTIVO_MINIMO_CANCELACION;

interface Props {
  /** `aaaa-mm-dd` del día que no se trabajó; `null` = cerrada. */
  fecha: string | null;
  /** Se propone como motivo (el del día no laborable); se puede editar. */
  motivoInicial: string;
  /**
   * La abrió el supervisor desde un día ya marcado: se muestra aunque el día
   * no tenga cargas. Si llega sola al marcar un día, solo aparece cuando hay
   * cargas que mover.
   */
  manual: boolean;
  onCerrar: () => void;
  /** Ya quedaron movidas; el texto confirma cuántas y a qué día. */
  onRecorridas: (aviso: string) => void;
}

/**
 * Quien la usa le pone `key` con la fecha: cada día abre desde cero, con el
 * motivo del día como propuesta.
 *
 * Recorrer las cargas de un día que no se trabajó (docs/01 §6 regla 10): la
 * lista (ruta, vendedor, estado y productos), el día destino (el siguiente
 * hábil, o el que elija el supervisor) y un solo botón que mueve todas. Si
 * una ruta ya tiene carga inicial en el destino no se mueve ninguna, y se dice
 * cuál.
 */
export function HojaRecorrer({ fecha, motivoInicial, manual, onCerrar, onRecorridas }: Props) {
  const consulta = useCargasDelDia(fecha);
  const recorrer = useRecorrerCargas();
  const [destinoElegido, setDestinoElegido] = useState<string | null>(null);
  const [eligiendoDia, setEligiendoDia] = useState(false);
  const [motivo, setMotivo] = useState(motivoInicial);
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState<{ titulo: string; detalle: string | null } | null>(null);

  const vista = consulta.data;
  const destino = destinoElegido ?? vista?.destinoSugerido ?? null;
  const motivoValido = motivo.trim().length >= MOTIVO_MINIMO;
  const sinCargas = vista !== undefined && vista.cargas.length === 0;

  // Llegó sola al marcar el día y no hay nada que mover: no se muestra.
  useEffect(() => {
    if (!manual && fecha !== null && sinCargas) onCerrar();
  }, [manual, fecha, sinCargas, onCerrar]);

  const visible = fecha !== null && (manual || consulta.isError || (vista !== undefined && vista.cargas.length > 0));

  const cerrar = () => {
    if (recorrer.isPending) return;
    onCerrar();
  };

  const confirmar = () => {
    setIntento(true);
    if (fecha === null || destino === null || !motivoValido || !vista) return;
    setError(null);
    recorrer.mutate(
      { fechaOrigen: fecha, fechaDestino: destino, motivo: motivo.trim() },
      {
        onSuccess: (movidas) => onRecorridas(textoRecorridas(movidas, destino)),
        onError: (e) => setError(errorRecorrer(e, destino)),
      },
    );
  };

  const cuantas = vista?.cargas.length ?? 0;
  const pie =
    vista && !sinCargas && !eligiendoDia ? (
      <AccionesHoja>
        <Boton texto="Ahora no" variante="secundario" deshabilitado={recorrer.isPending} onPress={cerrar} />
        <Boton
          texto={cuantas === 1 ? 'Recorrer la carga' : `Recorrer las ${cuantas}`}
          cargando={recorrer.isPending}
          textoCargando="Recorriendo…"
          deshabilitado={destino === null}
          onPress={confirmar}
        />
      </AccionesHoja>
    ) : undefined;

  return (
    <Hoja visible={visible} onCerrar={cerrar} bloqueada={recorrer.isPending} pie={pie} formulario>
      {fecha !== null && eligiendoDia ? (
        <ElegirDestino
          origen={fecha}
          actual={destino}
          onElegir={(dia) => {
            setDestinoElegido(dia);
            setEligiendoDia(false);
            setError(null);
          }}
          onVolver={() => setEligiendoDia(false)}
        />
      ) : consulta.isPending ? (
        <Esqueleto etiqueta="Buscando las cargas de ese día">
          <BloqueEsqueleto alto={TOQUE_MINIMO * 3} />
        </Esqueleto>
      ) : consulta.isError ? (
        <BloqueError
          titulo="No se pudieron revisar las cargas de ese día"
          detalle={
            consulta.error instanceof ErrorRed
              ? 'Sin conexión. El día sí quedó marcado; cuando haya señal, ábrelo desde la lista para recorrer sus cargas.'
              : (consulta.error instanceof Error && consulta.error.message) || null
          }
          tono={consulta.error instanceof ErrorRed ? 'atencion' : 'error'}
          onReintentar={() => void consulta.refetch()}
          reintentando={consulta.isFetching}
          secundaria={{ texto: 'Cerrar', onPress: cerrar }}
        />
      ) : sinCargas ? (
        <>
          <Text style={estilos.titulo} accessibilityRole="header">
            Este día no tiene cargas que recorrer
          </Text>
          {vista.excluidas.length > 0 && <NotaExcluidas cuantas={vista.excluidas.length} />}
          <Boton texto="Cerrar" variante="secundario" onPress={cerrar} />
        </>
      ) : (
        vista && (
          <>
            <Text style={estilos.titulo} accessibilityRole="header">
              {preguntaRecorrer(cuantas, destino)}
            </Text>
            <Text style={estilos.detalle}>
              {formatearDia(vista.fecha)} no se trabajó. Las cargas se mueven completas, con lo contado; las que ya se
              enviaron también: se corrige el historial y la ruta en Handy no se modifica.
            </Text>
            <ScrollView style={estilos.lista} contentContainerStyle={estilos.contenidoLista}>
              {vista.cargas.map((carga, i) => (
                <RenglonCarga key={carga.id} carga={carga} primero={i === 0} />
              ))}
            </ScrollView>
            {vista.excluidas.length > 0 && <NotaExcluidas cuantas={vista.excluidas.length} />}
            <View style={estilos.destino}>
              <View style={estilos.textosDestino}>
                <Text style={estilos.rotulo}>Se recorren al</Text>
                <Text style={estilos.diaDestino}>{destino ? formatearDia(destino) : 'Elige un día'}</Text>
              </View>
              <Boton
                texto="Otro día"
                variante="secundario"
                deshabilitado={recorrer.isPending}
                onPress={() => setEligiendoDia(true)}
              />
            </View>
            <CampoTexto
              etiqueta="Motivo"
              valor={motivo}
              onCambiar={setMotivo}
              ejemplo="Ej. no se trabajó por el frío"
              maxLength={200}
              ayuda={`Obligatorio. Mínimo ${MOTIVO_MINIMO} caracteres. Queda en el historial de cada carga.`}
              error={intento && !motivoValido ? `Escribe el motivo (mínimo ${MOTIVO_MINIMO} caracteres).` : null}
            />
            {error && <BloqueError titulo={error.titulo} detalle={error.detalle} />}
          </>
        )
      )}
    </Hoja>
  );
}

function RenglonCarga({ carga, primero }: { carga: CargaDelDia; primero: boolean }) {
  const estado = bandaDeEstado(carga.estado);
  const productos = carga.totalProductos === 1 ? '1 producto' : `${carga.totalProductos} productos`;
  const ruta = carga.tipo === 'RECARGA' ? `${carga.rutaNombre} · Recarga` : carga.rutaNombre;
  return (
    <View
      style={[estilos.renglon, !primero && estilos.renglonConDivisor]}
      accessible
      accessibilityLabel={`${ruta}, ${carga.vendedorNombre ?? 'sin vendedor'}, ${estado.titulo}, ${productos}`}
    >
      <View style={estilos.textosRenglon}>
        <Text style={estilos.nombreRuta}>{ruta}</Text>
        <Text style={estilos.detalle}>
          {carga.vendedorNombre ?? 'Sin vendedor'} · {productos}
        </Text>
      </View>
      <Etiqueta texto={estado.titulo} tono={estado.tono} />
    </View>
  );
}

function NotaExcluidas({ cuantas }: { cuantas: number }) {
  return (
    <Text style={estilos.detalle}>
      {cuantas === 1 ? '1 carga se queda en su día' : `${cuantas} cargas se quedan en su día`}: están canceladas o con el
      envío a Handy sin confirmar.
    </Text>
  );
}

/**
 * Otro día hábil para recorrerlas. Los días los da el servidor (al supervisor,
 * todos los hábiles de hoy en adelante); solo se ofrecen los posteriores al
 * día que no se trabajó.
 */
function ElegirDestino({
  origen,
  actual,
  onElegir,
  onVolver,
}: {
  origen: string;
  actual: string | null;
  onElegir: (dia: string) => void;
  onVolver: () => void;
}) {
  const fechas = useFechasOperativasDisponibles(true);
  const opciones = (fechas.data ?? []).filter((o) => o.dia > origen);

  return (
    <>
      <Text style={estilos.titulo} accessibilityRole="header">
        ¿A qué día las recorres?
      </Text>
      {fechas.isPending ? (
        <Esqueleto etiqueta="Cargando los días hábiles">
          <BloqueEsqueleto alto={TOQUE_MINIMO * 3} />
        </Esqueleto>
      ) : fechas.isError ? (
        <BloqueError
          titulo="No se pudieron consultar los días"
          detalle={
            fechas.error instanceof ErrorRed
              ? 'Sin conexión. Revisa tu señal y reintenta.'
              : (fechas.error instanceof Error && fechas.error.message) || null
          }
          tono={fechas.error instanceof ErrorRed ? 'atencion' : 'error'}
          onReintentar={() => void fechas.refetch()}
          reintentando={fechas.isFetching}
        />
      ) : (
        <ScrollView style={estilos.lista} contentContainerStyle={estilos.contenidoDias}>
          {opciones.map((opcion) => {
            const elegido = opcion.dia === actual;
            return (
              <Pulsable
                key={opcion.dia}
                onPress={() => onElegir(opcion.dia)}
                tacto="seleccion"
                onda={ONDA.sobreColor}
                escala={ESCALA_PRESIONADO}
                accessibilityRole="button"
                accessibilityLabel={`${formatearDia(opcion.dia)}${elegido ? ', elegido' : ''}`}
                accessibilityState={{ selected: elegido }}
                style={({ pressed }) => [estilos.opcion, elegido && estilos.opcionElegida, pressed && estilos.opcionPresionada]}
              >
                <Text style={[estilos.textoOpcion, elegido && estilos.textoOpcionElegida]}>{formatearDia(opcion.dia)}</Text>
              </Pulsable>
            );
          })}
        </ScrollView>
      )}
      <Boton texto="Volver" variante="secundario" onPress={onVolver} />
    </>
  );
}

function errorRecorrer(e: unknown, destino: string): { titulo: string; detalle: string | null } {
  if (e instanceof ErrorRed) {
    return { titulo: 'Sin conexión', detalle: 'No se movió ninguna carga. Inténtalo cuando haya señal.' };
  }
  if (e instanceof ErrorApi && e.cuerpo?.codigo === CODIGO_CONFLICTO_EN_DESTINO) {
    return { titulo: 'No se movió ninguna carga', detalle: textoConflicto(rutasEnConflicto(e.cuerpo), destino) };
  }
  return { titulo: 'No se pudieron recorrer las cargas', detalle: e instanceof Error && e.message ? e.message : null };
}

const estilos = StyleSheet.create({
  titulo: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  detalle: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },
  lista: {
    maxHeight: TOQUE_MINIMO * 5,
  },
  contenidoLista: {
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.grande,
    borderWidth: BORDES.fino,
    borderColor: COLORES.contornoTarjeta,
  },
  renglon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.md,
    paddingHorizontal: ESPACIADO.lg,
    paddingVertical: ESPACIADO.md,
  },
  renglonConDivisor: {
    borderTopWidth: BORDES.fino,
    borderTopColor: COLORES.divisor,
  },
  textosRenglon: {
    flex: 1,
    gap: 2,
  },
  nombreRuta: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.extraNegrita,
    color: COLORES.texto,
  },
  destino: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.md,
  },
  textosDestino: {
    flex: 1,
    gap: 2,
  },
  rotulo: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.textoSecundario,
  },
  diaDestino: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.extraNegrita,
    color: COLORES.texto,
  },
  contenidoDias: {
    gap: RITMO.interno,
  },
  opcion: {
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.lg,
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.control,
    borderWidth: BORDES.fino,
    borderColor: COLORES.contornoTarjeta,
  },
  opcionElegida: {
    backgroundColor: COLORES.accion,
    borderColor: COLORES.accion,
  },
  opcionPresionada: {
    backgroundColor: COLORES.marcaTinte,
  },
  textoOpcion: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  textoOpcionElegida: {
    color: COLORES.textoSobreColor,
  },
});

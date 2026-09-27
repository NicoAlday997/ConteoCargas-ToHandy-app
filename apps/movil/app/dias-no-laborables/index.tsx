import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DiaNoLaborable } from '../../src/api/calendario';
import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import {
  useDiasNoLaborables,
  useMarcarDiaNoLaborable,
  useQuitarDiaNoLaborable,
} from '../../src/api/hooks-calendario';
import {
  BloqueError,
  Boton,
  CampoTexto,
  Esqueleto,
  EstadoVacio,
  NotaEncabezado,
  TarjetaEsqueleto,
} from '../../src/componentes/base';
import { DIAS_CABECERA, mesDe, moverMes, semanasDelMes, tituloMes, type Mes } from '../../src/calendario/modelo-calendario';
import { diaNegocio, formatearDia } from '../../src/conteo/fecha-operativa';
import { ANCHO_MAXIMO_LISTA, BarraSuperior, volver } from '../../src/historial/ComponentesHistorial';
import { avisoDeError, sesionVencida, type AvisoError } from '../../src/plantillas/ComponentesPlantillas';
import { ModalConfirmacion } from '../../src/supervisor/ModalConfirmacion';
import { useEsSupervisor } from '../../src/supervisor/useEsSupervisor';
import {
  ANCHO_MODAL,
  BORDES,
  CIFRAS,
  COLORES,
  ESPACIADO,
  FUENTE,
  OPACIDAD,
  RADIOS,
  RITMO,
  TIPOGRAFIA,
  TOQUE_MINIMO,
} from '../../src/theme/tokens';

/**
 * Días no laborables (solo Supervisor): festivos, paros, clima o cierres
 * completos (Navidad). Esos días ninguna carga puede salir, y al vendedor la
 * app ya no se los ofrece. Los domingos no se marcan aquí: el calendario ya
 * los trae fuera.
 */

const TITULO = 'Días no laborables';
const AYUDA = 'Los domingos ya están considerados. Aquí marca festivos, paros o cierres.';
const MOTIVO_MINIMO = 3;

export default function PantallaDiasNoLaborables() {
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
          detalle="Los días no laborables los marca un supervisor."
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
        <NotaEncabezado>{AYUDA}</NotaEncabezado>
      </BarraSuperior>
      {children}
    </SafeAreaView>
  );
}

function EsqueletoLista() {
  return (
    <Esqueleto etiqueta="Cargando días no laborables" style={estilos.contenido}>
      <TarjetaEsqueleto lineas={['60%', '45%', '70%']} />
    </Esqueleto>
  );
}

function Lista() {
  const consulta = useDiasNoLaborables(true);
  const quitar = useQuitarDiaNoLaborable();
  const [marcando, setMarcando] = useState(false);
  const [aQuitar, setAQuitar] = useState<DiaNoLaborable | null>(null);
  const [errorQuitar, setErrorQuitar] = useState<AvisoError | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const vencida = consulta.error instanceof ErrorApi && consulta.error.estado === 401;
  useEffect(() => {
    if (vencida) sesionVencida();
  }, [vencida]);

  const confirmarQuitar = () => {
    if (!aQuitar) return;
    setErrorQuitar(null);
    quitar.mutate(aQuitar.fecha, {
      onSuccess: () => setAQuitar(null),
      onError: (e) => setErrorQuitar(avisoCalendario(e, 'No se pudo quitar el día')),
    });
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
            titulo={sinRed ? 'Sin conexión' : 'No se pudieron cargar los días'}
            detalle={
              sinRed
                ? 'Los días no laborables se consultan en el servidor: revisa tu señal.'
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

  const dias = consulta.data ?? [];

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
        <Boton texto="Marcar un día" onPress={() => setMarcando(true)} />
        {dias.length === 0 ? (
          <EstadoVacio
            icono="reloj"
            titulo="No hay días marcados"
            detalle="De hoy en adelante se trabaja de lunes a sábado. Marca aquí un festivo, un paro o un cierre."
            enLinea
          />
        ) : (
          <View style={estilos.tarjeta}>
            {dias.map((dia, i) => (
              <RenglonDia key={dia.fecha} dia={dia} primero={i === 0} onQuitar={() => setAQuitar(dia)} />
            ))}
          </View>
        )}
      </ScrollView>
      <ModalMarcar
        visible={marcando}
        marcados={dias.map((d) => d.fecha)}
        onCerrar={() => setMarcando(false)}
      />
      <ModalConfirmacion
        visible={aQuitar !== null}
        titulo="¿Quitar este día?"
        textoConfirmar="Sí, quitarlo"
        textoCargando="Quitando…"
        textoCerrar="No, dejarlo"
        variante="peligro"
        cargando={quitar.isPending}
        error={errorQuitar}
        onConfirmar={confirmarQuitar}
        onCerrar={() => {
          setAQuitar(null);
          setErrorQuitar(null);
        }}
      >
        {aQuitar && (
          <Text style={estilos.cuerpo}>
            El {formatearDia(aQuitar.fecha).toLowerCase()} vuelve a ser día de trabajo y los vendedores podrán cargar
            para ese día.
          </Text>
        )}
      </ModalConfirmacion>
    </Pantalla>
  );
}

function RenglonDia({ dia, primero, onQuitar }: { dia: DiaNoLaborable; primero: boolean; onQuitar: () => void }) {
  const legible = formatearDia(dia.fecha);
  return (
    <View style={[estilos.renglon, !primero && estilos.renglonConDivisor]}>
      <View style={estilos.textosRenglon}>
        <Text style={estilos.nombre}>{legible}</Text>
        <Text style={estilos.detalle}>{dia.motivo}</Text>
        {dia.creadoPorNombre && <Text style={estilos.quien}>Marcado por {dia.creadoPorNombre}</Text>}
      </View>
      <Pressable
        onPress={onQuitar}
        accessibilityRole="button"
        accessibilityLabel={`Quitar ${legible}`}
        style={({ pressed }) => [estilos.quitar, pressed && estilos.quitarPresionado]}
      >
        <Text style={estilos.textoQuitar}>Quitar</Text>
      </Pressable>
    </View>
  );
}

/**
 * Elegir el día en una cuadrícula del mes y escribir el motivo. Los días
 * pasados, los domingos y los ya marcados no se pueden tocar (el servidor los
 * rechazaría igual).
 */
function ModalMarcar({
  visible,
  marcados,
  onCerrar,
}: {
  visible: boolean;
  marcados: readonly string[];
  onCerrar: () => void;
}) {
  const marcar = useMarcarDiaNoLaborable();
  const hoy = diaNegocio(new Date());
  const [mes, setMes] = useState<Mes>(() => mesDe(hoy));
  const [dia, setDia] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState<AvisoError | null>(null);

  const motivoValido = motivo.trim().length >= MOTIVO_MINIMO;
  const esMesActual = mes.anio === mesDe(hoy).anio && mes.mes === mesDe(hoy).mes;

  const cerrar = () => {
    if (marcar.isPending) return;
    setMes(mesDe(hoy));
    setDia(null);
    setMotivo('');
    setIntento(false);
    setError(null);
    onCerrar();
  };

  const guardar = () => {
    setIntento(true);
    if (dia === null || !motivoValido) return;
    setError(null);
    marcar.mutate(
      { fecha: dia, motivo: motivo.trim() },
      {
        onSuccess: cerrar,
        onError: (e) => setError(avisoCalendario(e, 'No se pudo marcar el día')),
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={cerrar}>
      <View style={estilos.fondoModal}>
        <ScrollView contentContainerStyle={estilos.centrado} bounces={false} keyboardShouldPersistTaps="handled">
          <View style={estilos.modal}>
            <Text style={estilos.tituloModal} accessibilityRole="header">
              Marcar un día no laborable
            </Text>
            <View style={estilos.cabeceraMes}>
              <BotonMes texto="‹" etiqueta="Mes anterior" deshabilitado={esMesActual} onPress={() => setMes(moverMes(mes, -1))} />
              <Text style={estilos.tituloMes}>{tituloMes(mes)}</Text>
              <BotonMes texto="›" etiqueta="Mes siguiente" onPress={() => setMes(moverMes(mes, 1))} />
            </View>
            <View style={estilos.semana}>
              {DIAS_CABECERA.map((d, i) => (
                <Text key={i} style={estilos.cabeceraDia}>
                  {d}
                </Text>
              ))}
            </View>
            {semanasDelMes(mes).map((semana, i) => (
              <View key={i} style={estilos.semana}>
                {semana.map((celda, j) => {
                  if (!celda) return <View key={j} style={estilos.celda} />;
                  const inhabil = celda.dia < hoy || celda.esDomingo || marcados.includes(celda.dia);
                  const elegido = celda.dia === dia;
                  return (
                    <Pressable
                      key={j}
                      onPress={() => setDia(celda.dia)}
                      disabled={inhabil}
                      accessibilityRole="button"
                      accessibilityLabel={formatearDia(celda.dia)}
                      accessibilityState={{ disabled: inhabil, selected: elegido }}
                      style={[estilos.celda, elegido && estilos.celdaElegida, inhabil && estilos.celdaInhabil]}
                    >
                      <Text style={[estilos.numeroDia, elegido && estilos.numeroElegido]}>{celda.numero}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <Text style={[estilos.cuerpo, intento && dia === null && estilos.textoError]}>
              {dia ? formatearDia(dia) : 'Toca el día que no se trabaja.'}
            </Text>
            <CampoTexto
              etiqueta="Motivo"
              valor={motivo}
              onCambiar={setMotivo}
              ejemplo="Ej. Día de la Revolución"
              maxLength={200}
              ayuda={`Obligatorio. Mínimo ${MOTIVO_MINIMO} caracteres.`}
              error={intento && !motivoValido ? `Escribe el motivo (mínimo ${MOTIVO_MINIMO} caracteres).` : null}
            />
            {error && <BloqueError titulo={error.titulo} detalle={error.detalle} tono={error.tono} />}
            <Boton texto="Marcar día" cargando={marcar.isPending} textoCargando="Marcando…" onPress={guardar} />
            <Boton texto="Cancelar" variante="secundario" deshabilitado={marcar.isPending} onPress={cerrar} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function BotonMes({
  texto,
  etiqueta,
  deshabilitado = false,
  onPress,
}: {
  texto: string;
  etiqueta: string;
  deshabilitado?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      style={({ pressed }) => [estilos.botonMes, pressed && estilos.quitarPresionado, deshabilitado && estilos.celdaInhabil]}
    >
      <Text style={estilos.textoBotonMes}>{texto}</Text>
    </Pressable>
  );
}

/** Mismo criterio que las plantillas, con el texto de sin red de esta pantalla. */
function avisoCalendario(e: unknown, titulo: string): AvisoError | null {
  if (e instanceof ErrorRed) {
    return {
      titulo: 'Sin conexión',
      detalle: 'Los días no laborables se guardan en el servidor: revisa tu señal y vuelve a intentarlo.',
      tono: 'atencion',
    };
  }
  return avisoDeError(e, titulo);
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
  },
  renglon: {
    minHeight: TOQUE_MINIMO + ESPACIADO.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
    paddingHorizontal: RITMO.margen,
    paddingVertical: ESPACIADO.md,
  },
  renglonConDivisor: {
    borderTopWidth: BORDES.fino,
    borderTopColor: COLORES.divisor,
  },
  textosRenglon: {
    flex: 1,
    gap: ESPACIADO.xs,
  },
  nombre: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  detalle: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },
  quien: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoTerciario,
  },
  quitar: {
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.md,
    borderRadius: RADIOS.medio,
  },
  quitarPresionado: {
    backgroundColor: COLORES.superficieHonda,
  },
  textoQuitar: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.negrita,
    color: COLORES.error,
  },
  cuerpo: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  textoError: {
    color: COLORES.error,
  },
  fondoModal: {
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
  tituloModal: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  cabeceraMes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tituloMes: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  botonMes: {
    width: TOQUE_MINIMO,
    height: TOQUE_MINIMO,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
  },
  textoBotonMes: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
  },
  semana: {
    flexDirection: 'row',
  },
  cabeceraDia: {
    flex: 1,
    textAlign: 'center',
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.textoSecundario,
  },
  celda: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.medio,
  },
  celdaElegida: {
    backgroundColor: COLORES.texto,
  },
  celdaInhabil: {
    opacity: OPACIDAD.bloqueado,
  },
  numeroDia: {
    ...TIPOGRAFIA.subtitulo,
    ...CIFRAS,
    color: COLORES.texto,
  },
  numeroElegido: {
    color: COLORES.textoSobreColor,
  },
});

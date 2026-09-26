import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ErrorApi, ErrorRed } from '../api/cliente';
import { useCancelarCargaSupervisor } from '../api/hooks-supervisor';
import { CODIGO_HANDY_RECHAZO } from '../api/supervisor';
import { Boton, CampoTexto } from '../componentes/base';
import type { CargaDetalle } from '../historial/modelo-historial';
import { COLORES, FUENTE, TIPOGRAFIA } from '../theme/tokens';
import { ModalConfirmacion } from './ModalConfirmacion';
import { accionCancelacion, MOTIVO_MINIMO_CANCELACION, motivoCancelacionValido } from './modelo-supervisor';

type ErrorModal = { titulo: string; detalle: string; tono?: 'error' | 'atencion' };

function mensajeError(e: unknown, enHandy: boolean): ErrorModal {
  if (e instanceof ErrorRed) {
    return { titulo: 'Sin conexión', detalle: 'No se canceló nada. Inténtalo cuando haya señal.', tono: 'atencion' };
  }
  if (e instanceof ErrorApi && e.cuerpo?.codigo === CODIGO_HANDY_RECHAZO) {
    return {
      titulo: 'Handy no dejó cancelarla',
      detalle: e.message || 'Handy ya no permite cancelar esta ruta. La carga sigue enviada.',
    };
  }
  if (e instanceof ErrorApi && e.estado === 409) {
    return {
      titulo: 'La carga cambió',
      detalle: e.message || 'Alguien actuó sobre esta carga hace un momento. Cierra para ver cómo quedó.',
    };
  }
  return {
    titulo: enHandy ? 'No se pudo cancelar en Handy' : 'No se pudo cancelar',
    detalle: e instanceof Error && e.message ? e.message : 'Intenta de nuevo en un momento.',
  };
}

/**
 * «Cancelar carga» del supervisor, con motivo obligatorio: si cancela el
 * trabajo de otros, queda escrito por qué. Una carga ya enviada dice «Cancelar
 * en Handy»: se cancela allá primero y, solo si Handy acepta, aquí. Nada se
 * borra: la carga queda cancelada en el historial.
 *
 * No se muestra si no hay nada que cancelar (ya cancelada o con el envío sin
 * confirmar).
 */
export function CancelarCargaSupervisor({
  carga,
  onSesionVencida,
  onCancelada,
}: {
  carga: CargaDetalle;
  onSesionVencida: () => void;
  onCancelada?: () => void;
}) {
  const cancelar = useCancelarCargaSupervisor(carga.evento.id);
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState<ErrorModal | null>(null);

  const accion = accionCancelacion(carga.evento.estado);
  if (!accion) return null;
  const enHandy = accion === 'cancelar-en-handy';

  const abrir = () => {
    setMotivo('');
    setIntento(false);
    setError(null);
    setAbierto(true);
  };

  const confirmar = () => {
    setIntento(true);
    if (!motivoCancelacionValido(motivo)) return;
    setError(null);
    cancelar.mutate(
      { enHandy, motivo: motivo.trim() },
      {
        onSuccess: () => {
          setAbierto(false);
          onCancelada?.();
        },
        onError: (e) => {
          if (e instanceof ErrorApi && e.estado === 401) return onSesionVencida();
          setError(mensajeError(e, enHandy));
        },
      },
    );
  };

  return (
    <>
      <Boton texto={enHandy ? 'Cancelar en Handy' : 'Cancelar carga'} variante="peligro" onPress={abrir} />
      <ModalConfirmacion
        visible={abierto}
        titulo={enHandy ? '¿Cancelar esta carga en Handy?' : '¿Cancelar esta carga?'}
        textoConfirmar={enHandy ? 'Cancelar en Handy' : 'Cancelar carga'}
        textoCargando="Cancelando…"
        textoCerrar="No, volver"
        variante="peligro"
        cargando={cancelar.isPending}
        error={error}
        onConfirmar={confirmar}
        onCerrar={() => setAbierto(false)}
      >
        <Text style={estilos.texto}>
          <Text style={estilos.negrita}>Esto no se puede deshacer.</Text> La carga de{' '}
          <Text style={estilos.negrita}>{carga.evento.rutaNombre}</Text> queda cancelada: no se borra, se queda en el
          historial con tu nombre y tu motivo.
        </Text>
        {enHandy ? (
          <Text style={estilos.texto}>
            Primero se le pide a Handy que cancele la ruta. Si el vendedor ya la aceptó en su celular, Handy no deja
            cancelarla y aquí no cambia nada.
          </Text>
        ) : (
          <Text style={estilos.texto}>Si alguien todavía la está contando, su conteo se cierra.</Text>
        )}
        <CampoTexto
          etiqueta="Motivo"
          valor={motivo}
          onCambiar={setMotivo}
          ejemplo="Ej. se abrió con la fecha equivocada"
          multilinea
          maxLength={200}
          ayuda={`Obligatorio. Mínimo ${MOTIVO_MINIMO_CANCELACION} caracteres.`}
          error={
            intento && !motivoCancelacionValido(motivo)
              ? `Escribe por qué la cancelas (mínimo ${MOTIVO_MINIMO_CANCELACION} caracteres).`
              : null
          }
        />
      </ModalConfirmacion>
    </>
  );
}

const estilos = StyleSheet.create({
  texto: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  negrita: {
    fontFamily: FUENTE.negrita,
  },
});

import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { Boton } from '../componentes/base';
import { ModalCambiarFecha } from '../conteo/CambiarFechaCarga';
import type { CargaDetalle } from '../historial/modelo-historial';
import { MOTIVO_MINIMO_CANCELACION, puedeCambiarFecha } from './modelo-supervisor';

/**
 * «Cambiar fecha de salida» del supervisor: mueve la carga de día sin tocar lo
 * contado, con motivo obligatorio (mismo mínimo que al cancelar). No se
 * muestra si la carga ya se envió, se canceló o tiene el envío sin confirmar.
 */
export function CambiarFechaSupervisor({
  carga,
  onSesionVencida,
  style,
}: {
  carga: CargaDetalle;
  onSesionVencida: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [abierto, setAbierto] = useState(false);
  const { evento } = carga;
  if (!evento.dia || !puedeCambiarFecha(evento.estado)) return null;

  return (
    <>
      <Boton texto="Cambiar fecha de salida" variante="secundario" onPress={() => setAbierto(true)} style={style} />
      <ModalCambiarFecha
        visible={abierto}
        eventoId={evento.id}
        tipo={evento.tipo}
        diaActual={evento.dia}
        productosContados={carga.totalProductos}
        motivoMinimo={MOTIVO_MINIMO_CANCELACION}
        onCambiada={() => setAbierto(false)}
        onCerrar={() => setAbierto(false)}
        onSesionVencida={onSesionVencida}
      />
    </>
  );
}

import { useState } from 'react';

import type { TipoCarga } from '../api/cargas';
import { ErrorApi, ErrorRed } from '../api/cliente';
import { useCambiarFechaOperativa } from '../api/hooks-cargas';
import {
  SelectorFechaOperativa,
  type AvisoCambioFecha,
} from './SelectorFechaOperativa';

interface Props {
  visible: boolean;
  eventoId: string;
  tipo: TipoCarga | null;
  /** `aaaa-mm-dd`: el día que tiene ahora la carga. */
  diaActual: string;
  productosContados: number;
  /** Supervisor: mínimo de caracteres del motivo. `null`: no se pide (vendedor). */
  motivoMinimo: number | null;
  /** Se dice antes de confirmar (p. ej. la carga ya se envió a Handy). */
  aviso?: AvisoCambioFecha | null;
  /** Ya quedó en el servidor; `dia` es el nuevo. */
  onCambiada: (dia: string) => void;
  onCerrar: () => void;
  onSesionVencida: () => void;
}

/**
 * Mueve la carga a otro día sin tocar lo contado (`PATCH .../fecha-operativa`).
 * El selector abre en el día actual y confirma antes; aquí se llama al
 * servidor y se traduce el error. Lo usan el conteo, el inicio del vendedor y
 * el detalle del supervisor.
 */
export function ModalCambiarFecha({
  visible,
  eventoId,
  tipo,
  diaActual,
  productosContados,
  motivoMinimo,
  aviso = null,
  onCambiada,
  onCerrar,
  onSesionVencida,
}: Props) {
  const cambiar = useCambiarFechaOperativa(eventoId);
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => {
    if (cambiar.isPending) return;
    setError(null);
    onCerrar();
  };

  return (
    <SelectorFechaOperativa
      tipo={visible ? (tipo ?? 'INICIAL') : null}
      conflicto={null}
      cambio={{ diaActual, productosContados, motivoMinimo, aviso }}
      ocupado={cambiar.isPending}
      error={error}
      onElegir={(dia, motivo) => {
        setError(null);
        cambiar.mutate(
          { fechaOperativa: dia, motivo },
          {
            onSuccess: () => onCambiada(dia),
            onError: (e) => {
              if (e instanceof ErrorApi && e.estado === 401) {
                onCerrar();
                onSesionVencida();
                return;
              }
              setError(mensajeErrorCambioFecha(e));
            },
          },
        );
      }}
      onContinuarExistente={() => undefined}
      onElegirOtra={() => undefined}
      onCerrar={cerrar}
    />
  );
}

function mensajeErrorCambioFecha(e: unknown): string {
  if (e instanceof ErrorRed)
    return 'Sin conexión: no se cambió nada. Inténtalo cuando haya señal.';
  // El servidor ya explica en español (otra carga ese día, ya finalizaste, etc.).
  if (e instanceof Error && e.message) return e.message;
  return 'Intenta de nuevo en un momento.';
}

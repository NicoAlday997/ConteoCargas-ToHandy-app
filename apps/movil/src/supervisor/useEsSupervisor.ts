import { useEffect, useState } from 'react';

import { obtenerUsuarioSesion } from '../api/sesion';

/**
 * `undefined` mientras se lee la sesión. El servidor rechaza igual (403) a
 * quien no es supervisor; esto solo evita mostrarle una pantalla que no es suya.
 */
export function useEsSupervisor(): boolean | undefined {
  const [esSupervisor, setEsSupervisor] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let vigente = true;
    void obtenerUsuarioSesion().then((sesion) => {
      if (vigente) setEsSupervisor(sesion?.rolApp === 'SUPERVISOR');
    });
    return () => {
      vigente = false;
    };
  }, []);
  return esSupervisor;
}

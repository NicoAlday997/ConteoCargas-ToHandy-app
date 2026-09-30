import type { CargaDelDia } from '../application/consultas-carga.repository';
import { diaTexto } from '../domain/calendario-laboral';

/** Una carga de un dia como la ve la app: la fecha como `aaaa-mm-dd`. */
export function aRespuestaCargaDelDia(carga: CargaDelDia) {
  return {
    id: carga.id,
    rutaNombre: carga.rutaNombre,
    vendedorNombre: carga.vendedorNombre,
    tipo: carga.tipo,
    estado: carga.estado,
    fechaOperativa: diaTexto(carga.fechaOperativa),
    totalProductos: carga.totalProductos,
  };
}

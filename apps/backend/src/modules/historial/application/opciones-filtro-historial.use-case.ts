import type {
  HistorialRepository,
  OpcionesFiltroHistorial,
} from './historial.repository';

/**
 * Caso de uso: listas para llenar los filtros del historial (vendedor y ruta).
 * Solo para Contador y Supervisor; el vendedor no filtra por persona porque
 * solo ve lo suyo.
 *
 * Los inactivos NO se esconden: el caso principal es revisar las cargas de
 * alguien que ya no trabaja aqui. Van despues de los activos para que el dia a
 * dia no tenga que pasar por ellos, cada grupo en orden alfabetico.
 */
export class OpcionesFiltroHistorialUseCase {
  constructor(private readonly historial: HistorialRepository) {}

  async ejecutar(): Promise<OpcionesFiltroHistorial> {
    const { vendedores, rutas } = await this.historial.listarOpcionesFiltro();
    return {
      vendedores: [...vendedores].sort(
        (a, b) =>
          Number(b.activo) - Number(a.activo) ||
          compararTexto(a.nombreCompleto, b.nombreCompleto),
      ),
      rutas: [...rutas].sort(
        (a, b) =>
          Number(b.activa) - Number(a.activa) ||
          compararTexto(a.nombre, b.nombre),
      ),
    };
  }
}

/** Alfabetico en español, con "Ruta 2" antes que "Ruta 10". */
function compararTexto(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}

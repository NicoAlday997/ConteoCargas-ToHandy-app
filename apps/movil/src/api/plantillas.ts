import { peticion } from './cliente';
import type { ModalidadVentaApi } from './factores';

/**
 * Administración de plantillas de carga (docs/04 §1.2.1). Solo Supervisor.
 * Una plantilla decide qué productos ve el vendedor de cada ruta al contar.
 */

/** Código de 409 al desactivar una plantilla que alguna ruta usa. */
export const CODIGO_PLANTILLA_EN_USO = 'PLANTILLA_EN_USO';
export const CODIGO_NOMBRE_DUPLICADO = 'NOMBRE_DUPLICADO';

export interface RutaApi {
  id: string | null;
  nombre: string | null;
  codigo: string | null;
}

/** Fila de `GET /admin/plantillas`. */
export interface PlantillaResumenApi {
  id: string | null;
  nombre: string | null;
  descripcion: string | null;
  activa: boolean | null;
  totalProductos: number | null;
  rutas: RutaApi[] | null;
}

export interface ProductoPlantillaApi {
  code: string | null;
  nombre: string | null;
  familia: string | null;
  modalidadVenta: ModalidadVentaApi | null;
  piezasPorPaquete: number | null;
  factorConfirmado: boolean | null;
  /** `false` = desactivado en Handy: sigue en la plantilla, pero no sale al contar. */
  activo: boolean | null;
}

/** `GET /admin/plantillas/:id` y la respuesta de toda mutación. */
export interface PlantillaDetalleApi extends PlantillaResumenApi {
  familias: { familia: string | null; productos: ProductoPlantillaApi[] | null }[] | null;
}

/** Fila de `GET /admin/plantillas/rutas`. */
export interface RutaConPlantillaApi extends RutaApi {
  vendedores: string[] | null;
  plantillas: { id: string | null; nombre: string | null }[] | null;
  /** Algún vendedor de la ruta sin plantilla: ve el catálogo completo. */
  sinPlantilla: boolean | null;
}

export interface DatosPlantilla {
  nombre?: string;
  descripcion?: string | null;
  activa?: boolean;
}

const base = '/admin/plantillas';
const rutaPlantilla = (id: string) => `${base}/${encodeURIComponent(id)}`;

/** Todas, activas e inactivas: las inactivas se listan aparte para poder reactivarlas. */
export function listarPlantillas(): Promise<PlantillaResumenApi[] | null> {
  return peticion<PlantillaResumenApi[] | null>(`${base}?incluirInactivas=true`);
}

export function obtenerPlantilla(id: string): Promise<PlantillaDetalleApi | null> {
  return peticion<PlantillaDetalleApi | null>(rutaPlantilla(id));
}

export function listarRutasConPlantilla(): Promise<RutaConPlantillaApi[] | null> {
  return peticion<RutaConPlantillaApi[] | null>(`${base}/rutas`);
}

export function crearPlantilla(datos: { nombre: string; descripcion: string | null }): Promise<PlantillaDetalleApi | null> {
  return peticion<PlantillaDetalleApi | null>(base, { method: 'POST', cuerpo: datos });
}

export function editarPlantilla(id: string, datos: DatosPlantilla): Promise<PlantillaDetalleApi | null> {
  return peticion<PlantillaDetalleApi | null>(rutaPlantilla(id), { method: 'PATCH', cuerpo: datos });
}

/** Además de la plantilla: cuántos entraron y cuántos ya estaban. */
export interface RespuestaAgregarApi extends PlantillaDetalleApi {
  agregados: number | null;
  yaEstaban: number | null;
}

export function agregarProductos(id: string, codes: string[]): Promise<RespuestaAgregarApi | null> {
  return peticion<RespuestaAgregarApi | null>(`${rutaPlantilla(id)}/productos`, { method: 'POST', cuerpo: { codes } });
}

export function quitarProductos(id: string, codes: string[]): Promise<PlantillaDetalleApi | null> {
  return peticion<PlantillaDetalleApi | null>(`${rutaPlantilla(id)}/productos/quitar`, { method: 'POST', cuerpo: { codes } });
}

/** La ruta pasa a usar esta plantilla (deja la que tenía). */
export function asignarARuta(id: string, rutaId: string): Promise<PlantillaDetalleApi | null> {
  return peticion<PlantillaDetalleApi | null>(`${rutaPlantilla(id)}/rutas/${encodeURIComponent(rutaId)}`, { method: 'PUT' });
}

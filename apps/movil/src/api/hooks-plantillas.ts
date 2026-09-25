import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { normalizarDetalle, normalizarLista } from '../plantillas/modelo-plantillas';
import { ErrorApi } from './cliente';
import {
  agregarProductos,
  asignarARuta,
  crearPlantilla,
  editarPlantilla,
  listarPlantillas,
  listarRutasConPlantilla,
  obtenerPlantilla,
  quitarProductos,
  type DatosPlantilla,
  type PlantillaDetalleApi,
} from './plantillas';

export const clavesPlantillas = {
  todo: ['plantillas'] as const,
  lista: ['plantillas', 'lista'] as const,
  rutas: ['plantillas', 'rutas'] as const,
  detalle: (id: string) => ['plantillas', 'detalle', id] as const,
};

/** Un 403 o un 404 no se arreglan reintentando: se muestran de inmediato. */
function reintentar(fallos: number, error: unknown): boolean {
  if (error instanceof ErrorApi && error.estado < 500) return false;
  return fallos < 2;
}

/** `habilitado` = solo con sesión de supervisor: a los demás el servidor responde 403. */
export function usePlantillas(habilitado: boolean) {
  return useQuery({
    queryKey: clavesPlantillas.lista,
    queryFn: listarPlantillas,
    enabled: habilitado,
    // Otro supervisor puede estar editando: se relee al volver a la lista.
    staleTime: 0,
    retry: reintentar,
    select: normalizarLista,
  });
}

export function usePlantilla(id: string, habilitado: boolean) {
  return useQuery({
    queryKey: clavesPlantillas.detalle(id),
    queryFn: () => obtenerPlantilla(id),
    enabled: habilitado && id !== '',
    staleTime: 0,
    retry: reintentar,
    select: normalizarDetalle,
  });
}

export function useRutasConPlantilla(habilitado: boolean) {
  return useQuery({
    queryKey: clavesPlantillas.rutas,
    queryFn: listarRutasConPlantilla,
    enabled: habilitado,
    staleTime: 0,
    retry: reintentar,
  });
}

/**
 * Toda mutación responde la plantilla completa: se pone en caché tal cual (la
 * pantalla cambia sin volver a pedirla) y lo demás se marca para releer.
 */
function useAlGuardar() {
  const clienteConsultas = useQueryClient();
  return (respuesta: PlantillaDetalleApi | null) => {
    const id = respuesta?.id;
    if (id) clienteConsultas.setQueryData(clavesPlantillas.detalle(id), respuesta);
    void clienteConsultas.invalidateQueries({ queryKey: clavesPlantillas.lista });
    void clienteConsultas.invalidateQueries({ queryKey: clavesPlantillas.rutas });
  };
}

export function useCrearPlantilla() {
  const alGuardar = useAlGuardar();
  return useMutation({
    mutationFn: (datos: { nombre: string; descripcion: string | null }) => crearPlantilla(datos),
    onSuccess: alGuardar,
  });
}

export function useEditarPlantilla(id: string) {
  const alGuardar = useAlGuardar();
  return useMutation({
    mutationFn: (datos: DatosPlantilla) => editarPlantilla(id, datos),
    onSuccess: alGuardar,
  });
}

export function useAgregarProductos(id: string) {
  const alGuardar = useAlGuardar();
  return useMutation({
    mutationFn: (codes: string[]) => agregarProductos(id, codes),
    onSuccess: alGuardar,
  });
}

export function useQuitarProductos(id: string) {
  const alGuardar = useAlGuardar();
  return useMutation({
    mutationFn: (codes: string[]) => quitarProductos(id, codes),
    onSuccess: alGuardar,
  });
}

export function useAsignarRuta(id: string) {
  const clienteConsultas = useQueryClient();
  const alGuardar = useAlGuardar();
  return useMutation({
    mutationFn: (rutaId: string) => asignarARuta(id, rutaId),
    onSuccess: (respuesta) => {
      alGuardar(respuesta);
      // La plantilla que la ruta dejó también cambió: su detalle ya no la lista.
      void clienteConsultas.invalidateQueries({ queryKey: ['plantillas', 'detalle'] });
    },
  });
}

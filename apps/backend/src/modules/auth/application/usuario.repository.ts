import { RolApp } from '@prisma/client';

/** Vista minima de usuario para la pantalla de seleccion (RF-01). */
export interface UsuarioParaSeleccion {
  id: string;
  nombreCompleto: string;
  rolApp: RolApp;
}

/** Datos completos que necesita el caso de uso de login. */
export interface UsuarioAutenticable {
  id: string;
  nombreCompleto: string;
  rolApp: RolApp;
  usuarioHandyId: number | null;
  pinHash: string;
  debeCambiarPin: boolean;
  activo: boolean;
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
}

export interface ActualizacionAcceso {
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
}

/**
 * Puerto: que se necesita de la persistencia, no como se hace.
 * El adaptador Prisma vive en infrastructure/.
 */
export abstract class UsuarioRepository {
  abstract listarActivosParaSeleccion(): Promise<UsuarioParaSeleccion[]>;
  abstract buscarPorId(id: string): Promise<UsuarioAutenticable | null>;
  abstract actualizarEstadoAcceso(
    id: string,
    datos: ActualizacionAcceso,
  ): Promise<void>;
  abstract actualizarPin(id: string, pinHash: string): Promise<void>;
}

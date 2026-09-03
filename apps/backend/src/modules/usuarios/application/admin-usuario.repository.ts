import { RolApp } from '@prisma/client';

/**
 * Vista de un usuario para el panel de administracion (RF-05 .. RF-11).
 * NUNCA incluye `pinHash`: el adaptador hace un select explicito.
 */
export interface UsuarioAdmin {
  id: string;
  nombreCompleto: string;
  rolApp: RolApp;
  // El contrato de la capa de aplicacion maneja el id de Handy como numero;
  // la conversion desde/hacia el texto de la BD es cosa de la infraestructura.
  usuarioHandyId: number | null;
  activo: boolean;
  debeCambiarPin: boolean;
  fechaUltimoCambioPin: Date | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

/**
 * Datos para dar de alta un usuario (RF-07). El PIN temporal se genera y hashea
 * en el caso de uso; aqui solo llega su hash.
 */
export interface DatosCrearUsuario {
  nombreCompleto: string;
  rolApp: RolApp;
  usuarioHandyId: number | null;
  pinHash: string;
}

/**
 * Campos editables de un usuario. Todos opcionales: un PATCH toca solo lo que
 * viene en el body. `usuarioHandyId` distingue "no tocar" (ausente) de "quitar
 * el vinculo" (null).
 */
export interface DatosActualizarUsuario {
  nombreCompleto?: string;
  rolApp?: RolApp;
  usuarioHandyId?: number | null;
  activo?: boolean;
  debeCambiarPin?: boolean;
  pinHash?: string;
}

/** Traza de un restablecimiento de PIN (RF-10). */
export interface RegistroRestablecimientoPin {
  usuarioAppId: string;
  restablecidoPor: string;
}

/**
 * Puerto: que se necesita de la persistencia para administrar usuarios, no como
 * se hace. El adaptador Prisma vive en infrastructure/.
 */
export abstract class AdminUsuarioRepository {
  /** Lista completa, INCLUIDOS los inactivos (RF-11 preserva la trazabilidad). */
  abstract listarTodos(): Promise<UsuarioAdmin[]>;
  abstract crear(datos: DatosCrearUsuario): Promise<UsuarioAdmin>;
  abstract actualizar(
    id: string,
    datos: DatosActualizarUsuario,
  ): Promise<UsuarioAdmin>;
  abstract buscarPorId(id: string): Promise<UsuarioAdmin | null>;
  abstract registrarRestablecimientoPin(
    datos: RegistroRestablecimientoPin,
  ): Promise<void>;
}

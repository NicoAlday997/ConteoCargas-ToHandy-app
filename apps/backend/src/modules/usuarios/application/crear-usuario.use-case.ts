import { RolApp } from '@prisma/client';

import { HasherPort } from '../../auth/application/hasher.port';
import { generarPinTemporal } from '../domain/generar-pin-temporal';
import {
  AdminUsuarioRepository,
  type UsuarioAdmin,
} from './admin-usuario.repository';

/** Datos de alta que llegan del controlador (RF-07). */
export interface EntradaCrearUsuario {
  nombreCompleto: string;
  rolApp: RolApp;
  usuarioHandyId: number | null;
}

/**
 * Resultado del alta como union discriminada por `exito`.
 * En caso de exito se devuelve el usuario creado MAS el PIN temporal EN CLARO:
 * es la unica vez que existe sin hashear y el admin debe comunicarselo al
 * usuario (RF-07 / RF-09).
 */
export type ResultadoCrearUsuario =
  | { exito: true; usuario: UsuarioAdmin; pinTemporal: string }
  | {
      exito: false;
      motivo: 'VENDEDOR_REQUIERE_HANDY' | 'NO_VENDEDOR_CON_HANDY';
    };

/**
 * Caso de uso de alta de usuario (RF-06 sin auto-registro, RF-07 alta por
 * admin). Capa de aplicacion: solo depende del dominio y de los puertos, nunca
 * de infraestructura (Prisma, HTTP, argon2, NestJS).
 */
export class CrearUsuarioUseCase {
  constructor(
    private readonly usuarios: AdminUsuarioRepository,
    private readonly hasher: HasherPort,
  ) {}

  async ejecutar(entrada: EntradaCrearUsuario): Promise<ResultadoCrearUsuario> {
    const esVendedor = entrada.rolApp === RolApp.VENDEDOR;

    // Solo el rol Vendedor esta vinculado a un usuario de Handy (RF-05 / RF-07):
    // un vendedor SIEMPRE lo trae, y cualquier otro rol NUNCA.
    if (esVendedor && entrada.usuarioHandyId === null) {
      return { exito: false, motivo: 'VENDEDOR_REQUIERE_HANDY' };
    }
    if (!esVendedor && entrada.usuarioHandyId !== null) {
      return { exito: false, motivo: 'NO_VENDEDOR_CON_HANDY' };
    }

    // PIN temporal: se genera, se hashea y solo el hash llega a la persistencia.
    const pinTemporal = generarPinTemporal();
    const pinHash = await this.hasher.hash(pinTemporal);

    const usuario = await this.usuarios.crear({
      nombreCompleto: entrada.nombreCompleto,
      rolApp: entrada.rolApp,
      usuarioHandyId: esVendedor ? entrada.usuarioHandyId : null,
      pinHash,
    });
    // `crear` deja el usuario con `debeCambiarPin = true` (RF-08) y `activo = true`.

    return { exito: true, usuario, pinTemporal };
  }
}

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  AdminUsuarioRepository,
  type DatosActualizarUsuario,
  type DatosCrearUsuario,
  type RegistroRestablecimientoPin,
  type UsuarioAdmin,
} from '../application/admin-usuario.repository';

/**
 * Adaptador de infraestructura del repositorio de administracion de usuarios.
 * Aqui SI se conoce Prisma y el esquema; la capa de aplicacion solo ve el
 * puerto `AdminUsuarioRepository`.
 */
@Injectable()
export class PrismaAdminUsuarioRepository extends AdminUsuarioRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Select EXPLICITO compartido por todas las lecturas: `pinHash` (y cualquier
   * otro campo sensible) NUNCA sale de este adaptador.
   */
  private static readonly SELECT = {
    id: true,
    nombreCompleto: true,
    rolApp: true,
    usuarioHandyId: true,
    activo: true,
    debeCambiarPin: true,
    fechaUltimoCambioPin: true,
    creadoEn: true,
    actualizadoEn: true,
  } satisfies Prisma.UsuarioAppSelect;

  async listarTodos(): Promise<UsuarioAdmin[]> {
    const registros = await this.prisma.usuarioApp.findMany({
      // Sin filtro por `activo`: el panel de administracion tambien lista a los
      // usuarios dados de baja (RF-11), para no perder su trazabilidad.
      select: PrismaAdminUsuarioRepository.SELECT,
      orderBy: [{ activo: 'desc' }, { nombreCompleto: 'asc' }],
    });
    return registros.map((r) => this.aDominio(r));
  }

  async crear(datos: DatosCrearUsuario): Promise<UsuarioAdmin> {
    const registro = await this.prisma.usuarioApp.create({
      data: {
        nombreCompleto: datos.nombreCompleto,
        rolApp: datos.rolApp,
        usuarioHandyId: datos.usuarioHandyId,
        pinHash: datos.pinHash,
        // Alta (RF-07 / RF-08): PIN temporal, se exige cambiarlo en el primer
        // login y el usuario nace activo.
        debeCambiarPin: true,
        activo: true,
      },
      select: PrismaAdminUsuarioRepository.SELECT,
    });
    return this.aDominio(registro);
  }

  async actualizar(
    id: string,
    datos: DatosActualizarUsuario,
  ): Promise<UsuarioAdmin> {
    const registro = await this.prisma.usuarioApp.update({
      where: { id },
      data: {
        // `undefined` = Prisma no toca el campo; asi un PATCH parcial solo
        // modifica lo que realmente vino en el body.
        nombreCompleto: datos.nombreCompleto,
        rolApp: datos.rolApp,
        usuarioHandyId: datos.usuarioHandyId,
        activo: datos.activo,
        debeCambiarPin: datos.debeCambiarPin,
        pinHash: datos.pinHash,
      },
      select: PrismaAdminUsuarioRepository.SELECT,
    });
    return this.aDominio(registro);
  }

  async buscarPorId(id: string): Promise<UsuarioAdmin | null> {
    const registro = await this.prisma.usuarioApp.findUnique({
      where: { id },
      select: PrismaAdminUsuarioRepository.SELECT,
    });
    return registro === null ? null : this.aDominio(registro);
  }

  async registrarRestablecimientoPin(
    datos: RegistroRestablecimientoPin,
  ): Promise<void> {
    await this.prisma.historialRestablecimientoPin.create({
      data: {
        usuarioAppId: datos.usuarioAppId,
        restablecidoPor: datos.restablecidoPor,
      },
    });
  }

  private aDominio(registro: {
    id: string;
    nombreCompleto: string;
    rolApp: UsuarioAdmin['rolApp'];
    usuarioHandyId: number | null;
    activo: boolean;
    debeCambiarPin: boolean;
    fechaUltimoCambioPin: Date | null;
    creadoEn: Date;
    actualizadoEn: Date;
  }): UsuarioAdmin {
    return { ...registro };
  }
}

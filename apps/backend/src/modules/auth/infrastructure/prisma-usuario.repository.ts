import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  ActualizacionAcceso,
  UsuarioAutenticable,
  UsuarioParaSeleccion,
  UsuarioRepository,
} from '../application/usuario.repository';
import { conFotoDeHandy } from './foto-usuario';

/**
 * Adaptador de infraestructura del repositorio de usuarios.
 * Aqui SI se conoce Prisma y el esquema de la base; la capa de aplicacion solo
 * ve el puerto `UsuarioRepository`.
 */
@Injectable()
export class PrismaUsuarioRepository extends UsuarioRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listarActivosParaSeleccion(): Promise<UsuarioParaSeleccion[]> {
    const registros = await this.prisma.usuarioApp.findMany({
      where: { activo: true },
      // Select EXPLICITO: este listado alimenta la pantalla publica de login
      // (RF-01). pinHash y cualquier otro campo sensible NUNCA deben salir de
      // aqui, por eso no se usa el select por defecto de Prisma.
      select: {
        id: true,
        nombreCompleto: true,
        rolApp: true,
        usuarioHandy: { select: { fotoUrl: true } },
      },
      orderBy: { nombreCompleto: 'asc' },
    });
    return registros.map(conFotoDeHandy);
  }

  async buscarPorId(id: string): Promise<UsuarioAutenticable | null> {
    const registro = await this.prisma.usuarioApp.findUnique({
      where: { id },
      select: {
        id: true,
        nombreCompleto: true,
        rolApp: true,
        usuarioHandyId: true,
        pinHash: true,
        debeCambiarPin: true,
        activo: true,
        intentosFallidos: true,
        bloqueadoHasta: true,
        usuarioHandy: { select: { fotoUrl: true } },
      },
    });

    if (registro === null) {
      return null;
    }

    const usuario = conFotoDeHandy(registro);
    return {
      ...usuario,
      // En la BD el id de Handy se guarda como texto (FK a usuarios_handy.idHandy);
      // el contrato de la capa de aplicacion lo maneja como numero. La conversion
      // es responsabilidad de la infraestructura.
      usuarioHandyId:
        usuario.usuarioHandyId === null ? null : Number(usuario.usuarioHandyId),
    };
  }

  async actualizarEstadoAcceso(
    id: string,
    datos: ActualizacionAcceso,
  ): Promise<void> {
    await this.prisma.usuarioApp.update({
      where: { id },
      data: {
        intentosFallidos: datos.intentosFallidos,
        bloqueadoHasta: datos.bloqueadoHasta,
      },
    });
  }

  async actualizarPin(id: string, pinHash: string): Promise<void> {
    await this.prisma.usuarioApp.update({
      where: { id },
      data: {
        pinHash,
        // Tras un cambio de PIN exitoso ya no se exige cambiarlo y se registra
        // la fecha del cambio.
        debeCambiarPin: false,
        fechaUltimoCambioPin: new Date(),
      },
    });
  }
}

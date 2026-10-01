import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolApp } from '@prisma/client';

import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import { Roles } from '../../../shared/auth/roles.decorator';
import { RolesGuard } from '../../../shared/auth/roles.guard';
import { CuentaHandyRepository } from '../application/cuenta-handy.repository';

/**
 * Cuentas de vendedor sincronizadas desde Handy, para elegir con cual se
 * vincula un vendedor nuevo (RF-07). Solo Supervisor. Cada cuenta dice si ya
 * la ocupa un usuario activo: la app no ofrece esas.
 */
@Controller('admin/usuarios-handy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolApp.SUPERVISOR)
export class UsuariosHandyController {
  constructor(private readonly cuentas: CuentaHandyRepository) {}

  @Get()
  async listar() {
    return this.cuentas.listar();
  }
}

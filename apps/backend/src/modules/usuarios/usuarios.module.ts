import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { HasherPort } from '../auth/application/hasher.port';
import { Argon2HasherAdapter } from '../auth/infrastructure/argon2-hasher.adapter';
import { AdminUsuarioRepository } from './application/admin-usuario.repository';
import { CuentaHandyRepository } from './application/cuenta-handy.repository';
import { CrearUsuarioUseCase } from './application/crear-usuario.use-case';
import { DesbloquearUsuarioUseCase } from './application/desbloquear-usuario.use-case';
import { EditarUsuarioUseCase } from './application/editar-usuario.use-case';
import { RestablecerPinUseCase } from './application/restablecer-pin.use-case';
import { PrismaAdminUsuarioRepository } from './infrastructure/prisma-admin-usuario.repository';
import { PrismaCuentaHandyRepository } from './infrastructure/prisma-cuenta-handy.repository';
import { UsuariosHandyController } from './interface/usuarios-handy.controller';
import { UsuariosController } from './interface/usuarios.controller';

@Module({
  // AuthSharedModule ya es @Global (aporta la JwtStrategy); se importa de forma
  // explicita para dejar clara la dependencia de `JwtAuthGuard` / `RolesGuard`.
  imports: [AuthSharedModule],
  controllers: [UsuariosController, UsuariosHandyController],
  providers: [
    // Binding de puertos a adaptadores de infraestructura. El puerto de hasheo
    // se reutiliza del modulo auth (mismo argon2id).
    { provide: AdminUsuarioRepository, useClass: PrismaAdminUsuarioRepository },
    { provide: CuentaHandyRepository, useClass: PrismaCuentaHandyRepository },
    { provide: HasherPort, useClass: Argon2HasherAdapter },
    // Los casos de uso son clases planas (sin @Injectable): se construyen a mano
    // inyectando los puertos ya resueltos.
    {
      provide: CrearUsuarioUseCase,
      useFactory: (usuarios: AdminUsuarioRepository, hasher: HasherPort) =>
        new CrearUsuarioUseCase(usuarios, hasher),
      inject: [AdminUsuarioRepository, HasherPort],
    },
    {
      provide: RestablecerPinUseCase,
      useFactory: (usuarios: AdminUsuarioRepository, hasher: HasherPort) =>
        new RestablecerPinUseCase(usuarios, hasher),
      inject: [AdminUsuarioRepository, HasherPort],
    },
    {
      provide: EditarUsuarioUseCase,
      useFactory: (usuarios: AdminUsuarioRepository) =>
        new EditarUsuarioUseCase(usuarios),
      inject: [AdminUsuarioRepository],
    },
    {
      provide: DesbloquearUsuarioUseCase,
      useFactory: (usuarios: AdminUsuarioRepository) =>
        new DesbloquearUsuarioUseCase(usuarios),
      inject: [AdminUsuarioRepository],
    },
  ],
})
export class UsuariosModule {}

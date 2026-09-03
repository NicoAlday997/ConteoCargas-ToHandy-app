import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { HasherPort } from '../auth/application/hasher.port';
import { Argon2HasherAdapter } from '../auth/infrastructure/argon2-hasher.adapter';
import { AdminUsuarioRepository } from './application/admin-usuario.repository';
import { CrearUsuarioUseCase } from './application/crear-usuario.use-case';
import { DesactivarUsuarioUseCase } from './application/desactivar-usuario.use-case';
import { RestablecerPinUseCase } from './application/restablecer-pin.use-case';
import { PrismaAdminUsuarioRepository } from './infrastructure/prisma-admin-usuario.repository';
import { UsuariosController } from './interface/usuarios.controller';

@Module({
  // AuthSharedModule ya es @Global (aporta la JwtStrategy); se importa de forma
  // explicita para dejar clara la dependencia de `JwtAuthGuard` / `RolesGuard`.
  imports: [AuthSharedModule],
  controllers: [UsuariosController],
  providers: [
    // Binding de puertos a adaptadores de infraestructura. El puerto de hasheo
    // se reutiliza del modulo auth (mismo argon2id).
    { provide: AdminUsuarioRepository, useClass: PrismaAdminUsuarioRepository },
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
      provide: DesactivarUsuarioUseCase,
      useFactory: (usuarios: AdminUsuarioRepository) =>
        new DesactivarUsuarioUseCase(usuarios),
      inject: [AdminUsuarioRepository],
    },
  ],
})
export class UsuariosModule {}

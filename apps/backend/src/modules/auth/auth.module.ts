import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { CambiarPinUseCase } from './application/cambiar-pin.use-case';
import { HasherPort } from './application/hasher.port';
import { LoginUseCase } from './application/login.use-case';
import { UsuarioRepository } from './application/usuario.repository';
import { Argon2HasherAdapter } from './infrastructure/argon2-hasher.adapter';
import { PrismaUsuarioRepository } from './infrastructure/prisma-usuario.repository';
import { AuthController } from './interface/auth.controller';

@Module({
  // AuthSharedModule aporta JwtModule (JwtService para firmar el login) y la
  // JwtStrategy que protege `cambiar-pin` y el resto de endpoints.
  imports: [AuthSharedModule],
  controllers: [AuthController],
  providers: [
    // Binding de puertos a adaptadores de infraestructura.
    { provide: UsuarioRepository, useClass: PrismaUsuarioRepository },
    { provide: HasherPort, useClass: Argon2HasherAdapter },
    // Los casos de uso son clases planas (sin @Injectable): se construyen a
    // mano inyectando los puertos ya resueltos.
    {
      provide: LoginUseCase,
      useFactory: (usuarios: UsuarioRepository, hasher: HasherPort) =>
        new LoginUseCase(usuarios, hasher),
      inject: [UsuarioRepository, HasherPort],
    },
    {
      provide: CambiarPinUseCase,
      useFactory: (usuarios: UsuarioRepository, hasher: HasherPort) =>
        new CambiarPinUseCase(usuarios, hasher),
      inject: [UsuarioRepository, HasherPort],
    },
  ],
  // La confirmacion cruzada de discrepancias (modulo de cargas) verifica el PIN
  // con este mismo caso de uso: una sola politica de intentos y bloqueo.
  exports: [LoginUseCase],
})
export class AuthModule {}

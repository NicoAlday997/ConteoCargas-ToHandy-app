import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { CambiarPinUseCase } from './application/cambiar-pin.use-case';
import { HasherPort } from './application/hasher.port';
import { LoginUseCase } from './application/login.use-case';
import { UsuarioRepository } from './application/usuario.repository';
import { Argon2HasherAdapter } from './infrastructure/argon2-hasher.adapter';
import { PrismaUsuarioRepository } from './infrastructure/prisma-usuario.repository';
import { AuthController } from './interface/auth.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // 8h = una jornada laboral: el token cubre el turno completo sin
        // obligar a reautenticar a media carga.
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
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
})
export class AuthModule {}

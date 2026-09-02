import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { JwtStrategy } from './jwt.strategy';

/**
 * Infraestructura de autenticacion compartida por todos los modulos:
 * Passport, firma/verificacion de JWT y la `JwtStrategy` que puebla
 * `request.user`. Es `@Global` para que cualquier feature module pueda usar
 * `JwtAuthGuard` / `RolesGuard` sin volver a importar nada.
 *
 * El `JWT_SECRET` vive solo como variable de entorno del servidor.
 */
@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
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
  providers: [JwtStrategy],
  exports: [PassportModule, JwtModule],
})
export class AuthSharedModule {}

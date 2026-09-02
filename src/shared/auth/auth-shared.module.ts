import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { JwtStrategy } from './jwt.strategy';

/**
 * Infraestructura de autenticacion compartida por todos los modulos: verifica
 * y firma el JWT y registra la estrategia de passport. Cualquier modulo con
 * endpoints protegidos importa este modulo para disponer de `JwtAuthGuard`,
 * `RolesGuard` y `JwtService`.
 */
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

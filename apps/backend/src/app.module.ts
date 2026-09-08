import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { CargasModule } from './modules/cargas/cargas.module';
import { SincronizacionModule } from './modules/sincronizacion/sincronizacion.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AuthSharedModule } from './shared/auth/auth-shared.module';
import { PrismaModule } from './shared/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    // Global: registra la JwtStrategy y deja Passport/JWT disponibles para el
    // JwtAuthGuard y el RolesGuard de cualquier modulo.
    AuthSharedModule,
    AuthModule,
    UsuariosModule,
    SincronizacionModule,
    CargasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

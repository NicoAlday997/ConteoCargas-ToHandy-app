import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { CargasModule } from './modules/cargas/cargas.module';
import { CatalogoModule } from './modules/catalogo/catalogo.module';
import { HistorialModule } from './modules/historial/historial.module';
import { PlantillasModule } from './modules/plantillas/plantillas.module';
import { SaludModule } from './modules/salud/salud.module';
import { SincronizacionModule } from './modules/sincronizacion/sincronizacion.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AuthSharedModule } from './shared/auth/auth-shared.module';
import {
  LimitePeticionesGuard,
  opcionesLimitesPeticiones,
} from './shared/limites/limites-peticiones';
import { PrismaModule } from './shared/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Trabajos programados (la sincronizacion diaria con Handy a las 5:00).
    ScheduleModule.forRoot(),
    // Limites de peticiones: global por IP y, en endpoints con PIN, por usuario
    // mas un techo por IP (ver shared/limites).
    ThrottlerModule.forRoot(opcionesLimitesPeticiones()),
    PrismaModule,
    // Global: registra la JwtStrategy y deja Passport/JWT disponibles para el
    // JwtAuthGuard y el RolesGuard de cualquier modulo.
    AuthSharedModule,
    AuthModule,
    UsuariosModule,
    SincronizacionModule,
    CargasModule,
    HistorialModule,
    PlantillasModule,
    CatalogoModule,
    SaludModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global: corre antes que los guards de JWT/rol de cada controlador.
    { provide: APP_GUARD, useClass: LimitePeticionesGuard },
  ],
})
export class AppModule {}

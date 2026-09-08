import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { HandyGateway } from '../sincronizacion/application/handy.gateway';
import { SincronizacionModule } from '../sincronizacion/sincronizacion.module';
import { AsignacionRepository } from './application/asignacion.repository';
import { CapturarCantidadFinalUseCase } from './application/capturar-cantidad-final.use-case';
import { CargaRepository } from './application/carga.repository';
import { ConfirmarCantidadFinalUseCase } from './application/confirmar-cantidad-final.use-case';
import { EnviarCargaUseCase } from './application/enviar-carga.use-case';
import { FinalizarSesionUseCase } from './application/finalizar-sesion.use-case';
import { IniciarCargaUseCase } from './application/iniciar-carga.use-case';
import { PrismaAsignacionRepository } from './infrastructure/prisma-asignacion.repository';
import { PrismaCargaRepository } from './infrastructure/prisma-carga.repository';
import { CargasController } from './interface/cargas.controller';

@Module({
  imports: [
    // AuthSharedModule ya es @Global (aporta la JwtStrategy); se importa de forma
    // explicita para dejar clara la dependencia de `JwtAuthGuard` / `RolesGuard`.
    AuthSharedModule,
    // Aporta `HandyGateway` (lo exporta): `EnviarCargaUseCase` habla con Handy a
    // traves de ese puerto, sin re-implementar el adaptador HTTP.
    SincronizacionModule,
  ],
  controllers: [CargasController],
  providers: [
    // Binding de puertos a adaptadores de infraestructura. El dominio y la
    // aplicacion solo conocen los puertos abstractos.
    { provide: CargaRepository, useClass: PrismaCargaRepository },
    { provide: AsignacionRepository, useClass: PrismaAsignacionRepository },
    // Los casos de uso son clases planas (sin @Injectable): se construyen a mano
    // inyectando los puertos ya resueltos.
    {
      provide: IniciarCargaUseCase,
      useFactory: (
        cargas: CargaRepository,
        asignaciones: AsignacionRepository,
      ) => new IniciarCargaUseCase(cargas, asignaciones),
      inject: [CargaRepository, AsignacionRepository],
    },
    {
      provide: FinalizarSesionUseCase,
      useFactory: (cargas: CargaRepository) =>
        new FinalizarSesionUseCase(cargas),
      inject: [CargaRepository],
    },
    {
      provide: CapturarCantidadFinalUseCase,
      useFactory: (cargas: CargaRepository) =>
        new CapturarCantidadFinalUseCase(cargas),
      inject: [CargaRepository],
    },
    {
      provide: ConfirmarCantidadFinalUseCase,
      useFactory: (cargas: CargaRepository) =>
        new ConfirmarCantidadFinalUseCase(cargas),
      inject: [CargaRepository],
    },
    {
      provide: EnviarCargaUseCase,
      useFactory: (cargas: CargaRepository, handy: HandyGateway) =>
        new EnviarCargaUseCase(cargas, handy),
      inject: [CargaRepository, HandyGateway],
    },
  ],
})
export class CargasModule {}

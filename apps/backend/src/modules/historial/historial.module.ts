import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { ConsultarHistorialUseCase } from './application/consultar-historial.use-case';
import { HistorialRepository } from './application/historial.repository';
import { VerCargaConsolidadaUseCase } from './application/ver-carga-consolidada.use-case';
import { PrismaHistorialRepository } from './infrastructure/prisma-historial.repository';
import { HistorialController } from './interface/historial.controller';

@Module({
  imports: [
    // AuthSharedModule ya es @Global (aporta la JwtStrategy); se importa de
    // forma explicita para dejar clara la dependencia de `JwtAuthGuard` /
    // `RolesGuard` (mismo criterio que `CargasModule`).
    AuthSharedModule,
  ],
  controllers: [HistorialController],
  providers: [
    // Binding del puerto al adaptador de infraestructura. La aplicacion solo
    // conoce el puerto abstracto.
    { provide: HistorialRepository, useClass: PrismaHistorialRepository },
    // Los casos de uso son clases planas (sin @Injectable): se construyen a
    // mano inyectando el puerto ya resuelto.
    {
      provide: ConsultarHistorialUseCase,
      useFactory: (historial: HistorialRepository) =>
        new ConsultarHistorialUseCase(historial),
      inject: [HistorialRepository],
    },
    {
      provide: VerCargaConsolidadaUseCase,
      useFactory: (historial: HistorialRepository) =>
        new VerCargaConsolidadaUseCase(historial),
      inject: [HistorialRepository],
    },
  ],
})
export class HistorialModule {}

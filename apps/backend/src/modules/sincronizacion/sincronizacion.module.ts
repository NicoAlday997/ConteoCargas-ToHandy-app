import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { CatalogoRepository } from './application/catalogo.repository';
import { HandyGateway } from './application/handy.gateway';
import { SincronizarCatalogoUseCase } from './application/sincronizar-catalogo.use-case';
import { SincronizarVendedoresUseCase } from './application/sincronizar-vendedores.use-case';
import { HandyHttpGateway } from './infrastructure/handy-http.gateway';
import { PrismaCatalogoRepository } from './infrastructure/prisma-catalogo.repository';
import { SincronizacionController } from './interface/sincronizacion.controller';

@Module({
  // AuthSharedModule ya es @Global (aporta la JwtStrategy); se importa de forma
  // explicita para dejar clara la dependencia de `JwtAuthGuard` / `RolesGuard`.
  imports: [AuthSharedModule],
  controllers: [SincronizacionController],
  providers: [
    // Binding de puertos a adaptadores de infraestructura. El dominio y la
    // aplicacion solo conocen los puertos abstractos.
    { provide: HandyGateway, useClass: HandyHttpGateway },
    { provide: CatalogoRepository, useClass: PrismaCatalogoRepository },
    // Los casos de uso son clases planas (sin @Injectable): se construyen a mano
    // inyectando los puertos ya resueltos.
    {
      provide: SincronizarCatalogoUseCase,
      useFactory: (handy: HandyGateway, catalogo: CatalogoRepository) =>
        new SincronizarCatalogoUseCase(handy, catalogo),
      inject: [HandyGateway, CatalogoRepository],
    },
    {
      provide: SincronizarVendedoresUseCase,
      useFactory: (handy: HandyGateway, catalogo: CatalogoRepository) =>
        new SincronizarVendedoresUseCase(handy, catalogo),
      inject: [HandyGateway, CatalogoRepository],
    },
  ],
  // `HandyGateway` se reexporta para que otros modulos (p. ej. `CargasModule`,
  // en `EnviarCargaUseCase`) reutilicen el mismo adaptador HTTP hacia Handy.
  exports: [HandyGateway],
})
export class SincronizacionModule {}

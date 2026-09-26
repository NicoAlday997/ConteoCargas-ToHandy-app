import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { AuthModule } from '../auth/auth.module';
import { LoginUseCase } from '../auth/application/login.use-case';
import { HandyGateway } from '../sincronizacion/application/handy.gateway';
import { SincronizacionModule } from '../sincronizacion/sincronizacion.module';
import { AbrirSesionUseCase } from './application/abrir-sesion.use-case';
import { AsignacionRepository } from './application/asignacion.repository';
import { AutorizarCargaUseCase } from './application/autorizar-carga.use-case';
import { CancelarCargaUseCase } from './application/cancelar-carga.use-case';
import { CancelarRutaHandyUseCase } from './application/cancelar-ruta-handy.use-case';
import { CapturarCantidadFinalUseCase } from './application/capturar-cantidad-final.use-case';
import { CargaRepository } from './application/carga.repository';
import { ConfirmarCantidadFinalUseCase } from './application/confirmar-cantidad-final.use-case';
import { ConsultasCargaRepository } from './application/consultas-carga.repository';
import { DesbloquearCargaUseCase } from './application/desbloquear-carga.use-case';
import { EnviarCargaUseCase } from './application/enviar-carga.use-case';
import { FinalizarSesionUseCase } from './application/finalizar-sesion.use-case';
import { GuardarItemsUseCase } from './application/guardar-items.use-case';
import { IniciarCargaUseCase } from './application/iniciar-carga.use-case';
import { ListarItemsDeSesionUseCase } from './application/listar-items-de-sesion.use-case';
import { ListarPendientesVerificacionUseCase } from './application/listar-pendientes-verificacion.use-case';
import { ListarProductosDePlantillaUseCase } from './application/listar-productos-de-plantilla.use-case';
import { ModificarCantidadSupervisorUseCase } from './application/modificar-cantidad-supervisor.use-case';
import { ProductoConteoRepository } from './application/producto-conteo.repository';
import { RechazarProductosUseCase } from './application/rechazar-productos.use-case';
import { VerificadorPin } from './application/verificador-pin.port';
import { VerificarCortePendienteUseCase } from './application/verificar-corte-pendiente.use-case';
import { LoginVerificadorPinAdapter } from './infrastructure/login-verificador-pin.adapter';
import { PrismaAsignacionRepository } from './infrastructure/prisma-asignacion.repository';
import { PrismaCargaRepository } from './infrastructure/prisma-carga.repository';
import { PrismaConsultasCargaRepository } from './infrastructure/prisma-consultas-carga.repository';
import { PrismaProductoConteoRepository } from './infrastructure/prisma-producto-conteo.repository';
import { CargasController } from './interface/cargas.controller';

@Module({
  imports: [
    // AuthSharedModule ya es @Global (aporta la JwtStrategy); se importa de forma
    // explicita para dejar clara la dependencia de `JwtAuthGuard` / `RolesGuard`.
    AuthSharedModule,
    // Aporta `HandyGateway` (lo exporta): `EnviarCargaUseCase` habla con Handy a
    // traves de ese puerto, sin re-implementar el adaptador HTTP.
    SincronizacionModule,
    // Aporta `LoginUseCase` (lo exporta): la confirmacion cruzada verifica el
    // PIN con la misma politica de intentos y bloqueo que el login.
    AuthModule,
  ],
  controllers: [CargasController],
  providers: [
    // Binding de puertos a adaptadores de infraestructura. El dominio y la
    // aplicacion solo conocen los puertos abstractos.
    { provide: CargaRepository, useClass: PrismaCargaRepository },
    { provide: AsignacionRepository, useClass: PrismaAsignacionRepository },
    {
      provide: ConsultasCargaRepository,
      useClass: PrismaConsultasCargaRepository,
    },
    {
      provide: VerificadorPin,
      useFactory: (login: LoginUseCase) =>
        new LoginVerificadorPinAdapter(login),
      inject: [LoginUseCase],
    },
    {
      provide: ProductoConteoRepository,
      useClass: PrismaProductoConteoRepository,
    },
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
      provide: AbrirSesionUseCase,
      useFactory: (
        cargas: CargaRepository,
        verificarCorte: VerificarCortePendienteUseCase,
      ) => new AbrirSesionUseCase(cargas, verificarCorte),
      inject: [CargaRepository, VerificarCortePendienteUseCase],
    },
    {
      provide: GuardarItemsUseCase,
      useFactory: (
        cargas: CargaRepository,
        productos: ProductoConteoRepository,
      ) => new GuardarItemsUseCase(cargas, productos),
      inject: [CargaRepository, ProductoConteoRepository],
    },
    {
      provide: ListarItemsDeSesionUseCase,
      useFactory: (cargas: CargaRepository) =>
        new ListarItemsDeSesionUseCase(cargas),
      inject: [CargaRepository],
    },
    {
      provide: ListarProductosDePlantillaUseCase,
      useFactory: (
        cargas: CargaRepository,
        productos: ProductoConteoRepository,
      ) => new ListarProductosDePlantillaUseCase(cargas, productos),
      inject: [CargaRepository, ProductoConteoRepository],
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
      useFactory: (cargas: CargaRepository, verificadorPin: VerificadorPin) =>
        new ConfirmarCantidadFinalUseCase(cargas, verificadorPin),
      inject: [CargaRepository, VerificadorPin],
    },
    {
      provide: ListarPendientesVerificacionUseCase,
      useFactory: (consultas: ConsultasCargaRepository) =>
        new ListarPendientesVerificacionUseCase(consultas),
      inject: [ConsultasCargaRepository],
    },
    {
      provide: EnviarCargaUseCase,
      useFactory: (cargas: CargaRepository, handy: HandyGateway) =>
        new EnviarCargaUseCase(cargas, handy),
      inject: [CargaRepository, HandyGateway],
    },
    {
      provide: AutorizarCargaUseCase,
      useFactory: (cargas: CargaRepository) =>
        new AutorizarCargaUseCase(cargas),
      inject: [CargaRepository],
    },
    {
      provide: RechazarProductosUseCase,
      useFactory: (cargas: CargaRepository) =>
        new RechazarProductosUseCase(cargas),
      inject: [CargaRepository],
    },
    {
      provide: ModificarCantidadSupervisorUseCase,
      useFactory: (cargas: CargaRepository) =>
        new ModificarCantidadSupervisorUseCase(cargas),
      inject: [CargaRepository],
    },
    {
      provide: VerificarCortePendienteUseCase,
      useFactory: (cargas: CargaRepository, handy: HandyGateway) =>
        new VerificarCortePendienteUseCase(cargas, handy),
      inject: [CargaRepository, HandyGateway],
    },
    {
      provide: CancelarCargaUseCase,
      useFactory: (cargas: CargaRepository) => new CancelarCargaUseCase(cargas),
      inject: [CargaRepository],
    },
    {
      provide: CancelarRutaHandyUseCase,
      useFactory: (cargas: CargaRepository, handy: HandyGateway) =>
        new CancelarRutaHandyUseCase(cargas, handy),
      inject: [CargaRepository, HandyGateway],
    },
    {
      provide: DesbloquearCargaUseCase,
      useFactory: (cargas: CargaRepository, handy: HandyGateway) =>
        new DesbloquearCargaUseCase(cargas, handy),
      inject: [CargaRepository, HandyGateway],
    },
  ],
})
export class CargasModule {}

import {
  BadGatewayException,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolApp } from '@prisma/client';

import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import { Roles } from '../../../shared/auth/roles.decorator';
import { RolesGuard } from '../../../shared/auth/roles.guard';
import {
  HandyErrorServidorError,
  HandyRespuestaNoOkError,
  HandyTokenInvalidoError,
} from '../infrastructure/handy-http.gateway';
import { SincronizarCatalogoUseCase } from '../application/sincronizar-catalogo.use-case';
import { SincronizarVendedoresUseCase } from '../application/sincronizar-vendedores.use-case';

/**
 * Sincronizacion manual del cache local contra Handy (docs/04-api-interna.md
 * §1.3). Toda la seccion es exclusiva del rol Supervisor: los guards se aplican
 * a nivel de clase, asi que ambos endpoints exigen JWT valido y rol SUPERVISOR.
 *
 * Los fallos de Handy se traducen a 502 Bad Gateway con un `mensaje` en español
 * apto para el usuario final; el texto crudo de Handy solo viaja en `detalle`,
 * para depuracion (docs/04 §1.7). El adaptador HTTP garantiza que ese texto
 * nunca contiene el token de integracion.
 */
@Controller('admin/sincronizacion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolApp.SUPERVISOR)
export class SincronizacionController {
  constructor(
    private readonly sincronizarCatalogoUseCase: SincronizarCatalogoUseCase,
    private readonly sincronizarVendedoresUseCase: SincronizarVendedoresUseCase,
  ) {}

  /** Fuerza una sincronizacion completa del catalogo de productos. */
  @Post('productos')
  @HttpCode(200)
  async sincronizarProductos() {
    try {
      return await this.sincronizarCatalogoUseCase.ejecutar();
    } catch (error) {
      throw this.traducirErrorHandy(error);
    }
  }

  /** Fuerza una sincronizacion completa de los usuarios vendedores de Handy. */
  @Post('usuarios-handy')
  @HttpCode(200)
  async sincronizarUsuariosHandy() {
    try {
      return await this.sincronizarVendedoresUseCase.ejecutar();
    } catch (error) {
      throw this.traducirErrorHandy(error);
    }
  }

  /**
   * Convierte los errores del `HandyGateway` en un 502 con cuerpo estandar
   * `{ statusCode, mensaje, detalle }`. El `mensaje` es generico y en español;
   * el `detalle` lleva el texto tecnico (sin token) solo para depuracion.
   * Cualquier otro error se relanza sin tocar para que lo gestione el filtro
   * global.
   */
  private traducirErrorHandy(error: unknown): unknown {
    if (error instanceof HandyTokenInvalidoError) {
      return new BadGatewayException({
        statusCode: 502,
        mensaje:
          'El token de integracion con Handy no es valido o expiro. Se requiere ' +
          'intervencion del administrador para regenerarlo.',
        detalle: error.message,
      });
    }

    if (error instanceof HandyErrorServidorError) {
      return new BadGatewayException({
        statusCode: 502,
        mensaje:
          'Handy no esta disponible en este momento. Vuelve a intentar la ' +
          'sincronizacion en unos minutos.',
        detalle: error.message,
      });
    }

    if (error instanceof HandyRespuestaNoOkError) {
      return new BadGatewayException({
        statusCode: 502,
        mensaje:
          'Handy respondio de forma inesperada y no se pudo completar la ' +
          'sincronizacion.',
        detalle: error.message,
      });
    }

    return error;
  }
}

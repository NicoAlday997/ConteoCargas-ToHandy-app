import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolApp } from '@prisma/client';

import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import type { UsuarioAutenticado } from '../../../shared/auth/jwt.strategy';
import { Roles } from '../../../shared/auth/roles.decorator';
import { RolesGuard } from '../../../shared/auth/roles.guard';
import { UsuarioActual } from '../../../shared/auth/usuario-actual.decorator';
import { ZodValidationPipe } from '../../auth/interface/zod-validation.pipe';
import {
  HandyErrorServidorError,
  HandyRespuestaNoOkError,
  HandyTokenInvalidoError,
} from '../infrastructure/handy-http.gateway';
import { ConfirmarFactorEmpaqueUseCase } from '../application/confirmar-factor-empaque.use-case';
import { FactorEmpaqueRepository } from '../application/factor-empaque.repository';
import { SincronizarCatalogoUseCase } from '../application/sincronizar-catalogo.use-case';
import { SincronizarVendedoresUseCase } from '../application/sincronizar-vendedores.use-case';
import {
  CodeProductoSchema,
  ConfirmarFactorSchema,
  type ConfirmarFactorDto,
} from './sincronizacion.dto';

/**
 * Sincronizacion manual del cache local contra Handy (docs/04-api-interna.md
 * §1.3). Toda la seccion es exclusiva del rol Supervisor: los guards se aplican
 * a nivel de clase, asi que todos los endpoints exigen JWT valido y rol
 * SUPERVISOR. Incluye la revision del factor de empaque (piezas por paquete)
 * que la sincronizacion propone desde el nombre de cada producto.
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
    private readonly factorEmpaqueRepository: FactorEmpaqueRepository,
    private readonly confirmarFactorEmpaqueUseCase: ConfirmarFactorEmpaqueUseCase,
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
   * Productos activos cuyo factor de empaque aun no confirma un supervisor,
   * con el valor propuesto desde el nombre (`null` si hay que capturarlo).
   */
  @Get('factores-pendientes')
  async listarFactoresPendientes() {
    return this.factorEmpaqueRepository.listarPendientes();
  }

  /**
   * Confirma o corrige las piezas por paquete de un producto. Queda traza de
   * quien y cuando; `usuarioAppId` sale del JWT, nunca del body. Una vez
   * confirmado, la sincronizacion ya no modifica el factor.
   */
  @Patch('productos/:code/factor')
  @HttpCode(200)
  async confirmarFactor(
    @Param('code', new ZodValidationPipe(CodeProductoSchema)) code: string,
    @Body(new ZodValidationPipe(ConfirmarFactorSchema)) dto: ConfirmarFactorDto,
    @UsuarioActual() supervisor: UsuarioAutenticado,
  ) {
    const resultado = await this.confirmarFactorEmpaqueUseCase.ejecutar({
      productoCode: code,
      piezasPorPaquete: dto.piezasPorPaquete,
      usuarioAppId: supervisor.usuarioAppId,
      ahora: new Date(),
    });

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'FACTOR_INVALIDO':
          throw new BadRequestException({
            statusCode: 400,
            mensaje:
              'Las piezas por paquete deben ser un numero entero entre 1 y 500.',
          });
        case 'PRODUCTO_NO_ENCONTRADO':
          throw new NotFoundException({
            statusCode: 404,
            mensaje: 'Producto no encontrado',
          });
      }
    }

    // Convencion docs/04 §1.7: toda mutacion devuelve el recurso completo.
    return resultado.producto;
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

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
  HandySinRespuestaError,
  HandyTokenInvalidoError,
} from '../infrastructure/handy-http.gateway';
import { CatalogoRepository } from '../application/catalogo.repository';
import { ConfirmarFactorEmpaqueUseCase } from '../application/confirmar-factor-empaque.use-case';
import { FactorEmpaqueRepository } from '../application/factor-empaque.repository';
import { SincronizarConHandyUseCase } from '../application/sincronizar-con-handy.use-case';
import {
  CodeProductoSchema,
  ConfirmarFactorSchema,
  type ConfirmarFactorDto,
} from './sincronizacion.dto';

/**
 * Sincronizacion del cache local contra Handy (docs/04-api-interna.md §1.3);
 * la misma que corre sola cada dia a las 5:00 (`SincronizacionDiaria`). Toda la seccion es exclusiva del rol Supervisor: los guards se aplican
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
    private readonly sincronizarConHandyUseCase: SincronizarConHandyUseCase,
    private readonly catalogoRepository: CatalogoRepository,
    private readonly factorEmpaqueRepository: FactorEmpaqueRepository,
    private readonly confirmarFactorEmpaqueUseCase: ConfirmarFactorEmpaqueUseCase,
  ) {}

  /**
   * Sincronizacion completa con Handy: productos y luego vendedores. Es el
   * mismo caso de uso que corre solo a las 5:00. Responde que cambio (nuevos,
   * actualizados, desactivados) y cuantos productos quedaron sin empaque
   * confirmado. Si los productos pasan y los vendedores fallan, responde 200
   * con `vendedores: null` y `errorVendedores` con el motivo.
   */
  @Post()
  @HttpCode(200)
  async sincronizar() {
    let resultado;
    try {
      resultado = await this.sincronizarConHandyUseCase.ejecutar('MANUAL');
    } catch (error) {
      throw this.traducirErrorHandy(error);
    }
    const { productos, vendedores } = resultado;
    return {
      productos: {
        nuevos: productos.nuevos,
        actualizados: productos.actualizados,
        desactivados: productos.desactivados,
        sinConfirmarEmpaque: productos.sinConfirmarEmpaque,
      },
      vendedores: vendedores && {
        nuevos: vendedores.nuevos,
        actualizados: vendedores.actualizados,
        desactivados: vendedores.desactivados,
      },
      ...(vendedores === null && {
        errorVendedores: this.mensajeErrorHandy(resultado.errorVendedores),
      }),
      sincronizadoEn: resultado.sincronizadoEn,
    };
  }

  /**
   * Cuando fue la ultima sincronizacion y como quedo el cache. La ultima vez
   * es la marca mas reciente entre productos y vendedores (sin tabla propia).
   */
  @Get('estado')
  async estado() {
    const [resumen, sinConfirmarEmpaque] = await Promise.all([
      this.catalogoRepository.resumen(),
      this.factorEmpaqueRepository.contarPendientes(),
    ]);
    return { ...resumen, sinConfirmarEmpaque };
  }

  /**
   * Productos activos cuyo factor de empaque aun no confirma un supervisor,
   * con su modalidad de venta actual y el factor propuesto desde el nombre
   * (`null` si hay que capturarlo; solo aplica si se vende por pieza).
   */
  @Get('factores-pendientes')
  async listarFactoresPendientes() {
    return this.factorEmpaqueRepository.listarPendientes();
  }

  /**
   * Todos los productos activos con su empaque actual, confirmado o no, y
   * quien hizo la ultima confirmacion. Es la lista para corregir una
   * confirmacion equivocada.
   */
  @Get('factores')
  async listarFactores() {
    return this.factorEmpaqueRepository.listarTodos();
  }

  /**
   * Cuantas cargas aun no enviadas a Handy tienen conteos del producto. La
   * app lo consulta ANTES de guardar un cambio: esos conteos se calcularon
   * con el factor actual y no se recalculan.
   */
  @Get('productos/:code/factor/cargas-en-curso')
  async contarCargasEnCurso(
    @Param('code', new ZodValidationPipe(CodeProductoSchema)) code: string,
  ) {
    const producto = await this.factorEmpaqueRepository.buscarPorCode(code);
    if (producto === null) {
      throw new NotFoundException({
        statusCode: 404,
        mensaje: 'Producto no encontrado',
      });
    }
    return {
      cargasEnCurso:
        await this.factorEmpaqueRepository.contarCargasEnCursoConProducto(code),
    };
  }

  /**
   * Confirma o corrige como se vende un producto (`COMPLETO` o `POR_PIEZA`)
   * y, si es por pieza, cuantas piezas trae el paquete. Queda traza de
   * quien y cuando (y el cambio, con el valor anterior, en la bitacora);
   * `usuarioAppId` sale del JWT, nunca del body. Una vez confirmado, la
   * sincronizacion ya no modifica el factor. Tambien sirve para corregir un
   * factor ya confirmado.
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
      modalidadVenta: dto.modalidadVenta,
      piezasPorPaquete:
        dto.modalidadVenta === 'POR_PIEZA' ? dto.piezasPorPaquete : null,
      usuarioAppId: supervisor.usuarioAppId,
      ahora: new Date(),
    });

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'FACTOR_INVALIDO':
          throw new BadRequestException({
            statusCode: 400,
            mensaje:
              'Si el producto se vende por pieza, las piezas por paquete deben ser un numero entero entre 1 y 500.',
          });
        case 'PRODUCTO_NO_ENCONTRADO':
          throw new NotFoundException({
            statusCode: 404,
            mensaje: 'Producto no encontrado',
          });
      }
    }

    // Convencion docs/04 §1.7: toda mutacion devuelve el recurso completo.
    // `cargasEnCurso`: cargas no enviadas cuyos conteos quedaron con el valor
    // anterior (no se bloquea, pero el supervisor debe saberlo).
    return { ...resultado.producto, cargasEnCurso: resultado.cargasEnCurso };
  }

  /**
   * Convierte los errores del `HandyGateway` en un 502 con cuerpo estandar
   * `{ statusCode, codigo, mensaje, detalle }`. El `mensaje` es generico y en
   * español; el `detalle` lleva el texto tecnico (sin token) solo para
   * depuracion. `codigo` deja a la app distinguir el token invalido (no se
   * arregla reintentando) de Handy caido (si). Cualquier otro error se
   * relanza sin tocar para que lo gestione el filtro global.
   */
  private traducirErrorHandy(error: unknown): unknown {
    const falla = this.clasificarErrorHandy(error);
    if (falla === null) {
      return error;
    }
    return new BadGatewayException({
      statusCode: 502,
      codigo: falla.codigo,
      mensaje: falla.mensaje,
      detalle: (error as Error).message,
    });
  }

  /** El motivo en palabras, para `errorVendedores`. */
  private mensajeErrorHandy(error: unknown): string {
    return (
      this.clasificarErrorHandy(error)?.mensaje ??
      'No se pudieron sincronizar los vendedores por un error interno.'
    );
  }

  private clasificarErrorHandy(
    error: unknown,
  ): { codigo: string; mensaje: string } | null {
    if (error instanceof HandyTokenInvalidoError) {
      return {
        codigo: 'HANDY_TOKEN_INVALIDO',
        mensaje:
          'El token de integracion con Handy no es valido o expiro. Se requiere ' +
          'intervencion del administrador para regenerarlo.',
      };
    }
    if (
      error instanceof HandyErrorServidorError ||
      error instanceof HandySinRespuestaError
    ) {
      return {
        codigo: 'HANDY_NO_DISPONIBLE',
        mensaje:
          'Handy no esta disponible en este momento. Vuelve a intentar la ' +
          'sincronizacion en unos minutos.',
      };
    }
    if (error instanceof HandyRespuestaNoOkError) {
      return {
        codigo: 'HANDY_RESPUESTA_INESPERADA',
        mensaje:
          'Handy respondio de forma inesperada y no se pudo completar la ' +
          'sincronizacion.',
      };
    }
    return null;
  }
}

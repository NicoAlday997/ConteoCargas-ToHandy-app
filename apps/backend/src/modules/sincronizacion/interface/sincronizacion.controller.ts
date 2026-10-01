import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { RolApp } from '@prisma/client';
import type { Response } from 'express';

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
import { SincronizarConCandadoUseCase } from '../application/sincronizar-con-candado.use-case';
import {
  CodeProductoSchema,
  ConfirmarFactorSchema,
  type ConfirmarFactorDto,
} from './sincronizacion.dto';
import type { MotivoCandado } from '../domain/candado-sincronizacion';

/** Lo que dice el 429 segun por que esta cerrado el candado. */
const MENSAJE_CANDADO: Record<MotivoCandado, string> = {
  SINCRONIZACION_RECIENTE:
    'Alguien acaba de sincronizar. Espera un momento y vuelve a intentarlo.',
  SINCRONIZACION_FALLIDA_RECIENTE:
    'El intento anterior falló. Espera unos segundos y vuelve a intentarlo.',
};

/**
 * Sincronizacion del cache local contra Handy (docs/04-api-interna.md §1.3);
 * la misma que corre sola cada dia a las 5:00 (`SincronizacionDiaria`). Los
 * guards van a nivel de clase (todo exige JWT valido) y cada handler declara
 * sus roles: sincronizar y consultar el estado son de los TRES roles (decision
 * del dueño; el candado de 2 minutos protege a Handy de once dispositivos);
 * la revision del factor de empaque (piezas por paquete) sigue siendo solo
 * del Supervisor.
 *
 * Los fallos de Handy se traducen a 502 Bad Gateway con un `mensaje` en español
 * apto para el usuario final; el texto crudo de Handy solo viaja en `detalle`,
 * para depuracion (docs/04 §1.7). El adaptador HTTP garantiza que ese texto
 * nunca contiene el token de integracion.
 */
@Controller('admin/sincronizacion')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SincronizacionController {
  constructor(
    private readonly sincronizarConCandadoUseCase: SincronizarConCandadoUseCase,
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
   *
   * Candado global: si la ultima sincronizacion (de quien sea, incluida la de
   * las 5:00) empezo hace menos de 2 minutos, responde 429
   * `SINCRONIZACION_RECIENTE` con `reintentarEn` (y `Retry-After` en segundos)
   * SIN llamar a Handy. Si esa ultima FALLO, la espera es de 20 segundos y el
   * codigo `SINCRONIZACION_FALLIDA_RECIENTE`: no se dice que alguien
   * sincronizo, porque no se sincronizo nada. Queda registrado quien
   * sincronizo y cuando; `usuarioAppId` sale del JWT.
   */
  @Post()
  @HttpCode(200)
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR, RolApp.SUPERVISOR)
  async sincronizar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    let salida;
    try {
      salida = await this.sincronizarConCandadoUseCase.ejecutarManual(
        usuario.usuarioAppId,
      );
    } catch (error) {
      throw this.traducirErrorHandy(error);
    }
    if (!salida.exito) {
      const segundos = Math.max(
        1,
        Math.ceil((salida.reintentarEn.getTime() - Date.now()) / 1000),
      );
      respuesta.setHeader('Retry-After', String(segundos));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          codigo: salida.motivo,
          mensaje: MENSAJE_CANDADO[salida.motivo],
          reintentarEn: salida.reintentarEn.toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const resultado = salida.resultado;
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
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR, RolApp.SUPERVISOR)
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
  @Roles(RolApp.SUPERVISOR)
  async listarFactoresPendientes() {
    return this.factorEmpaqueRepository.listarPendientes();
  }

  /**
   * Todos los productos activos con su empaque actual, confirmado o no, y
   * quien hizo la ultima confirmacion. Es la lista para corregir una
   * confirmacion equivocada.
   */
  @Get('factores')
  @Roles(RolApp.SUPERVISOR)
  async listarFactores() {
    return this.factorEmpaqueRepository.listarTodos();
  }

  /**
   * Cuantas cargas aun no enviadas a Handy tienen conteos del producto. La
   * app lo consulta ANTES de guardar un cambio: esos conteos se calcularon
   * con el factor actual y no se recalculan.
   */
  @Get('productos/:code/factor/cargas-en-curso')
  @Roles(RolApp.SUPERVISOR)
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
  @Roles(RolApp.SUPERVISOR)
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

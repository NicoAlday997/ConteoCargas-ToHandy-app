import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolApp } from '@prisma/client';
import type { TipoSesion } from '@prisma/client';

import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import type { UsuarioAutenticado } from '../../../shared/auth/jwt.strategy';
import { Roles } from '../../../shared/auth/roles.decorator';
import { RolesGuard } from '../../../shared/auth/roles.guard';
import { UsuarioActual } from '../../../shared/auth/usuario-actual.decorator';
import { ZodValidationPipe } from '../../auth/interface/zod-validation.pipe';
import { CargaRepository } from '../application/carga.repository';
import { CapturarCantidadFinalUseCase } from '../application/capturar-cantidad-final.use-case';
import { ConfirmarCantidadFinalUseCase } from '../application/confirmar-cantidad-final.use-case';
import { EnviarCargaUseCase } from '../application/enviar-carga.use-case';
import { FinalizarSesionUseCase } from '../application/finalizar-sesion.use-case';
import { IniciarCargaUseCase } from '../application/iniciar-carga.use-case';
import {
  CapturarCantidadSchema,
  FinalizarSesionSchema,
  GuardarItemsSchema,
  IdSchema,
  IniciarCargaSchema,
  type CapturarCantidadDto,
  type FinalizarSesionDto,
  type GuardarItemsDto,
  type IniciarCargaDto,
} from './cargas.dto';

/**
 * Capa HTTP del modulo de cargas (docs/04-api-interna.md §1.4; RF-12 .. RF-16).
 *
 * `JwtAuthGuard` + `RolesGuard` se aplican a nivel de clase: TODOS los endpoints
 * exigen JWT valido, y cada handler declara con `@Roles(...)` que roles lo pueden
 * ejecutar segun la matriz de permisos de docs/06 §2.
 *
 * El `usuarioAppId` (y el `usuarioHandyId`) SIEMPRE salen del JWT via
 * `@UsuarioActual`, nunca del body ni de la URL: la app no decide localmente en
 * nombre de quien actua.
 *
 * Los motivos de rechazo de los casos de uso se traducen aca a codigos HTTP con
 * un `mensaje` en español apto para el usuario final. El motivo interno crudo
 * NUNCA se expone; el `detalle` opcional solo lleva contexto de depuracion que
 * no revela internos (docs/04 §1.7).
 */
@Controller('eventos-carga')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CargasController {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly iniciarCargaUseCase: IniciarCargaUseCase,
    private readonly finalizarSesionUseCase: FinalizarSesionUseCase,
    private readonly capturarCantidadFinalUseCase: CapturarCantidadFinalUseCase,
    private readonly confirmarCantidadFinalUseCase: ConfirmarCantidadFinalUseCase,
    private readonly enviarCargaUseCase: EnviarCargaUseCase,
  ) {}

  /**
   * Inicia un evento de carga (inicial o recarga) de la ruta asignada al
   * vendedor. La ruta y la plantilla salen de su asignacion vigente, no del
   * body.
   */
  @Post()
  @Roles(RolApp.VENDEDOR)
  async iniciarCarga(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(IniciarCargaSchema)) dto: IniciarCargaDto,
  ) {
    // Solo el rol Vendedor esta vinculado a un `usuario_handy_id` (CLAUDE.md).
    // Sin ese vinculo no se puede armar la ruta en Handy.
    if (usuario.usuarioHandyId === null) {
      throw new ConflictException({
        statusCode: 409,
        mensaje:
          'Tu usuario no esta vinculado a un usuario de Handy. Un administrador debe vincularlo antes de que puedas iniciar cargas.',
      });
    }

    const resultado = await this.iniciarCargaUseCase.ejecutar(
      {
        usuarioAppId: usuario.usuarioAppId,
        tipo: dto.tipo,
        usuarioHandyId: usuario.usuarioHandyId,
      },
      new Date(),
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'SIN_RUTA_ASIGNADA':
          throw new ConflictException({
            statusCode: 409,
            mensaje:
              'No tienes una ruta asignada vigente. Pide a un supervisor que te asigne una antes de iniciar una carga.',
          });
        case 'YA_TIENE_CARGA_ABIERTA':
          throw new ConflictException({
            statusCode: 409,
            mensaje:
              'Ya tienes una carga abierta hoy. Cierrala o enviala antes de iniciar otra.',
          });
      }
    }

    return { evento: resultado.evento, sesion: resultado.sesion };
  }

  /**
   * Abre la sesion de conteo del usuario autenticado sobre el evento. El tipo de
   * sesion lo determina su rol (en autoventa el vendedor cuenta primero y el
   * contador verifica, docs/02 §3); `ubicacion` solo aplica al segundo conteo de
   * una recarga y es informativa.
   */
  @Post(':id/sesiones')
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR)
  async abrirSesion(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(FinalizarSesionSchema)) dto: FinalizarSesionDto,
  ) {
    const evento = await this.cargas.buscarEventoPorId(eventoId);
    if (evento === null) {
      throw new NotFoundException({
        statusCode: 404,
        mensaje: 'El evento de carga no existe.',
      });
    }

    // SUPERVISOR no llega aca: el endpoint es exclusivo de VENDEDOR y CONTADOR,
    // asi que el rol mapea 1:1 al tipo de sesion.
    const tipoSesion: TipoSesion =
      usuario.rolApp === RolApp.CONTADOR ? 'CONTADOR' : 'VENDEDOR';

    return this.cargas.crearSesion(
      eventoId,
      tipoSesion,
      usuario.usuarioAppId,
      undefined,
      dto.ubicacion,
    );
  }

  /**
   * Guarda/actualiza las cantidades capturadas en una sesion. Reemplazo total:
   * un producto que ya no venga en `items` queda eliminado de la sesion. Solo el
   * dueño de la sesion puede tocarla.
   */
  @Patch(':id/sesiones/:sesionId/items')
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR)
  async guardarItems(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
    @Param('sesionId', new ZodValidationPipe(IdSchema)) sesionId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(GuardarItemsSchema)) dto: GuardarItemsDto,
  ) {
    const sesion = await this.cargas.buscarSesionPorId(sesionId);
    if (sesion === null || sesion.eventoCargaId !== eventoId) {
      throw new NotFoundException({
        statusCode: 404,
        mensaje: 'La sesion de conteo no existe.',
      });
    }

    if (sesion.usuarioAppId !== usuario.usuarioAppId) {
      throw new ForbiddenException({
        statusCode: 403,
        mensaje: 'Solo puedes modificar tu propia sesion de conteo.',
      });
    }

    await this.cargas.guardarItems(sesionId, dto.items);

    // Convencion docs/04 §1.7: la mutacion devuelve el recurso completo.
    return {
      sesion: await this.cargas.buscarSesionPorId(sesionId),
      items: await this.cargas.listarItemsDeSesion(sesionId),
    };
  }

  /**
   * Cierra la sesion de conteo del usuario autenticado. Al cerrarse las dos
   * sesiones (vendedor y contador) se dispara la comparacion automatica. Solo el
   * dueño de la sesion puede cerrarla (lo valida el caso de uso).
   */
  @Post(':id/sesiones/:sesionId/finalizar')
  @HttpCode(200)
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR)
  async finalizarSesion(
    @Param('sesionId', new ZodValidationPipe(IdSchema)) sesionId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    const resultado = await this.finalizarSesionUseCase.ejecutar(
      sesionId,
      usuario.usuarioAppId,
      new Date(),
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'SESION_NO_ENCONTRADA':
          throw new NotFoundException({
            statusCode: 404,
            mensaje: 'La sesion de conteo no existe.',
          });
        case 'SESION_AJENA':
          throw new ForbiddenException({
            statusCode: 403,
            mensaje: 'Solo puedes finalizar tu propia sesion de conteo.',
          });
        case 'TRANSICION_INVALIDA':
        case 'ESTADO_INCONSISTENTE':
          throw new ConflictException({
            statusCode: 409,
            mensaje:
              'La carga no esta en un estado que permita cerrar esta sesion.',
          });
      }
    }

    return {
      evento: resultado.evento,
      sesion: resultado.sesion,
      discrepancias: resultado.discrepancias,
    };
  }

  /**
   * Detalle del evento con ambas sesiones y las discrepancias si existen. El
   * vendedor solo puede ver SUS eventos (tiene que tener una sesion propia en
   * el); contador y supervisor ven cualquiera, con o sin discrepancia
   * (auditoria pareja, CLAUDE.md).
   */
  @Get(':id')
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR, RolApp.SUPERVISOR)
  async detalle(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    const evento = await this.cargas.buscarEventoPorId(eventoId);
    if (evento === null) {
      throw new NotFoundException({
        statusCode: 404,
        mensaje: 'El evento de carga no existe.',
      });
    }

    const sesiones = await this.cargas.listarSesionesDeEvento(eventoId);

    if (usuario.rolApp === RolApp.VENDEDOR) {
      const esDueño = sesiones.some(
        (s) => s.usuarioAppId === usuario.usuarioAppId,
      );
      if (!esDueño) {
        throw new ForbiddenException({
          statusCode: 403,
          mensaje: 'No tienes permiso para ver este evento de carga.',
        });
      }
    }

    return {
      evento,
      sesiones,
      discrepancias: await this.cargas.listarDiscrepancias(eventoId),
    };
  }

  /** Productos con discrepancia del evento (pendientes o ya resueltas). */
  @Get(':id/discrepancias')
  @Roles(RolApp.CONTADOR, RolApp.SUPERVISOR)
  async discrepancias(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
  ) {
    const evento = await this.cargas.buscarEventoPorId(eventoId);
    if (evento === null) {
      throw new NotFoundException({
        statusCode: 404,
        mensaje: 'El evento de carga no existe.',
      });
    }

    return this.cargas.listarDiscrepancias(eventoId);
  }

  /**
   * Paso 1 de la resolucion de una discrepancia: una persona captura la cantidad
   * final acordada para el producto en conflicto.
   */
  @Post(':id/discrepancias/:productoCode/capturar')
  @HttpCode(200)
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR)
  async capturarDiscrepancia(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
    @Param('productoCode') productoCode: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(CapturarCantidadSchema))
    dto: CapturarCantidadDto,
  ) {
    const resultado = await this.capturarCantidadFinalUseCase.ejecutar(
      {
        eventoId,
        productoCode,
        cantidadFinal: dto.cantidadFinal,
        usuarioAppId: usuario.usuarioAppId,
      },
      new Date(),
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'ESTADO_INVALIDO':
          throw new ConflictException({
            statusCode: 409,
            mensaje: 'La carga no tiene conflictos pendientes por resolver.',
          });
        case 'DISCREPANCIA_NO_ENCONTRADA':
          throw new NotFoundException({
            statusCode: 404,
            mensaje:
              'No hay una discrepancia registrada para ese producto en esta carga.',
          });
        case 'CANTIDAD_INVALIDA':
          throw new BadRequestException({
            statusCode: 400,
            mensaje:
              'La cantidad final debe ser un numero entero mayor o igual a cero.',
          });
        case 'YA_CONFIRMADA':
          throw new ConflictException({
            statusCode: 409,
            mensaje:
              'Esa discrepancia ya fue confirmada y no puede recapturarse.',
          });
      }
    }

    return { discrepancia: resultado.discrepancia };
  }

  /**
   * Paso 2 de la resolucion de una discrepancia: una persona DISTINTA a la que
   * capturo confirma la cantidad con su propio PIN. La autoconfirmacion se
   * rechaza (CLAUDE.md, docs/01 §6 regla 3).
   */
  @Post(':id/discrepancias/:productoCode/confirmar')
  @HttpCode(200)
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR)
  async confirmarDiscrepancia(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
    @Param('productoCode') productoCode: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    const resultado = await this.confirmarCantidadFinalUseCase.ejecutar(
      { eventoId, productoCode, usuarioAppId: usuario.usuarioAppId },
      new Date(),
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'AUTOCONFIRMACION_PROHIBIDA':
          throw new ForbiddenException({
            statusCode: 403,
            mensaje:
              'No puedes confirmar una cantidad que tu mismo capturaste: la confirmacion debe hacerla otra persona con su propio PIN.',
          });
        case 'ESTADO_INVALIDO':
          throw new ConflictException({
            statusCode: 409,
            mensaje: 'La carga no tiene conflictos pendientes por resolver.',
          });
        case 'DISCREPANCIA_NO_ENCONTRADA':
          throw new NotFoundException({
            statusCode: 404,
            mensaje:
              'No hay una discrepancia registrada para ese producto en esta carga.',
          });
        case 'NO_HAY_CAPTURA_PREVIA':
          throw new ConflictException({
            statusCode: 409,
            mensaje:
              'Todavia nadie ha capturado la cantidad final de esa discrepancia.',
          });
        case 'YA_CONFIRMADA':
          throw new ConflictException({
            statusCode: 409,
            mensaje: 'Esa discrepancia ya estaba confirmada.',
          });
      }
    }

    return {
      discrepancia: resultado.discrepancia,
      listaParaEnviar: resultado.listaParaEnviar,
    };
  }

  /**
   * Dispara el envio de la carga conciliada a Handy. Solo permitido si no hay
   * discrepancias pendientes; los fallos de Handy se traducen a 502 con un
   * mensaje apto para el usuario (el texto crudo de Handy nunca se expone).
   */
  @Post(':id/enviar')
  @HttpCode(200)
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR, RolApp.SUPERVISOR)
  async enviar(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    const resultado = await this.enviarCargaUseCase.ejecutar(
      { eventoId, usuarioAppId: usuario.usuarioAppId },
      new Date(),
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'ESTADO_INVALIDO':
          throw new ConflictException({
            statusCode: 409,
            mensaje: 'La carga no esta lista para enviar o ya fue enviada.',
          });
        case 'INVENTARIO_INSUFICIENTE_TOTAL':
          throw new ConflictException({
            statusCode: 409,
            mensaje:
              'Handy rechazo todos los productos por inventario insuficiente; no se creo ninguna ruta.',
            detalle: `Productos rechazados: ${resultado.productosRechazados.join(', ')}`,
          });
        case 'ENVIO_INCIERTO':
          throw new BadGatewayException({
            statusCode: 502,
            mensaje:
              'No se pudo confirmar el envio a Handy. Se genero una alerta para revision; no reintentes manualmente.',
          });
        case 'ERROR_ENVIO':
          throw new BadGatewayException({
            statusCode: 502,
            mensaje:
              'El envio a Handy fallo por un problema de configuracion. Se requiere intervencion de un administrador.',
          });
      }
    }

    return {
      idHandy: resultado.idHandy,
      yaExistia: resultado.yaExistia,
      productosRechazados: resultado.productosRechazados,
    };
  }
}

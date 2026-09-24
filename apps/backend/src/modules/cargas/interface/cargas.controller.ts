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
import { AbrirSesionUseCase } from '../application/abrir-sesion.use-case';
import { AutorizarCargaUseCase } from '../application/autorizar-carga.use-case';
import { CargaRepository } from '../application/carga.repository';
import { CapturarCantidadFinalUseCase } from '../application/capturar-cantidad-final.use-case';
import { ConfirmarCantidadFinalUseCase } from '../application/confirmar-cantidad-final.use-case';
import { ConsultasCargaRepository } from '../application/consultas-carga.repository';
import { DesbloquearCargaUseCase } from '../application/desbloquear-carga.use-case';
import { EnviarCargaUseCase } from '../application/enviar-carga.use-case';
import { FinalizarSesionUseCase } from '../application/finalizar-sesion.use-case';
import { GuardarItemsUseCase } from '../application/guardar-items.use-case';
import { IniciarCargaUseCase } from '../application/iniciar-carga.use-case';
import { ListarItemsDeSesionUseCase } from '../application/listar-items-de-sesion.use-case';
import { ListarPendientesVerificacionUseCase } from '../application/listar-pendientes-verificacion.use-case';
import { ListarProductosDePlantillaUseCase } from '../application/listar-productos-de-plantilla.use-case';
import { ModificarCantidadSupervisorUseCase } from '../application/modificar-cantidad-supervisor.use-case';
import { RechazarProductosUseCase } from '../application/rechazar-productos.use-case';
import { VerificarCortePendienteUseCase } from '../application/verificar-corte-pendiente.use-case';
import {
  CapturarCantidadSchema,
  ConfirmarCantidadSchema,
  FinalizarSesionSchema,
  GuardarItemsSchema,
  IdSchema,
  IniciarCargaSchema,
  ModificarCantidadSchema,
  RechazarProductosSchema,
  type CapturarCantidadDto,
  type ConfirmarCantidadDto,
  type FinalizarSesionDto,
  type GuardarItemsDto,
  type IniciarCargaDto,
  type ModificarCantidadDto,
  type RechazarProductosDto,
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
    private readonly consultas: ConsultasCargaRepository,
    private readonly listarPendientesVerificacionUseCase: ListarPendientesVerificacionUseCase,
    private readonly iniciarCargaUseCase: IniciarCargaUseCase,
    private readonly abrirSesionUseCase: AbrirSesionUseCase,
    private readonly guardarItemsUseCase: GuardarItemsUseCase,
    private readonly listarItemsDeSesionUseCase: ListarItemsDeSesionUseCase,
    private readonly listarProductosDePlantillaUseCase: ListarProductosDePlantillaUseCase,
    private readonly finalizarSesionUseCase: FinalizarSesionUseCase,
    private readonly capturarCantidadFinalUseCase: CapturarCantidadFinalUseCase,
    private readonly confirmarCantidadFinalUseCase: ConfirmarCantidadFinalUseCase,
    private readonly enviarCargaUseCase: EnviarCargaUseCase,
    private readonly autorizarCargaUseCase: AutorizarCargaUseCase,
    private readonly rechazarProductosUseCase: RechazarProductosUseCase,
    private readonly modificarCantidadSupervisorUseCase: ModificarCantidadSupervisorUseCase,
    private readonly verificarCortePendienteUseCase: VerificarCortePendienteUseCase,
    private readonly desbloquearCargaUseCase: DesbloquearCargaUseCase,
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
        fechaOperativa: dto.fechaOperativa,
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
        case 'FECHA_OPERATIVA_INVALIDA':
          throw new BadRequestException({
            statusCode: 400,
            codigo: 'FECHA_OPERATIVA_INVALIDA',
            mensaje:
              'No se puede registrar una carga para un dia pasado. Elige hoy o una fecha posterior.',
          });
        case 'YA_TIENE_CARGA_ABIERTA':
          // `eventoId` permite a la app ofrecer continuar la carga existente.
          throw new ConflictException({
            statusCode: 409,
            codigo: 'YA_TIENE_CARGA_ABIERTA',
            mensaje:
              'Tu ruta ya tiene una carga inicial para esa fecha. Continua esa carga en lugar de crear otra.',
            eventoId: resultado.eventoId,
          });
      }
    }

    return { evento: resultado.evento, sesion: resultado.sesion };
  }

  /**
   * Cola del contador (docs/06 §3.3): cargas que el vendedor ya conto y esperan
   * el segundo conteo, incluidas las bloqueadas por corte de venta pendiente.
   * Solo dice cuantos productos conto el vendedor, nunca cuantas piezas: el
   * segundo conteo es a ciegas.
   *
   * Declarado ANTES de `GET :id`: si no, Nest lo tomaria como un id.
   */
  @Get('pendientes-verificacion')
  @Roles(RolApp.CONTADOR, RolApp.SUPERVISOR)
  async pendientesVerificacion(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.listarPendientesVerificacionUseCase.ejecutar({
      usuarioAppId: usuario.usuarioAppId,
    });
  }

  /**
   * Cargas en `CONFLICTOS_PENDIENTES` donde el usuario autenticado conto: su
   * acceso directo a resolver discrepancias. Declarado antes de `GET :id`.
   */
  @Get('conflictos-pendientes')
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR)
  async conflictosPendientes(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.consultas.listarConflictosDeParticipante(usuario.usuarioAppId);
  }

  /**
   * Abre la sesion de conteo del usuario autenticado sobre el evento. El tipo de
   * sesion lo determina su rol (en autoventa el vendedor cuenta primero y el
   * contador verifica, docs/02 §3); `ubicacion` solo aplica al segundo conteo de
   * una recarga y es informativa.
   *
   * Si quien abre la sesion es el CONTADOR, el caso de uso revisa antes que el
   * vendedor no tenga la ruta anterior sin liquidar en Handy (RF-13, docs/01
   * §6 regla 2): de tenerla, el evento queda `BLOQUEADA_CORTE_PENDIENTE` y se
   * responde 409. El VENDEDOR nunca pasa por esa revision.
   */
  @Post(':id/sesiones')
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR)
  async abrirSesion(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(FinalizarSesionSchema)) dto: FinalizarSesionDto,
  ) {
    // SUPERVISOR no llega aca: el endpoint es exclusivo de VENDEDOR y CONTADOR,
    // asi que el rol mapea 1:1 al tipo de sesion.
    const tipoSesion: TipoSesion =
      usuario.rolApp === RolApp.CONTADOR ? 'CONTADOR' : 'VENDEDOR';

    const resultado = await this.abrirSesionUseCase.ejecutar(
      {
        eventoId,
        usuarioAppId: usuario.usuarioAppId,
        tipo: tipoSesion,
        ubicacion: dto.ubicacion,
      },
      new Date(),
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'EVENTO_NO_ENCONTRADO':
          throw new NotFoundException({
            statusCode: 404,
            mensaje: 'El evento de carga no existe.',
          });
        case 'YA_TIENE_SESION_EN_ESTE_EVENTO':
          throw new ConflictException({
            statusCode: 409,
            mensaje:
              'Ya tienes una sesion abierta en esta carga. Continua esa sesion en vez de abrir una nueva.',
          });
        case 'CORTE_PENDIENTE':
          throw new ConflictException({
            statusCode: 409,
            codigo: 'CORTE_PENDIENTE',
            mensaje:
              'El vendedor tiene un corte de venta pendiente en Handy (una ruta anterior sin cerrar). Debe cerrarlo antes de que puedas verificar esta carga.',
          });
      }
    }

    return resultado.sesion;
  }

  /**
   * Productos que la app muestra en el grid de conteo del evento: los activos
   * de la plantilla snapshot del evento (o todo el catalogo activo si no tiene
   * plantilla), agrupados por familia y ordenados por nombre. Incluye el
   * factor de empaque para que la app sepa si puede capturar paquetes.
   */
  @Get(':id/productos')
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR, RolApp.SUPERVISOR)
  async productos(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
  ) {
    const resultado = await this.listarProductosDePlantillaUseCase.ejecutar({
      eventoId,
    });

    if (!resultado.exito) {
      throw new NotFoundException({
        statusCode: 404,
        mensaje: 'El evento de carga no existe.',
      });
    }

    return { plantillaId: resultado.plantillaId, familias: resultado.familias };
  }

  /**
   * Guarda/actualiza lo capturado en una sesion: `paquetes` y `sueltas` por
   * producto; el total en piezas (`cantidad`) lo calcula el backend. Reemplazo
   * total: un producto que ya no venga en `items` queda eliminado de la
   * sesion. Solo el dueño de la sesion puede tocarla.
   */
  @Patch(':id/sesiones/:sesionId/items')
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR)
  async guardarItems(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
    @Param('sesionId', new ZodValidationPipe(IdSchema)) sesionId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(GuardarItemsSchema)) dto: GuardarItemsDto,
  ) {
    const resultado = await this.guardarItemsUseCase.ejecutar({
      eventoId,
      sesionId,
      usuarioAppId: usuario.usuarioAppId,
      items: dto.items,
      recibidoEn: new Date(),
    });

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
            mensaje: 'Solo puedes modificar tu propia sesion de conteo.',
          });
        case 'PRODUCTO_NO_ENCONTRADO':
          throw new NotFoundException({
            statusCode: 404,
            mensaje: 'Alguno de los productos no existe en el catalogo.',
            detalle: `Productos: ${resultado.productos.join(', ')}`,
            // La app marca como fallidos solo estos productos.
            productos: resultado.productos,
          });
        case 'FACTOR_NO_CONFIRMADO':
          throw new ConflictException({
            statusCode: 409,
            mensaje:
              'Hay productos cuyas piezas por paquete aun no confirma un supervisor. Cuentalos en piezas sueltas o pide que confirmen el factor.',
            detalle: `Productos: ${resultado.productos.join(', ')}`,
            productos: resultado.productos,
          });
        case 'SUELTAS_EN_PRODUCTO_COMPLETO':
          throw new ConflictException({
            statusCode: 409,
            mensaje:
              'Hay productos que se venden completos y se capturaron con piezas sueltas. Cuentalos solo en su unidad (bolsas, cajas).',
            detalle: `Productos: ${resultado.productos.join(', ')}`,
            productos: resultado.productos,
          });
      }
    }

    // Convencion docs/04 §1.7: la mutacion devuelve el recurso completo.
    return { sesion: resultado.sesion, items: resultado.items };
  }

  /**
   * Lo guardado en la sesion del usuario autenticado, con `capturadoEn` y
   * `recibidoEn` por item. La app lo usa al reabrir un conteo para reconciliar
   * su copia local antes de volver a enviar (el PATCH reemplaza todo).
   */
  @Get(':id/sesiones/:sesionId/items')
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR)
  async itemsDeSesion(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
    @Param('sesionId', new ZodValidationPipe(IdSchema)) sesionId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    const resultado = await this.listarItemsDeSesionUseCase.ejecutar({
      eventoId,
      sesionId,
      usuarioAppId: usuario.usuarioAppId,
    });

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
            mensaje: 'Solo puedes consultar tu propia sesion de conteo.',
          });
      }
    }

    return { items: resultado.items };
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

  /**
   * Productos con discrepancia del evento (pendientes o ya resueltas), con el
   * nombre y factor de empaque del producto y el nombre de quien capturo y
   * confirmo. El vendedor solo ve las de cargas donde conto.
   */
  @Get(':id/discrepancias')
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR, RolApp.SUPERVISOR)
  async discrepancias(
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
    await this.exigirVendedorParticipante(eventoId, usuario);

    return this.consultas.listarDiscrepanciasDetalle(eventoId);
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
    await this.exigirVendedorParticipante(eventoId, usuario);

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
   * capturo confirma la cantidad tecleando su propio PIN, que se verifica aqui.
   * La autoconfirmacion se rechaza (CLAUDE.md, docs/01 §6 regla 3).
   *
   * Los rechazos de PIN responden 403 y NO 401: para la app un 401 significa
   * sesion vencida y cierra la sesion, y aqui la sesion sigue siendo valida.
   * `codigo` permite a la app distinguir cada caso sin leer el mensaje.
   */
  @Post(':id/discrepancias/:productoCode/confirmar')
  @HttpCode(200)
  @Roles(RolApp.VENDEDOR, RolApp.CONTADOR)
  async confirmarDiscrepancia(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
    @Param('productoCode') productoCode: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(ConfirmarCantidadSchema))
    dto: ConfirmarCantidadDto,
  ) {
    await this.exigirVendedorParticipante(eventoId, usuario);

    const ahora = new Date();
    const resultado = await this.confirmarCantidadFinalUseCase.ejecutar(
      {
        eventoId,
        productoCode,
        usuarioAppId: usuario.usuarioAppId,
        pin: dto.pin,
        cantidadFinal: dto.cantidadFinal,
      },
      ahora,
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'AUTOCONFIRMACION_PROHIBIDA':
          throw new ForbiddenException({
            statusCode: 403,
            codigo: 'AUTOCONFIRMACION_PROHIBIDA',
            mensaje:
              'No puedes confirmar una cantidad que tu mismo capturaste: la confirmacion debe hacerla otra persona con su propio PIN.',
          });
        case 'CANTIDAD_CAMBIO':
          throw new ConflictException({
            statusCode: 409,
            codigo: 'CANTIDAD_CAMBIO',
            mensaje:
              'La cantidad final cambio mientras confirmabas: alguien la volvio a capturar. Revisala antes de confirmar.',
          });
        case 'PIN_INCORRECTO': {
          const n = resultado.intentosRestantes;
          throw new ForbiddenException({
            statusCode: 403,
            codigo: 'PIN_INCORRECTO',
            mensaje:
              n === null
                ? 'PIN incorrecto.'
                : `PIN incorrecto. ${n === 1 ? 'Te queda 1 intento' : `Te quedan ${n} intentos`} antes del bloqueo temporal.`,
            intentosRestantes: n,
          });
        }
        case 'BLOQUEADO':
          throw new ForbiddenException({
            statusCode: 403,
            codigo: 'USUARIO_BLOQUEADO',
            mensaje:
              'Tu usuario quedo bloqueado temporalmente por intentos fallidos de PIN. Espera unos minutos o pide a tu supervisor que lo restablezca.',
            bloqueadoHasta: resultado.bloqueadoHasta.toISOString(),
          });
        case 'INACTIVO':
          throw new ForbiddenException({
            statusCode: 403,
            codigo: 'USUARIO_INACTIVO',
            mensaje:
              'Tu usuario esta desactivado. Pide a tu supervisor que lo reactive.',
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
      enEsperaAutorizacion: resultado.enEsperaAutorizacion,
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

  /**
   * El supervisor autoriza el envio de una carga ya conciliada por el doble
   * conteo (CLAUDE.md, docs/02 §3.1): el tercer par de ojos que cierra el
   * punto ciego del doble conteo. Solo aplica sobre eventos en
   * `EN_ESPERA_AUTORIZACION`.
   */
  @Post(':id/autorizar')
  @HttpCode(200)
  @Roles(RolApp.SUPERVISOR)
  async autorizar(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    const resultado = await this.autorizarCargaUseCase.ejecutar(
      { eventoId, usuarioAppId: usuario.usuarioAppId },
      new Date(),
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'ESTADO_INVALIDO':
          throw new ConflictException({
            statusCode: 409,
            mensaje:
              'La carga no existe o no esta esperando autorizacion del supervisor.',
          });
        case 'TRANSICION_INVALIDA':
          throw new ConflictException({
            statusCode: 409,
            mensaje: 'La carga no puede autorizarse en su estado actual.',
          });
      }
    }

    return { evento: resultado.evento };
  }

  /**
   * El supervisor rechaza productos puntuales durante la autorizacion
   * (CLAUDE.md): NO se devuelve la carga completa a recontar, solo los
   * productos senalados vuelven a quedar sin resolver.
   */
  @Post(':id/rechazar-productos')
  @HttpCode(200)
  @Roles(RolApp.SUPERVISOR)
  async rechazarProductos(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(RechazarProductosSchema))
    dto: RechazarProductosDto,
  ) {
    const resultado = await this.rechazarProductosUseCase.ejecutar(
      {
        eventoId,
        usuarioAppId: usuario.usuarioAppId,
        productosRechazados: dto.productos,
      },
      new Date(),
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'ESTADO_INVALIDO':
          throw new ConflictException({
            statusCode: 409,
            mensaje:
              'La carga no existe o no esta esperando autorizacion del supervisor.',
          });
        case 'SIN_PRODUCTOS':
          throw new BadRequestException({
            statusCode: 400,
            mensaje: 'Debes indicar al menos un producto a rechazar.',
          });
        case 'PRODUCTO_NO_ENCONTRADO':
          throw new NotFoundException({
            statusCode: 404,
            mensaje:
              'Alguno de los productos indicados no forma parte de esta carga.',
          });
      }
    }

    return {
      evento: resultado.evento,
      productosPendientes: resultado.productosPendientes,
    };
  }

  /**
   * El supervisor propone una cantidad nueva para un producto durante la
   * autorizacion (CLAUDE.md): esa cantidad NO queda resuelta con solo su
   * palabra, requiere la misma confirmacion cruzada que cualquier
   * discrepancia — el supervisor no puede confirmar su propia modificacion.
   */
  @Post(':id/productos/:productoCode/modificar')
  @HttpCode(200)
  @Roles(RolApp.SUPERVISOR)
  async modificarCantidad(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
    @Param('productoCode') productoCode: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(ModificarCantidadSchema))
    dto: ModificarCantidadDto,
  ) {
    const resultado = await this.modificarCantidadSupervisorUseCase.ejecutar(
      {
        eventoId,
        productoCode,
        cantidadNueva: dto.cantidadNueva,
        usuarioAppId: usuario.usuarioAppId,
        motivo: dto.motivo,
      },
      new Date(),
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'ESTADO_INVALIDO':
          throw new ConflictException({
            statusCode: 409,
            mensaje:
              'La carga no existe o no esta esperando autorizacion del supervisor.',
          });
        case 'CANTIDAD_INVALIDA':
          throw new BadRequestException({
            statusCode: 400,
            mensaje:
              'La cantidad nueva debe ser un numero entero mayor o igual a cero.',
          });
        case 'PRODUCTO_NO_ENCONTRADO':
          throw new NotFoundException({
            statusCode: 404,
            mensaje: 'Ese producto no forma parte de esta carga.',
          });
      }
    }

    return {
      evento: resultado.evento,
      discrepancia: resultado.discrepancia,
      mensaje:
        'La cantidad quedo registrada pero pendiente de confirmacion: una persona distinta a ti debe confirmarla con su propio PIN antes de que la carga pueda autorizarse.',
    };
  }

  /**
   * Intenta liberar una carga bloqueada por corte de venta pendiente (RF-13,
   * docs/01 §6 regla 2; docs/02 §4.5): vuelve a consultar Handy y, si el
   * vendedor ya cerro la ruta anterior, el evento vuelve a `EN_ESPERA_CONTADOR`.
   * Si el corte sigue pendiente no cambia nada y lo indica en la respuesta.
   */
  @Post(':id/desbloquear')
  @HttpCode(200)
  @Roles(RolApp.CONTADOR, RolApp.SUPERVISOR)
  async desbloquear(
    @Param('id', new ZodValidationPipe(IdSchema)) eventoId: string,
  ) {
    const resultado = await this.desbloquearCargaUseCase.ejecutar(
      { eventoId },
      new Date(),
    );

    if (!resultado.exito) {
      throw new ConflictException({
        statusCode: 409,
        mensaje:
          'La carga no existe o no esta bloqueada por corte de venta pendiente.',
      });
    }

    if (resultado.sigueBloqueado) {
      return {
        sigueBloqueado: true,
        mensaje:
          'El vendedor todavia no cierra su corte de venta pendiente en Handy.',
      };
    }

    return { sigueBloqueado: false, evento: resultado.evento };
  }

  /**
   * El vendedor solo actua sobre cargas donde conto (tiene sesion propia), igual
   * que en `GET :id`. Sin esto, otro vendedor ajeno a la carga podria servir de
   * "segunda persona" en la confirmacion cruzada. Contador y supervisor no se
   * restringen aqui.
   */
  private async exigirVendedorParticipante(
    eventoId: string,
    usuario: UsuarioAutenticado,
  ): Promise<void> {
    if (usuario.rolApp !== RolApp.VENDEDOR) return;
    const sesiones = await this.cargas.listarSesionesDeEvento(eventoId);
    if (!sesiones.some((s) => s.usuarioAppId === usuario.usuarioAppId)) {
      throw new ForbiddenException({
        statusCode: 403,
        mensaje:
          'Solo puedes resolver discrepancias de una carga donde contaste.',
      });
    }
  }
}

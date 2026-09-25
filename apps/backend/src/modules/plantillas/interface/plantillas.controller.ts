import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolApp } from '@prisma/client';

import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import { Roles } from '../../../shared/auth/roles.decorator';
import { RolesGuard } from '../../../shared/auth/roles.guard';
import { ZodValidationPipe } from '../../auth/interface/zod-validation.pipe';
import { AgregarProductosAPlantillaUseCase } from '../application/agregar-productos-a-plantilla.use-case';
import { AsignarPlantillaARutaUseCase } from '../application/asignar-plantilla-a-ruta.use-case';
import { CrearPlantillaUseCase } from '../application/crear-plantilla.use-case';
import { EditarPlantillaUseCase } from '../application/editar-plantilla.use-case';
import { ListarPlantillasUseCase } from '../application/listar-plantillas.use-case';
import { PlantillaRepository } from '../application/plantilla.repository';
import { QuitarProductosDePlantillaUseCase } from '../application/quitar-productos-de-plantilla.use-case';
import { VerPlantillaUseCase } from '../application/ver-plantilla.use-case';
import {
  CodigosProductoSchema,
  CrearPlantillaSchema,
  EditarPlantillaSchema,
  IdSchema,
  ListarPlantillasQuerySchema,
  type CodigosProductoDto,
  type CrearPlantillaDto,
  type EditarPlantillaDto,
  type ListarPlantillasQueryDto,
} from './plantillas.dto';

const NO_ENCONTRADA = {
  statusCode: 404,
  codigo: 'PLANTILLA_NO_ENCONTRADA',
  mensaje: 'La plantilla no existe.',
};

const NOMBRE_DUPLICADO = {
  statusCode: 409,
  codigo: 'NOMBRE_DUPLICADO',
  mensaje:
    'Ya existe una plantilla con ese nombre. Usa otro para no confundirlas.',
};

/**
 * Administracion de plantillas de carga: que productos ve el vendedor de cada
 * ruta en su grid de conteo. Guards a nivel de clase: TODOS los endpoints
 * exigen JWT valido y rol SUPERVISOR.
 *
 * Las mutaciones devuelven la plantilla completa (docs/04 §1.7) para que la
 * app no tenga que volver a pedirla.
 */
@Controller('admin/plantillas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolApp.SUPERVISOR)
export class PlantillasController {
  constructor(
    private readonly plantillaRepository: PlantillaRepository,
    private readonly listarPlantillasUseCase: ListarPlantillasUseCase,
    private readonly verPlantillaUseCase: VerPlantillaUseCase,
    private readonly crearPlantillaUseCase: CrearPlantillaUseCase,
    private readonly editarPlantillaUseCase: EditarPlantillaUseCase,
    private readonly agregarProductosUseCase: AgregarProductosAPlantillaUseCase,
    private readonly quitarProductosUseCase: QuitarProductosDePlantillaUseCase,
    private readonly asignarPlantillaUseCase: AsignarPlantillaARutaUseCase,
  ) {}

  /** Plantillas activas (o todas con `?incluirInactivas=true`). */
  @Get()
  async listar(
    @Query(new ZodValidationPipe(ListarPlantillasQuerySchema))
    query: ListarPlantillasQueryDto,
  ) {
    return this.listarPlantillasUseCase.ejecutar({
      incluirInactivas: query.incluirInactivas,
    });
  }

  /**
   * Rutas activas con sus vendedores y la plantilla que usan hoy, para
   * asignar plantillas. Declarada antes de `:id` para que no la capture.
   */
  @Get('rutas')
  async listarRutas() {
    return this.plantillaRepository.listarRutas();
  }

  @Get(':id')
  async ver(@Param('id', new ZodValidationPipe(IdSchema)) id: string) {
    return this.detalle(id);
  }

  @Post()
  async crear(
    @Body(new ZodValidationPipe(CrearPlantillaSchema)) dto: CrearPlantillaDto,
  ) {
    const resultado = await this.crearPlantillaUseCase.ejecutar({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
    });
    if (!resultado.exito) throw new ConflictException(NOMBRE_DUPLICADO);
    return this.detalle(resultado.plantilla.id);
  }

  /** Renombrar, cambiar descripcion, activar o desactivar. */
  @Patch(':id')
  @HttpCode(200)
  async editar(
    @Param('id', new ZodValidationPipe(IdSchema)) id: string,
    @Body(new ZodValidationPipe(EditarPlantillaSchema)) dto: EditarPlantillaDto,
  ) {
    const resultado = await this.editarPlantillaUseCase.ejecutar(id, dto);
    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'PLANTILLA_NO_ENCONTRADA':
          throw new NotFoundException(NO_ENCONTRADA);
        case 'NOMBRE_DUPLICADO':
          throw new ConflictException(NOMBRE_DUPLICADO);
        case 'PLANTILLA_EN_USO':
          throw new ConflictException({
            statusCode: 409,
            codigo: 'PLANTILLA_EN_USO',
            mensaje:
              'Esta plantilla la usa al menos una ruta. Asigna otra plantilla a esas rutas antes de desactivarla.',
          });
      }
    }
    return this.detalle(id);
  }

  /**
   * Agrega varios productos. Si algun codigo no existe en el catalogo no se
   * agrega ninguno (400 con los `productos` desconocidos).
   */
  @Post(':id/productos')
  @HttpCode(200)
  async agregarProductos(
    @Param('id', new ZodValidationPipe(IdSchema)) id: string,
    @Body(new ZodValidationPipe(CodigosProductoSchema)) dto: CodigosProductoDto,
  ) {
    const resultado = await this.agregarProductosUseCase.ejecutar(
      id,
      dto.codes,
    );
    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'PLANTILLA_NO_ENCONTRADA':
          throw new NotFoundException(NO_ENCONTRADA);
        case 'PRODUCTOS_NO_ENCONTRADOS':
          throw new BadRequestException({
            statusCode: 400,
            codigo: 'PRODUCTOS_NO_ENCONTRADOS',
            mensaje:
              'Algunos productos ya no estan en el catalogo. Actualiza la lista y vuelve a elegirlos.',
            productos: resultado.codes,
          });
      }
    }
    return {
      ...(await this.detalle(id)),
      agregados: resultado.agregados,
      yaEstaban: resultado.yaEstaban,
    };
  }

  /**
   * Quita varios productos. POST y no DELETE: lleva body con la lista. Las
   * cargas ya creadas no cambian (ver `QuitarProductosDePlantillaUseCase`).
   */
  @Post(':id/productos/quitar')
  @HttpCode(200)
  async quitarProductos(
    @Param('id', new ZodValidationPipe(IdSchema)) id: string,
    @Body(new ZodValidationPipe(CodigosProductoSchema)) dto: CodigosProductoDto,
  ) {
    const resultado = await this.quitarProductosUseCase.ejecutar(id, dto.codes);
    if (!resultado.exito) throw new NotFoundException(NO_ENCONTRADA);
    return { ...(await this.detalle(id)), quitados: resultado.quitados };
  }

  /**
   * La ruta pasa a usar esta plantilla (cambia la de sus asignaciones
   * vigentes). Idempotente: asignarla dos veces deja lo mismo.
   */
  @Put(':id/rutas/:rutaId')
  @HttpCode(200)
  async asignarARuta(
    @Param('id', new ZodValidationPipe(IdSchema)) id: string,
    @Param('rutaId', new ZodValidationPipe(IdSchema)) rutaId: string,
  ) {
    const resultado = await this.asignarPlantillaUseCase.ejecutar({
      plantillaId: id,
      rutaId,
    });
    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'PLANTILLA_NO_ENCONTRADA':
          throw new NotFoundException(NO_ENCONTRADA);
        case 'RUTA_NO_ENCONTRADA':
          throw new NotFoundException({
            statusCode: 404,
            codigo: 'RUTA_NO_ENCONTRADA',
            mensaje: 'La ruta no existe o esta dada de baja.',
          });
        case 'PLANTILLA_INACTIVA':
          throw new ConflictException({
            statusCode: 409,
            codigo: 'PLANTILLA_INACTIVA',
            mensaje:
              'La plantilla esta desactivada. Activala antes de asignarla a una ruta.',
          });
        case 'RUTA_SIN_ASIGNACION_VIGENTE':
          throw new ConflictException({
            statusCode: 409,
            codigo: 'RUTA_SIN_ASIGNACION_VIGENTE',
            mensaje:
              'La ruta no tiene vendedor asignado. Asigna un vendedor a la ruta antes de elegir su plantilla.',
          });
      }
    }
    return this.detalle(id);
  }

  private async detalle(id: string) {
    const resultado = await this.verPlantillaUseCase.ejecutar(id);
    if (!resultado.exito) throw new NotFoundException(NO_ENCONTRADA);
    return resultado.plantilla;
  }
}

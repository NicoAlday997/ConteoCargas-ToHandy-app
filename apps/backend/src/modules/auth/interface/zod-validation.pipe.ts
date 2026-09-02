import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Pipe generico de validacion con zod.
 * Se construye con el esquema del endpoint y valida el body entrante.
 *
 * Si la validacion falla lanza `BadRequestException` con el cuerpo de error
 * estandar del proyecto (ver docs/04 seccion 1.7):
 *   { statusCode, mensaje, detalle }
 * `mensaje` es generico y en español para el usuario final; `detalle` lleva los
 * errores crudos de zod, utiles solo para depuracion.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const resultado = this.schema.safeParse(value);

    if (!resultado.success) {
      throw new BadRequestException({
        statusCode: 400,
        mensaje: 'Los datos enviados no son validos',
        detalle: resultado.error.issues,
      });
    }

    return resultado.data;
  }
}

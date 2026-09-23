import type {
  PermisoCargaRepository,
  PermisoCargaSinLiquidar,
} from './permiso-carga.repository';

/**
 * Caso de uso: el supervisor otorga un permiso puntual para que una ruta
 * inicie su carga INICIAL aunque el vendedor tenga la ruta anterior sin
 * liquidar en Handy (en la practica a veces liquidan un dia despues, o dos
 * dias juntos, pero el camion si tiene que cargar).
 *
 * El permiso vence a las 24 horas y es de un solo uso: un permiso permanente
 * equivaldria a quitar la regla. Por la misma razon no se acumulan: mientras
 * haya uno vigente sin usar para la ruta, no se otorga otro.
 *
 * El rol (solo SUPERVISOR) lo garantiza el controlador; `usuarioAppId` sale
 * del JWT.
 */

export const VIGENCIA_PERMISO_MS = 24 * 60 * 60 * 1000;

/** Un motivo de menos caracteres no deja nada auditable ("ok", "si"). */
export const LONGITUD_MINIMA_MOTIVO = 5;

export interface EntradaOtorgarPermisoCarga {
  rutaId: string;
  motivo: string;
  /** Supervisor que otorga el permiso. */
  usuarioAppId: string;
}

export type ResultadoOtorgarPermisoCarga =
  | { exito: true; permiso: PermisoCargaSinLiquidar }
  | { exito: false; motivo: 'MOTIVO_INVALIDO' | 'RUTA_NO_ENCONTRADA' }
  | { exito: false; motivo: 'YA_EXISTE_PERMISO_VIGENTE'; permisoId: string };

export class OtorgarPermisoCargaUseCase {
  constructor(private readonly permisos: PermisoCargaRepository) {}

  async ejecutar(
    entrada: EntradaOtorgarPermisoCarga,
    ahora: Date,
  ): Promise<ResultadoOtorgarPermisoCarga> {
    const motivo = entrada.motivo.trim();
    if (motivo.length < LONGITUD_MINIMA_MOTIVO) {
      return { exito: false, motivo: 'MOTIVO_INVALIDO' };
    }

    if (!(await this.permisos.existeRuta(entrada.rutaId))) {
      return { exito: false, motivo: 'RUTA_NO_ENCONTRADA' };
    }

    const vigente = await this.permisos.buscarVigente(entrada.rutaId, ahora);
    if (vigente !== null) {
      return {
        exito: false,
        motivo: 'YA_EXISTE_PERMISO_VIGENTE',
        permisoId: vigente.id,
      };
    }

    const permiso = await this.permisos.crear({
      rutaId: entrada.rutaId,
      otorgadoPorId: entrada.usuarioAppId,
      motivo,
      fechaOtorgado: ahora,
      fechaExpiracion: new Date(ahora.getTime() + VIGENCIA_PERMISO_MS),
    });
    return { exito: true, permiso };
  }
}

import { HasherPort } from '../../auth/application/hasher.port';
import {
  MOTIVO_MINIMO_SUPERVISOR,
  normalizarMotivo,
} from '../../cargas/application/cancelar-carga.use-case';
import { generarPinTemporal } from '../domain/generar-pin-temporal';
import { AdminUsuarioRepository } from './admin-usuario.repository';

/**
 * Por donde llega el restablecimiento. O sabemos quien, o sabemos por que:
 * - `SUPERVISOR`: desde la app; `restablecidoPor` sale del JWT.
 * - `LINEA_COMANDOS`: desde `npm run reestablecer-pin`, que no tiene sesion y
 *   nunca sabra quien lo corrio. Por eso el motivo es obligatorio (minimo
 *   `MOTIVO_MINIMO_SUPERVISOR`): es la unica traza de esa intervencion.
 */
export type AutorRestablecimiento =
  | { origen: 'SUPERVISOR'; restablecidoPor: string }
  | { origen: 'LINEA_COMANDOS'; motivo: string };

/**
 * Resultado del restablecimiento como union discriminada por `exito`.
 * En caso de exito se devuelve el PIN temporal EN CLARO para que el admin se lo
 * comunique al usuario (RF-09).
 */
export type ResultadoRestablecerPin =
  | { exito: true; pinTemporal: string }
  | { exito: false; motivo: 'USUARIO_NO_ENCONTRADO' | 'MOTIVO_REQUERIDO' };

/**
 * Caso de uso de restablecimiento de PIN (RF-09: solo administrativo, nunca
 * autoservicio). Capa de aplicacion: solo depende del dominio y de los puertos.
 */
export class RestablecerPinUseCase {
  constructor(
    private readonly usuarios: AdminUsuarioRepository,
    private readonly hasher: HasherPort,
  ) {}

  async ejecutar(
    usuarioAppId: string,
    autor: AutorRestablecimiento,
  ): Promise<ResultadoRestablecerPin> {
    // El motivo se valida antes de tocar nada.
    let motivo: string | null = null;
    if (autor.origen === 'LINEA_COMANDOS') {
      motivo = normalizarMotivo(autor.motivo);
      if (motivo === null || motivo.length < MOTIVO_MINIMO_SUPERVISOR) {
        return { exito: false, motivo: 'MOTIVO_REQUERIDO' };
      }
    }

    const usuario = await this.usuarios.buscarPorId(usuarioAppId);
    if (usuario === null) {
      return { exito: false, motivo: 'USUARIO_NO_ENCONTRADO' };
    }

    // PIN temporal nuevo: se genera, se hashea y se persiste solo el hash.
    const pinTemporal = generarPinTemporal();
    const pinHash = await this.hasher.hash(pinTemporal);

    // Se fuerza el cambio en el siguiente login (RF-08) y se levanta el
    // bloqueo por intentos: el mensaje de bloqueo del login remite al
    // supervisor justamente para esto (RF-03).
    await this.usuarios.actualizar(usuarioAppId, {
      pinHash,
      debeCambiarPin: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    });

    // Traza obligatoria: usuario afectado, quien o por que, y cuando (RF-10).
    await this.usuarios.registrarRestablecimientoPin(
      autor.origen === 'SUPERVISOR'
        ? {
            usuarioAppId,
            origen: 'SUPERVISOR',
            restablecidoPor: autor.restablecidoPor,
          }
        : { usuarioAppId, origen: 'LINEA_COMANDOS', motivo: motivo! },
    );

    return { exito: true, pinTemporal };
  }
}

import {
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import {
  SkipThrottle,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';

/**
 * Limites de peticiones por IP. La IP sale de `req.ip`, que detras del proxy
 * de Render es la del cliente solo porque `main.ts` activa `trust proxy` en
 * produccion; sin eso todas las peticiones llegarian con la IP del proxy y el
 * limite bloquearia a todos juntos.
 *
 * Ojo: los telefonos de la bodega conectados al mismo Wi-Fi salen a internet
 * con UNA sola IP publica y comparten estos contadores.
 */
export const LIMITE_GLOBAL = {
  nombre: 'global',
  limite: 100,
  ventanaMs: 60_000,
} as const;

/**
 * Login, cambio de PIN y confirmacion de discrepancias con PIN. Se suma al
 * bloqueo por intentos fallidos de `LoginUseCase` (que es por usuario): este
 * frena a quien prueba PINs contra muchos usuarios desde la misma IP.
 */
export const LIMITE_CREDENCIALES = {
  nombre: 'credenciales',
  limite: 20,
  ventanaMs: 60_000,
} as const;

const METADATO_LIMITE_CREDENCIALES = 'limite-credenciales';

/** Marca un endpoint que recibe un PIN: le aplica `LIMITE_CREDENCIALES`. */
export const LimiteCredenciales = () =>
  SetMetadata(METADATO_LIMITE_CREDENCIALES, true);

/** Exime al endpoint (o controlador) de todos los limites. Solo para `/salud`. */
export const SinLimiteDePeticiones = () =>
  SkipThrottle({
    [LIMITE_GLOBAL.nombre]: true,
    [LIMITE_CREDENCIALES.nombre]: true,
  });

function marcadoConLimiteCredenciales(contexto: ExecutionContext): boolean {
  return (
    Reflect.getMetadata(METADATO_LIMITE_CREDENCIALES, contexto.getHandler()) ===
    true
  );
}

/**
 * La llave del contador es solo nombre + IP. La de `@nestjs/throttler` por
 * defecto incluye controlador y metodo, lo que daria 100 por minuto POR
 * ENDPOINT en vez de 100 por minuto en total; y en credenciales, 20 intentos
 * de login MAS 20 de confirmacion en vez de 20 entre todos.
 */
const llavePorIp = (_contexto: ExecutionContext, ip: string, nombre: string) =>
  `${nombre}:${ip}`;

export function opcionesLimitesPeticiones(): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: LIMITE_GLOBAL.nombre,
        limit: LIMITE_GLOBAL.limite,
        ttl: LIMITE_GLOBAL.ventanaMs,
        generateKey: llavePorIp,
      },
      {
        name: LIMITE_CREDENCIALES.nombre,
        limit: LIMITE_CREDENCIALES.limite,
        ttl: LIMITE_CREDENCIALES.ventanaMs,
        generateKey: llavePorIp,
        skipIf: (contexto) => !marcadoConLimiteCredenciales(contexto),
      },
    ],
  };
}

/**
 * `ThrottlerGuard` con el cuerpo de error de la API (`{ statusCode, codigo,
 * mensaje }`, docs/04 §1.7) en vez del `{ message }` de la libreria, para que
 * la app muestre el mensaje como cualquier otro rechazo.
 */
@Injectable()
export class LimitePeticionesGuard extends ThrottlerGuard {
  protected override throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        codigo: 'DEMASIADAS_SOLICITUDES',
        mensaje:
          'Demasiadas solicitudes desde esta conexión. Espera un minuto e intenta de nuevo.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

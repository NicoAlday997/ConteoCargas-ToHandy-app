import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import {
  SkipThrottle,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';

/**
 * Limites de peticiones. Los numeros y por que son esos: docs/07-despliegue.md
 * ("Limites de peticiones").
 *
 * Los telefonos de la bodega conectados al mismo Wi-Fi salen a internet con
 * UNA sola IP publica (y con datos celulares varios pueden compartir la del
 * operador): todo limite por IP lo comparte la empresa entera. Por eso los
 * limites por IP son techos holgados contra abuso externo, y el limite que
 * frena a una persona va por usuario.
 *
 * La IP sale de `req.ip`, que detras del proxy de Render es la del cliente
 * solo porque `main.ts` activa `trust proxy` en produccion.
 */

/**
 * Todas las peticiones de una IP, entre todos los endpoints. Un conteo de 60
 * productos hace ~70 peticiones; a ritmo rapido, ~60 por minuto por telefono.
 * Las cinco rutas contando a la vez llegan a ~700 por minuto. Es una red contra
 * abuso desde fuera, no un control de capacidad: lo que protege de verdad es la
 * autenticacion y el limite por usuario.
 */
export const LIMITE_GLOBAL = {
  nombre: 'global',
  limite: 1000,
  ventanaMs: 60_000,
} as const;

/**
 * Login, cambio de PIN y confirmacion de discrepancias con PIN, por la persona
 * cuyo PIN se esta probando: quien machaca su PIN no frena a sus companeros.
 * No sustituye el bloqueo a los 5 PIN fallidos (`LoginUseCase`), que es la
 * proteccion real contra adivinar un PIN.
 */
export const LIMITE_CREDENCIALES_USUARIO = {
  nombre: 'credenciales-usuario',
  limite: 20,
  ventanaMs: 60_000,
} as const;

/**
 * Los mismos endpoints, por IP: red de seguridad contra quien prueba PINs de
 * muchos usuarios desde fuera. Holgado porque la bodega entera comparte IP.
 */
export const LIMITE_CREDENCIALES_IP = {
  nombre: 'credenciales-ip',
  limite: 150,
  ventanaMs: 60_000,
} as const;

const METADATO_LIMITE_CREDENCIALES = 'limite-credenciales';

/**
 * Marca un endpoint que recibe un PIN: le aplica `LIMITE_CREDENCIALES_USUARIO`
 * y `LIMITE_CREDENCIALES_IP`.
 */
export const LimiteCredenciales = () =>
  SetMetadata(METADATO_LIMITE_CREDENCIALES, true);

/** Exime al endpoint (o controlador) de todos los limites. Solo para `/salud`. */
export const SinLimiteDePeticiones = () =>
  SkipThrottle({
    [LIMITE_GLOBAL.nombre]: true,
    [LIMITE_CREDENCIALES_USUARIO.nombre]: true,
    [LIMITE_CREDENCIALES_IP.nombre]: true,
  });

function sinMarcaDeCredenciales(contexto: ExecutionContext): boolean {
  return (
    Reflect.getMetadata(METADATO_LIMITE_CREDENCIALES, contexto.getHandler()) !==
    true
  );
}

/** Los ids de usuario son cuid; cualquier otra cosa no se usa como llave. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

function idValido(valor: unknown): string | null {
  return typeof valor === 'string' && ID_VALIDO.test(valor) ? valor : null;
}

/**
 * `sub` del JWT SIN verificar la firma: aqui solo elige el contador. El
 * guard corre antes que `JwtAuthGuard`, que despues rechaza un token falso.
 */
function subDelToken(autorizacion: unknown): string | null {
  if (typeof autorizacion !== 'string') return null;
  const [esquema, token] = autorizacion.split(' ');
  if (esquema !== 'Bearer' || !token) return null;
  const carga = token.split('.')[1];
  if (!carga) return null;
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(carga, 'base64url').toString('utf8'),
    );
    return idValido((payload as { sub?: unknown } | null)?.sub);
  } catch {
    return null;
  }
}

/**
 * La persona cuyo PIN se prueba, en este orden:
 * - `usuarioAppId` del cuerpo (login);
 * - `confirmaUsuarioAppId` del cuerpo (confirmacion en el mismo telefono);
 * - el `sub` del token (cambio de PIN y confirmacion entre telefonos).
 * Sin ninguno, la peticion no es de la app (siempre manda uno) y cuenta
 * contra su IP.
 */
export function usuarioDeLaPeticion(req: Record<string, any>): string {
  const cuerpo = (req.body ?? {}) as Record<string, unknown>;
  const usuario =
    idValido(cuerpo.usuarioAppId) ??
    idValido(cuerpo.confirmaUsuarioAppId) ??
    subDelToken(req.headers?.authorization);
  return usuario ? `usuario:${usuario}` : `sin-usuario:${req.ip}`;
}

/**
 * La llave del contador es solo nombre + tracker. La de `@nestjs/throttler`
 * por defecto incluye controlador y metodo, lo que daria el limite POR
 * ENDPOINT en vez de en total; y en credenciales, 20 intentos de login MAS 20
 * de confirmacion en vez de 20 entre todos.
 */
const llave = (_contexto: ExecutionContext, tracker: string, nombre: string) =>
  `${nombre}:${tracker}`;

export function opcionesLimitesPeticiones(): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: LIMITE_GLOBAL.nombre,
        limit: LIMITE_GLOBAL.limite,
        ttl: LIMITE_GLOBAL.ventanaMs,
        generateKey: llave,
      },
      {
        name: LIMITE_CREDENCIALES_USUARIO.nombre,
        limit: LIMITE_CREDENCIALES_USUARIO.limite,
        ttl: LIMITE_CREDENCIALES_USUARIO.ventanaMs,
        getTracker: usuarioDeLaPeticion,
        generateKey: llave,
        skipIf: sinMarcaDeCredenciales,
      },
      {
        name: LIMITE_CREDENCIALES_IP.nombre,
        limit: LIMITE_CREDENCIALES_IP.limite,
        ttl: LIMITE_CREDENCIALES_IP.ventanaMs,
        generateKey: llave,
        skipIf: sinMarcaDeCredenciales,
      },
    ],
  };
}

/**
 * `ThrottlerGuard` con el cuerpo de error de la API (`{ statusCode, codigo,
 * mensaje }`, docs/04 §1.7) en vez del `{ message }` de la libreria, para que
 * la app muestre el mensaje como cualquier otro rechazo. Cada 429 queda en el
 * registro como advertencia: ruta, limite y llave (usuario o IP), nunca el
 * cuerpo ni encabezados, que traen PIN y token.
 */
@Injectable()
export class LimitePeticionesGuard extends ThrottlerGuard {
  private readonly registro = new Logger('LimitePeticiones');

  protected override throwThrottlingException(
    contexto: ExecutionContext,
    detalle: ThrottlerLimitDetail,
  ): Promise<void> {
    const req = contexto.switchToHttp().getRequest<Record<string, any>>();
    const ruta = String(req.originalUrl ?? req.url ?? '').split('?')[0];
    // La llave es `nombre:tracker` (ver `llave`); el nombre no lleva ':'.
    const separador = detalle.key.indexOf(':');
    const limite = detalle.key.slice(0, separador);
    const limitado = detalle.key.slice(separador + 1);
    this.registro.warn(
      `429 ${req.method} ${ruta} limite=${limite} ` +
        `(${detalle.limit} por ${detalle.ttl / 1000}s) llave=${limitado}`,
    );

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        codigo: 'DEMASIADAS_SOLICITUDES',
        mensaje:
          limite === LIMITE_CREDENCIALES_USUARIO.nombre
            ? 'Demasiados intentos con este usuario. Espera un minuto e intenta de nuevo.'
            : 'Demasiadas solicitudes desde esta conexión. Espera un minuto e intenta de nuevo.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

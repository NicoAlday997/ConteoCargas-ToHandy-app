import { RolApp } from '@prisma/client';

/**
 * Vista de un usuario para el panel de administracion (RF-05 .. RF-11).
 * NUNCA incluye `pinHash`: el adaptador hace un select explicito.
 */
export interface UsuarioAdmin {
  id: string;
  nombreCompleto: string;
  rolApp: RolApp;
  // El contrato de la capa de aplicacion maneja el id de Handy como numero;
  // la conversion desde/hacia el texto de la BD es cosa de la infraestructura.
  usuarioHandyId: number | null;
  activo: boolean;
  debeCambiarPin: boolean;
  fechaUltimoCambioPin: Date | null;
  /**
   * Fin del bloqueo por intentos fallidos (RF-03), tal como esta en la base:
   * puede ser una fecha ya pasada. Para saber si sigue bloqueado, ver
   * `bloqueoVigente`.
   */
  bloqueadoHasta: Date | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

/**
 * Datos para dar de alta un usuario (RF-07). El PIN temporal se genera y hashea
 * en el caso de uso; aqui solo llega su hash.
 */
export interface DatosCrearUsuario {
  nombreCompleto: string;
  rolApp: RolApp;
  usuarioHandyId: number | null;
  pinHash: string;
}

/**
 * Campos editables de un usuario. Todos opcionales: un PATCH toca solo lo que
 * viene en el body. `usuarioHandyId` distingue "no tocar" (ausente) de "quitar
 * el vinculo" (null).
 */
export interface DatosActualizarUsuario {
  nombreCompleto?: string;
  rolApp?: RolApp;
  usuarioHandyId?: number | null;
  activo?: boolean;
  debeCambiarPin?: boolean;
  pinHash?: string;
  intentosFallidos?: number;
  bloqueadoHasta?: Date | null;
}

/**
 * Traza de un restablecimiento de PIN (RF-10): o quien (supervisor), o por que
 * (linea de comandos). La base lo garantiza con dos CHECK.
 */
export type RegistroRestablecimientoPin =
  | { usuarioAppId: string; origen: 'SUPERVISOR'; restablecidoPor: string }
  | { usuarioAppId: string; origen: 'LINEA_COMANDOS'; motivo: string };

/** Traza de un desbloqueo manual: a quien, quien y cuanto le faltaba. */
export interface RegistroDesbloqueo {
  usuarioAppId: string;
  desbloqueadoPor: string;
  bloqueadoHasta: Date;
}

/** Quien hizo un movimiento de acceso desde la app. */
export interface AutorMovimiento {
  id: string;
  nombreCompleto: string;
}

/**
 * Un renglon del historial de acceso de una persona: un restablecimiento de
 * PIN (por un supervisor, o por linea de comandos con su motivo) o un bloqueo
 * quitado a mano (con hasta cuando iba). Solo lectura: nadie edita ni borra
 * estos renglones; una correccion seria un renglon nuevo.
 */
export type MovimientoAcceso =
  | {
      id: string;
      tipo: 'PIN_RESTABLECIDO';
      fecha: Date;
      origen: 'SUPERVISOR';
      autor: AutorMovimiento;
    }
  | {
      id: string;
      tipo: 'PIN_RESTABLECIDO';
      fecha: Date;
      origen: 'LINEA_COMANDOS';
      motivo: string;
    }
  | {
      id: string;
      tipo: 'BLOQUEO_QUITADO';
      fecha: Date;
      autor: AutorMovimiento;
      bloqueadoHasta: Date;
    };

export interface PaginaAccesos {
  items: MovimientoAcceso[];
  total: number;
  page: number;
  pageSize: number;
}

/** El usuario activo que ya ocupa una cuenta de Handy. */
export interface OcupanteCuentaHandy {
  id: string;
  nombreCompleto: string;
}

/**
 * Lo lanza `crear` o `actualizar` cuando la base de datos rechaza un segundo
 * usuario ACTIVO con la misma cuenta de Handy (indice unico parcial). Los casos
 * de uso validan antes, asi que esto solo pasa en una carrera entre dos
 * peticiones; se traduce al mismo rechazo `CUENTA_HANDY_YA_ASIGNADA`.
 */
export class CuentaHandyYaAsignadaError extends Error {
  constructor(readonly usuarioHandyId: number | null) {
    super('La cuenta de Handy ya esta asignada a otro usuario activo');
    this.name = 'CuentaHandyYaAsignadaError';
  }
}

/**
 * Lo lanza `actualizar` cuando, despues de aplicar el cambio y dentro de la
 * misma transaccion, ya no queda ningun supervisor activo; el cambio se
 * revierte. Los casos de uso validan antes con `politica-supervisores`, asi
 * que esto solo pasa en una carrera (dos supervisores desactivandose el uno
 * al otro al mismo tiempo); se traduce al mismo rechazo `ULTIMO_SUPERVISOR`.
 */
export class SinSupervisorActivoError extends Error {
  constructor() {
    super('El cambio dejaria el sistema sin ningun supervisor activo');
    this.name = 'SinSupervisorActivoError';
  }
}

/**
 * Puerto: que se necesita de la persistencia para administrar usuarios, no como
 * se hace. El adaptador Prisma vive en infrastructure/.
 */
export abstract class AdminUsuarioRepository {
  /** Lista completa, INCLUIDOS los inactivos (RF-11 preserva la trazabilidad). */
  abstract listarTodos(): Promise<UsuarioAdmin[]>;
  abstract crear(datos: DatosCrearUsuario): Promise<UsuarioAdmin>;
  /**
   * Si `datos` toca `activo` o `rolApp`, el adaptador revisa el estado
   * DESPUES del cambio y lanza `SinSupervisorActivoError` (sin aplicar nada)
   * si no queda ningun supervisor activo.
   */
  abstract actualizar(
    id: string,
    datos: DatosActualizarUsuario,
  ): Promise<UsuarioAdmin>;
  abstract buscarPorId(id: string): Promise<UsuarioAdmin | null>;
  /**
   * Pone el PIN temporal (con `debeCambiarPin = true`, sin intentos fallidos
   * ni bloqueo) y escribe el renglon del historial (RF-10) en una sola
   * transaccion: o quedan los dos o no queda ninguno. Un PIN restablecido sin
   * traza seria una intervencion invisible.
   */
  abstract restablecerPin(
    registro: RegistroRestablecimientoPin,
    pinHash: string,
  ): Promise<void>;
  /**
   * Quita el bloqueo por intentos (`intentosFallidos = 0`, `bloqueadoHasta =
   * null`) y escribe el renglon del historial en una sola transaccion: o
   * quedan los dos o no queda ninguno. Un acceso restaurado sin traza no diria
   * quien lo dio.
   */
  abstract desbloquear(registro: RegistroDesbloqueo): Promise<UsuarioAdmin>;
  /**
   * Restablecimientos de PIN y desbloqueos de esa persona en una sola lista,
   * del mas reciente al mas antiguo. `page`/`pageSize` ya vienen resueltos.
   */
  abstract listarAccesos(
    usuarioAppId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginaAccesos>;
  /**
   * Cuenta los `UsuarioApp` con `rolApp = SUPERVISOR` y `activo = true`. Lo usa
   * `politica-supervisores.ts` para impedir que una desactivacion o un cambio
   * de rol deje el sistema sin ningun supervisor activo.
   */
  abstract contarSupervisoresActivos(): Promise<number>;
  /**
   * El usuario ACTIVO vinculado a esa cuenta de Handy, sin contar a
   * `excluirId` (el que se esta editando). `null` si la cuenta esta libre.
   */
  abstract buscarActivoConCuentaHandy(
    usuarioHandyId: number,
    excluirId?: string,
  ): Promise<OcupanteCuentaHandy | null>;
  /** Nombre de la cuenta en el cache de Handy; `null` si no esta sincronizada. */
  abstract nombreCuentaHandy(usuarioHandyId: number): Promise<string | null>;
}

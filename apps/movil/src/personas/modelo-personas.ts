import type { RolApp } from '../api/auth';
import type { CuentaHandyApi, UsuarioAdminApi } from '../api/personas';
import { diaNegocio, formatearDia, horaNegocio } from '../conteo/fecha-operativa.ts';

/**
 * Reglas y textos de la pantalla de Personas. Puro (sin React) para poder
 * probarlo.
 */

export interface Persona {
  id: string;
  nombre: string;
  rol: RolApp;
  activo: boolean;
  usuarioHandyId: number | null;
  /** Foto de Handy de la cuenta vinculada (solo vendedores); `null`: iniciales. */
  fotoUrl: string | null;
  /** Aún no cambia su PIN temporal: no ha entrado nunca, o se le restableció. */
  pinPendiente: boolean;
  /**
   * Bloqueado por intentos fallidos de PIN, según el servidor al leer la
   * lista. Puede vencer mientras la pantalla está abierta: para mostrarlo,
   * pasar siempre por `bloqueoVigente` con la hora actual.
   */
  bloqueo: Bloqueo | null;
}

export interface Bloqueo {
  desde: Date;
  hasta: Date;
}

export interface GrupoPersonas {
  rol: RolApp;
  titulo: string;
  personas: Persona[];
}

const ORDEN_ROLES: readonly RolApp[] = ['VENDEDOR', 'CONTADOR', 'SUPERVISOR'];

const TITULOS_GRUPO: Record<RolApp, string> = {
  VENDEDOR: 'Vendedores',
  CONTADOR: 'Contadores',
  SUPERVISOR: 'Supervisores',
};

const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');

/** Descarta renglones incompletos y pega la foto de Handy de la cuenta vinculada. */
export function normalizarPersonas(usuarios: UsuarioAdminApi[] | null, cuentas: CuentaHandyApi[] | null): Persona[] {
  const fotos = new Map<number, string>();
  for (const c of cuentas ?? []) {
    if (typeof c.idHandy === 'number' && c.fotoUrl) fotos.set(c.idHandy, c.fotoUrl);
  }
  return (usuarios ?? []).flatMap((u) => {
    const nombre = u.nombreCompleto?.trim();
    if (!u.id || !nombre || !u.rolApp || !ORDEN_ROLES.includes(u.rolApp)) return [];
    const usuarioHandyId = typeof u.usuarioHandyId === 'number' ? u.usuarioHandyId : null;
    return [
      {
        id: u.id,
        nombre,
        rol: u.rolApp,
        activo: u.activo !== false,
        usuarioHandyId,
        fotoUrl: usuarioHandyId !== null ? (fotos.get(usuarioHandyId) ?? null) : null,
        pinPendiente: u.debeCambiarPin === true,
        bloqueo: leerBloqueo(u.bloqueo),
      },
    ];
  });
}

function leerBloqueo(api: UsuarioAdminApi['bloqueo']): Bloqueo | null {
  if (!api?.desde || !api.hasta) return null;
  const desde = new Date(api.desde);
  const hasta = new Date(api.hasta);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return null;
  return { desde, hasta };
}

// ---------------------------------------------------------------------------
// Bloqueo por intentos fallidos
// ---------------------------------------------------------------------------

/** El bloqueo de la persona si sigue corriendo a esta hora; `null` si ya puede entrar. */
export function bloqueoVigente(persona: Persona, ahora: number): Bloqueo | null {
  if (!persona.activo || !persona.bloqueo) return null;
  return persona.bloqueo.hasta.getTime() > ahora ? persona.bloqueo : null;
}

/** Minutos que le faltan, redondeados hacia arriba: con 20 segundos dice «1 min», nunca «0 min». */
export function minutosRestantes(bloqueo: Bloqueo, ahora: number): number {
  return Math.max(1, Math.ceil((bloqueo.hasta.getTime() - ahora) / 60_000));
}

/** «Bloqueado · 12 min». */
export function textoBloqueo(bloqueo: Bloqueo, ahora: number): string {
  return `Bloqueado · ${minutosRestantes(bloqueo, ahora)} min`;
}

/** «Hoy, 05:57» o «Jueves 24 de septiembre, 23:58»: cuándo se bloqueó, en la hora del negocio. */
export function textoInicioBloqueo(bloqueo: Bloqueo, ahora: number): string {
  const dia = diaNegocio(bloqueo.desde);
  const cuando = dia === diaNegocio(new Date(ahora)) ? 'Hoy' : formatearDia(dia);
  return `${cuando}, ${horaNegocio(bloqueo.desde)}`;
}

/** Quiénes están bloqueados a esta hora, el que más le falta primero. */
export function personasBloqueadas(personas: readonly Persona[], ahora: number): Persona[] {
  return personas
    .filter((p) => bloqueoVigente(p, ahora) !== null)
    .sort((a, b) => (b.bloqueo?.hasta.getTime() ?? 0) - (a.bloqueo?.hasta.getTime() ?? 0));
}

/** El aviso del inicio: «Carlos Ruiz no puede entrar» o «3 personas no pueden entrar». */
export function tituloAvisoBloqueados(bloqueadas: readonly Persona[]): string {
  if (bloqueadas.length === 1) return `${bloqueadas[0].nombre} no puede entrar`;
  return `${bloqueadas.length} personas no pueden entrar`;
}

/** Debajo del título: por qué, cuánto falta (si es una) y qué hacer. */
export function detalleAvisoBloqueados(bloqueadas: readonly Persona[], ahora: number): string {
  const primera = bloqueadas[0];
  const bloqueo = primera ? bloqueoVigente(primera, ahora) : null;
  if (bloqueadas.length === 1 && bloqueo) {
    return `Se equivocó de PIN 5 veces: le faltan ${minutosRestantes(bloqueo, ahora)} min de bloqueo. Quítaselo desde Personas.`;
  }
  return 'Se equivocaron de PIN 5 veces. Quítales el bloqueo desde Personas.';
}

// ---------------------------------------------------------------------------
// Un solo supervisor
// ---------------------------------------------------------------------------

/** `true` si hay exactamente un supervisor activo: si se bloquea, nadie puede autorizar cargas. */
export function hayUnSoloSupervisor(personas: readonly Persona[]): boolean {
  return personas.filter((p) => p.rol === 'SUPERVISOR' && p.activo).length === 1;
}

export const AVISO_UN_SOLO_SUPERVISOR =
  'Solo hay un supervisor activo. Si se bloquea o no está, nadie puede autorizar cargas ni quitar bloqueos. Conviene dar de alta a un segundo supervisor.';

/**
 * Vendedores, contadores y supervisores, en ese orden y solo los grupos con
 * alguien. Dentro de cada grupo, por nombre, y los inactivos al final.
 */
export function agruparPersonas(personas: readonly Persona[]): GrupoPersonas[] {
  return ORDEN_ROLES.flatMap((rol) => {
    const delRol = personas.filter((p) => p.rol === rol);
    if (delRol.length === 0) return [];
    const activos = delRol.filter((p) => p.activo).sort(porNombre);
    const inactivos = delRol.filter((p) => !p.activo).sort(porNombre);
    return [{ rol, titulo: TITULOS_GRUPO[rol], personas: [...activos, ...inactivos] }];
  });
}

/** "3 personas · 1 inactiva". */
export function detalleGrupo(personas: readonly Persona[]): string {
  const total = personas.length === 1 ? '1 persona' : `${personas.length} personas`;
  const inactivas = personas.filter((p) => !p.activo).length;
  if (inactivas === 0) return total;
  return `${total} · ${inactivas === 1 ? '1 inactiva' : `${inactivas} inactivas`}`;
}

export interface CuentaLibre {
  idHandy: number;
  nombre: string;
  fotoUrl: string | null;
}

/**
 * Las cuentas de Handy que se pueden ofrecer en el alta: habilitadas en Handy
 * y sin un usuario activo que ya las ocupe. Una cuenta de un vendedor dado de
 * baja SÍ se ofrece: es la ruta que va a recibir quien llega.
 */
export function cuentasLibres(cuentas: CuentaHandyApi[] | null): CuentaLibre[] {
  return (cuentas ?? [])
    .flatMap((c) => {
      const nombre = c.nombre?.trim();
      if (typeof c.idHandy !== 'number' || !nombre || c.activa === false || c.vinculadaA) return [];
      return [{ idHandy: c.idHandy, nombre, fotoUrl: c.fotoUrl ?? null }];
    })
    .sort(porNombre);
}

/** La línea bajo el selector de rol: por qué aparece (o no) la cuenta de Handy. */
export function ayudaRol(rol: RolApp): string {
  return rol === 'VENDEDOR'
    ? 'Elige su cuenta de Handy. Es la ruta que va a recibir.'
    : 'No necesita cuenta en Handy: solo usa esta app.';
}

export const SIN_CUENTAS_LIBRES = 'No hay cuentas de Handy disponibles. Da de alta al vendedor en Handy y sincroniza.';

export interface ErroresAlta {
  nombre: string | null;
  cuenta: string | null;
}

/**
 * Lo que impide guardar el alta. La cuenta solo cuenta para vendedor: al
 * cambiar de rol se olvida, así que un contador nunca viaja con una.
 */
export function validarAlta(datos: { nombre: string; rol: RolApp | null; cuentaId: number | null }): ErroresAlta & { rol: string | null } {
  return {
    nombre: datos.nombre.trim().length === 0 ? 'Escribe su nombre completo.' : null,
    rol: datos.rol === null ? 'Elige qué va a hacer en la app.' : null,
    cuenta: datos.rol === 'VENDEDOR' && datos.cuentaId === null ? 'Elige la cuenta de Handy del vendedor.' : null,
  };
}

/** El cuerpo exacto de `POST /admin/usuarios`: la cuenta de Handy solo si es vendedor. */
export function cuerpoAlta(datos: { nombre: string; rol: RolApp; cuentaId: number | null }) {
  return {
    nombreCompleto: datos.nombre.trim(),
    rolApp: datos.rol,
    ...(datos.rol === 'VENDEDOR' && datos.cuentaId !== null ? { usuarioHandyId: datos.cuentaId } : {}),
  };
}

/** Lo que se le dice al supervisor junto al PIN temporal. */
export function textoPinUnaVez(nombre: string): string {
  return `Este PIN se muestra una sola vez. Dáselo a ${nombre}; la primera vez que entre, la app le va a pedir que ponga el suyo.`;
}

/** La nota que acompaña a desactivar: el error más fácil de cometer y el más caro de deshacer. */
export const CONSEJO_DESACTIVAR =
  'Si se fue de la empresa, desactívalo y crea un usuario nuevo para quien llega. No reutilices este: el historial de cargas quedaría firmado con el nombre equivocado.';

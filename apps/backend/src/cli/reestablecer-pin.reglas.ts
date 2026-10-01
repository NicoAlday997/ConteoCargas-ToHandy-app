import {
  MOTIVO_MINIMO_SUPERVISOR,
  normalizarMotivo,
} from '../modules/cargas/application/cancelar-carga.use-case';

/**
 * Reglas puras de `npm run reestablecer-pin` (docs/07 §12): validar lo que se
 * escribio en la linea de comandos y decidir a quien se refiere. Nada de base
 * de datos ni de terminal aqui, para poder probarlo.
 */

/** Lo minimo de un usuario para buscarlo y mostrarlo antes de confirmar. */
export interface CandidatoRestablecer {
  id: string;
  nombreCompleto: string;
  rolApp: string;
  activo: boolean;
}

export type ArgumentosValidados =
  { ok: true; usuario: string; motivo: string } | { ok: false; error: string };

/**
 * `--usuario` y `--motivo` obligatorios. El motivo pide lo mismo que los
 * demas motivos del sistema (`MOTIVO_MINIMO_SUPERVISOR`): la linea de
 * comandos no tiene sesion, asi que es la unica traza de quien sabe por que.
 */
export function validarArgumentos(
  usuario: string | undefined,
  motivo: string | undefined,
): ArgumentosValidados {
  const nombre = usuario?.trim() ?? '';
  if (nombre === '') {
    return {
      ok: false,
      error:
        'Falta --usuario "NOMBRE COMPLETO" (o el id de la persona, si hay nombres parecidos).',
    };
  }
  const limpio = normalizarMotivo(motivo);
  if (limpio === null || limpio.length < MOTIVO_MINIMO_SUPERVISOR) {
    return {
      ok: false,
      error:
        `Falta --motivo "..." con al menos ${MOTIVO_MINIMO_SUPERVISOR} caracteres. ` +
        'Desde la linea de comandos nunca se sabra quien hizo el cambio: el motivo ' +
        'queda en el historial para siempre y es la unica explicacion que va a existir.',
    };
  }
  return { ok: true, usuario: nombre, motivo: limpio };
}

/** Sin acentos, sin mayusculas y con un solo espacio entre palabras. */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export type ResultadoBusqueda<T extends CandidatoRestablecer> =
  | { tipo: 'UNICO'; usuario: T }
  | { tipo: 'NINGUNO' }
  | { tipo: 'VARIOS'; coincidencias: T[] };

/**
 * A quien se refiere `buscado`:
 * - Si es exactamente el id de alguien, a esa persona (para desempatar).
 * - Si no, a todos cuyo nombre lo contiene (sin importar acentos ni
 *   mayusculas). Solo procede si hay exactamente una coincidencia; con varias
 *   no se adivina, aunque una sea identica: se listan y se pide el id.
 */
export function buscarCandidato<T extends CandidatoRestablecer>(
  usuarios: readonly T[],
  buscado: string,
): ResultadoBusqueda<T> {
  const porId = usuarios.find((u) => u.id === buscado.trim());
  if (porId !== undefined) {
    return { tipo: 'UNICO', usuario: porId };
  }
  const aguja = normalizarNombre(buscado);
  const coincidencias = usuarios.filter((u) =>
    normalizarNombre(u.nombreCompleto).includes(aguja),
  );
  if (coincidencias.length === 0) {
    return { tipo: 'NINGUNO' };
  }
  if (coincidencias.length > 1) {
    return { tipo: 'VARIOS', coincidencias };
  }
  return { tipo: 'UNICO', usuario: coincidencias[0] };
}

/**
 * La confirmacion es volver a escribir el nombre completo de la persona
 * encontrada (sin importar acentos ni mayusculas). Un pedazo no basta.
 */
export function confirmacionValida(
  usuario: CandidatoRestablecer,
  escrito: string,
): boolean {
  return (
    normalizarNombre(escrito) !== '' &&
    normalizarNombre(escrito) === normalizarNombre(usuario.nombreCompleto)
  );
}

/**
 * `host:puerto/base` de la cadena de conexion, sin usuario ni contrasena, para
 * que quien corre el comando vea a que base le va a escribir.
 */
export function describirBase(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    const puerto = url.port === '' ? '' : `:${url.port}`;
    return `${url.hostname}${puerto}${url.pathname}`;
  } catch {
    return '(cadena de conexion ilegible)';
  }
}

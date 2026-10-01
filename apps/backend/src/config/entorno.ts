import { z } from 'zod';

/**
 * Variables de entorno sin las que el servidor NO debe arrancar. Ninguna tiene
 * valor de respaldo en el codigo: si `JWT_SECRET` no llega, la app no puede
 * quedarse firmando tokens con un secreto conocido; mejor no levantar.
 *
 * Cada regla trae su explicacion para el mensaje de error. Los mensajes nunca
 * incluyen el valor recibido (podria ser un secreto a medias): solo el nombre
 * de la variable y que se esperaba.
 */
const REGLAS = {
  DATABASE_URL: {
    esquema: z.string().regex(/^postgres(ql)?:\/\//),
    explicacion: 'debe ser una cadena de conexion postgresql://',
  },
  JWT_SECRET: {
    esquema: z.string().min(32),
    explicacion: 'debe tener al menos 32 caracteres',
  },
  HANDY_API_TOKEN: {
    esquema: z.string(),
    explicacion: 'token de integracion de Handy',
  },
  HANDY_API_BASE_URL: {
    esquema: z.url({ protocol: /^https?$/ }),
    explicacion: 'debe ser una URL http(s)',
  },
  NODE_ENV: {
    esquema: z.enum(['development', 'production', 'test']),
    explicacion: 'debe ser development, production o test',
  },
  // Toda la fecha operativa se calcula en la zona del negocio; un servidor en
  // UTC sin esto pondria las cargas de la noche en el dia siguiente.
  TZ: {
    esquema: z.literal('America/Mexico_City'),
    explicacion: 'debe ser America/Mexico_City',
  },
} as const;

export type VariableObligatoria = keyof typeof REGLAS;

export const VARIABLES_OBLIGATORIAS = Object.keys(
  REGLAS,
) as VariableObligatoria[];

export interface ProblemaEntorno {
  variable: VariableObligatoria;
  tipo: 'falta' | 'invalida';
}

/**
 * Revisa las variables obligatorias. Vacia o solo espacios cuenta como que
 * falta (un `JWT_SECRET=""` en el panel es lo mismo que no ponerlo).
 */
export function revisarEntorno(
  entorno: Record<string, string | undefined>,
): ProblemaEntorno[] {
  const problemas: ProblemaEntorno[] = [];
  for (const variable of VARIABLES_OBLIGATORIAS) {
    const valor = entorno[variable];
    if (valor === undefined || valor.trim() === '') {
      problemas.push({ variable, tipo: 'falta' });
    } else if (!REGLAS[variable].esquema.safeParse(valor).success) {
      problemas.push({ variable, tipo: 'invalida' });
    }
  }
  return problemas;
}

/** Mensaje para el log de arranque: nombres y reglas, nunca valores. */
export function mensajeProblemasEntorno(problemas: ProblemaEntorno[]): string {
  const faltan = problemas.filter((p) => p.tipo === 'falta');
  const invalidas = problemas.filter((p) => p.tipo === 'invalida');
  const lineas = ['El servidor no arranca: revisa las variables de entorno.'];
  if (faltan.length > 0) {
    lineas.push(`Faltan: ${faltan.map((p) => p.variable).join(', ')}.`);
  }
  for (const { variable } of invalidas) {
    lineas.push(`${variable} no es valida: ${REGLAS[variable].explicacion}.`);
  }
  lineas.push('Ver apps/backend/.env.example y docs/07-despliegue.md.');
  return lineas.join('\n');
}

/**
 * Corre antes de que Nest levante (ver `main.ts`). Si algo falta, escribe el
 * motivo y termina el proceso con codigo 1, sin abrir el puerto: en Render el
 * despliegue queda marcado como fallido y sigue sirviendo la version anterior.
 */
export function exigirEntornoValido(
  entorno: Record<string, string | undefined> = process.env,
): void {
  const problemas = revisarEntorno(entorno);
  if (problemas.length === 0) return;
  console.error(mensajeProblemasEntorno(problemas));
  process.exit(1);
}

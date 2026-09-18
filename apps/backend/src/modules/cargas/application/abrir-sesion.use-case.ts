import type { TipoSesion, UbicacionConteo } from '@prisma/client';

import type { CargaRepository, SesionConteo } from './carga.repository';

/**
 * Caso de uso: el vendedor o el contador abre su sesion de conteo sobre un
 * evento de carga (docs/04 `POST /eventos-carga/:id/sesiones`). El tipo de
 * sesion (VENDEDOR o CONTADOR) lo decide el controlador segun el rol de quien
 * la abre; `ubicacion` solo aplica al segundo conteo de una recarga y es
 * puramente informativa.
 *
 * La verificacion de corte de venta pendiente (RF-13, docs/02 seccion 4.5) es
 * un chequeo previo exclusivo del CONTADOR que corre antes de este caso de
 * uso, en el controlador: si bloquea, ni siquiera se intenta abrir la sesion.
 *
 * Capa de aplicacion: solo depende del dominio y del puerto, nunca de
 * infraestructura (Prisma, HTTP, NestJS).
 */

export interface EntradaAbrirSesion {
  eventoId: string;
  usuarioAppId: string;
  tipo: TipoSesion;
  ubicacion?: UbicacionConteo;
}

/**
 * Resultado como union discriminada por `exito`.
 *
 * `YA_TIENE_SESION_EN_ESTE_EVENTO`: ese usuario ya tiene una sesion (abierta o
 * cerrada) sobre este evento. Sin este chequeo, el mismo vendedor podria abrir
 * dos sesiones de conteo sobre la misma carga y duplicar su conteo,
 * arruinando la comparacion contra el segundo conteo (RF-14).
 */
export type ResultadoAbrirSesion =
  | { exito: true; sesion: SesionConteo }
  | {
      exito: false;
      motivo: 'EVENTO_NO_ENCONTRADO' | 'YA_TIENE_SESION_EN_ESTE_EVENTO';
    };

export class AbrirSesionUseCase {
  constructor(private readonly cargas: CargaRepository) {}

  async ejecutar(entrada: EntradaAbrirSesion): Promise<ResultadoAbrirSesion> {
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento === null) {
      return { exito: false, motivo: 'EVENTO_NO_ENCONTRADO' };
    }

    // Una sola sesion por usuario por evento (abierta o cerrada): evita que la
    // misma persona duplique su conteo sobre la misma carga. Respaldado ademas
    // por `@@unique([eventoCargaId, usuarioAppId])` en el esquema.
    const sesiones = await this.cargas.listarSesionesDeEvento(entrada.eventoId);
    const yaTieneSesion = sesiones.some(
      (s) => s.usuarioAppId === entrada.usuarioAppId,
    );
    if (yaTieneSesion) {
      return { exito: false, motivo: 'YA_TIENE_SESION_EN_ESTE_EVENTO' };
    }

    const sesion = await this.cargas.crearSesion(
      entrada.eventoId,
      entrada.tipo,
      entrada.usuarioAppId,
      undefined,
      entrada.ubicacion,
    );

    return { exito: true, sesion };
  }
}

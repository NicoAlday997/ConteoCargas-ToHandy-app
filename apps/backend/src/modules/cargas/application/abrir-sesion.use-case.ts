import type { TipoSesion, UbicacionConteo } from '@prisma/client';

import type { CargaRepository, SesionConteo } from './carga.repository';
import type { VerificarCortePendienteUseCase } from './verificar-corte-pendiente.use-case';

/**
 * Caso de uso: el vendedor o el contador abre su sesion de conteo sobre un
 * evento de carga (docs/04 `POST /eventos-carga/:id/sesiones`). El tipo de
 * sesion (VENDEDOR o CONTADOR) lo decide el controlador segun el rol de quien
 * la abre; `ubicacion` solo aplica al segundo conteo de una recarga y es
 * puramente informativa.
 *
 * Aqui vive el bloqueo por liquidacion (RF-13, docs/01 seccion 6 regla 2;
 * docs/02 seccion 4.5): antes de abrir la sesion del CONTADOR se revisa que la
 * ruta anterior del vendedor este liquidada en Handy
 * (`VerificarCortePendienteUseCase`); si no, la carga queda
 * `BLOQUEADA_CORTE_PENDIENTE` y la sesion no se abre. La verificacion es la que
 * dispara la comparacion y lleva la carga hacia Handy, asi que no puede correr
 * con el corte del vendedor en desorden.
 *
 * El VENDEDOR nunca pasa por esa revision: su conteo es trabajo fisico que no
 * compromete nada, y a veces hay que cargar un camion sin liquidar (p. ej.
 * para moverlo en la bodega).
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
 *
 * `CORTE_PENDIENTE`: solo para el CONTADOR. El vendedor tiene la ruta anterior
 * sin liquidar en Handy (recien detectado, o la carga ya estaba bloqueada).
 */
export type ResultadoAbrirSesion =
  | { exito: true; sesion: SesionConteo }
  | {
      exito: false;
      motivo:
        | 'EVENTO_NO_ENCONTRADO'
        | 'YA_TIENE_SESION_EN_ESTE_EVENTO'
        | 'CORTE_PENDIENTE';
    };

export class AbrirSesionUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly verificarCorte: Pick<
      VerificarCortePendienteUseCase,
      'ejecutar'
    >,
  ) {}

  async ejecutar(
    entrada: EntradaAbrirSesion,
    ahora: Date,
  ): Promise<ResultadoAbrirSesion> {
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento === null) {
      return { exito: false, motivo: 'EVENTO_NO_ENCONTRADO' };
    }

    // Bloqueo por liquidacion: exclusivo del CONTADOR.
    if (entrada.tipo === 'CONTADOR') {
      // Ya bloqueada: sigue asi hasta que `DesbloquearCargaUseCase` confirme
      // en Handy que el vendedor liquido.
      if (evento.estado === 'BLOQUEADA_CORTE_PENDIENTE') {
        return { exito: false, motivo: 'CORTE_PENDIENTE' };
      }
      const verificacion = await this.verificarCorte.ejecutar(
        { eventoId: entrada.eventoId },
        ahora,
      );
      if (verificacion.exito && verificacion.bloqueado) {
        return { exito: false, motivo: 'CORTE_PENDIENTE' };
      }
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

import type { TipoCarga } from '@prisma/client';

import type { AsignacionRepository } from './asignacion.repository';
import type {
  CargaRepository,
  EventoCarga,
  SesionConteo,
} from './carga.repository';

/**
 * Caso de uso: el vendedor inicia una carga (inicial o recarga) de SU ruta
 * (RF-12, docs/04 `POST /eventos-carga`).
 *
 * El vendedor no elige ruta: la ruta y la plantilla salen de su asignacion
 * vigente y se copian al evento como SNAPSHOT, de modo que el historial siga
 * mostrando el catalogo correcto aunque despues lo reasignen.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos, nunca de
 * infraestructura (Prisma, HTTP, NestJS).
 */

/** Datos que el controlador extrae del request y del JWT. */
export interface EntradaIniciarCarga {
  usuarioAppId: string;
  tipo: TipoCarga;
  /**
   * Id del vendedor en Handy. Viaja en el JWT (docs/04 seccion 1: el token
   * contiene `usuario_handy_id`) y no puede derivarse de la asignacion de ruta,
   * que solo conoce ruta y plantilla.
   */
  usuarioHandyId: number;
}

/**
 * Resultado como union discriminada por `exito`.
 *
 * - `SIN_RUTA_ASIGNADA`: el vendedor no tiene asignacion vigente. Sin ruta no
 *   puede contar; el evento no se crea.
 * - `YA_TIENE_CARGA_ABIERTA`: reservado para cuando el puerto exponga la
 *   consulta de eventos abiertos del dia (docs/04 `GET /eventos-carga/
 *   cola-verificacion`). Hoy no es alcanzable porque no hay forma de consultarlo
 *   sin salir del contrato del puerto.
 */
export type ResultadoIniciarCarga =
  | { exito: true; evento: EventoCarga; sesion: SesionConteo }
  | { exito: false; motivo: 'SIN_RUTA_ASIGNADA' | 'YA_TIENE_CARGA_ABIERTA' };

export class IniciarCargaUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly asignaciones: AsignacionRepository,
  ) {}

  async ejecutar(
    entrada: EntradaIniciarCarga,
    ahora: Date,
  ): Promise<ResultadoIniciarCarga> {
    // 1. La asignacion vigente define ruta y plantilla. Sin ella no hay carga.
    const asignacion = await this.asignaciones.buscarAsignacionVigente(
      entrada.usuarioAppId,
    );
    if (asignacion === null) {
      return { exito: false, motivo: 'SIN_RUTA_ASIGNADA' };
    }

    // 2. Evento en BORRADOR. rutaId y plantillaId quedan como snapshot; hoy
    //    todas las rutas operan en AUTOVENTA (docs/02 seccion 3).
    const evento = await this.cargas.crearEvento({
      rutaId: asignacion.rutaId,
      plantillaId: asignacion.plantillaId,
      tipo: entrada.tipo,
      usuarioHandyId: entrada.usuarioHandyId,
      tipoOperacion: 'AUTOVENTA',
      fechaConteo: ahora,
    });

    // 3. Sesion del primer conteo. En autoventa el primero siempre es el
    //    vendedor; el contador abrira la suya al verificar.
    const sesion = await this.cargas.crearSesion(
      evento.id,
      'VENDEDOR',
      entrada.usuarioAppId,
    );

    return { exito: true, evento, sesion };
  }
}

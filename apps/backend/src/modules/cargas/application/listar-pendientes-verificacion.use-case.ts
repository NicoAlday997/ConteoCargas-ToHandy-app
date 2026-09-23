import type { TipoCarga } from '@prisma/client';

import type { ConsultasCargaRepository } from './consultas-carga.repository';

/**
 * Caso de uso: la cola del contador (docs/06 seccion 3.3). Lista las cargas que
 * el vendedor ya conto y esperan el segundo conteo, incluidas las bloqueadas por
 * corte de venta pendiente (se ven, pero no se pueden verificar).
 *
 * Solo informa CUANTOS productos registro el primer conteo, nunca cuantas piezas
 * de cada uno: el segundo conteo es a ciegas (CLAUDE.md, doble verificacion).
 *
 * Si otra persona ya empezo el segundo conteo de una carga, se indica quien: dos
 * contadores sobre la misma carga duplicarian el trabajo, y el segundo en llegar
 * no podria finalizar igual.
 *
 * Capa de aplicacion: solo depende del puerto, nunca de infraestructura.
 */

export type EstadoVerificacion =
  /** Nadie la ha empezado: se puede tomar. */
  | 'LISTA'
  /** El vendedor tiene un corte de venta pendiente en Handy. */
  | 'BLOQUEADA_CORTE_PENDIENTE'
  /** Quien consulta ya la empezo: se continua con `miSesionId`. */
  | 'EN_CURSO_PROPIA'
  /** Otra persona la esta verificando. */
  | 'EN_CURSO_OTRO';

export interface CargaEnColaVerificacion {
  id: string;
  rutaNombre: string;
  vendedorNombre: string | null;
  tipo: TipoCarga;
  fechaConteo: Date | null;
  totalProductos: number;
  bloqueadaPorCorte: boolean;
  fechaBloqueoCortePendiente: Date | null;
  estadoVerificacion: EstadoVerificacion;
  /** Sesion propia ya abierta sobre la carga; `null` si no hay. */
  miSesionId: string | null;
  /** Nombre de quien la esta verificando, solo en `EN_CURSO_OTRO`. */
  verificandoPor: string | null;
}

export class ListarPendientesVerificacionUseCase {
  constructor(private readonly consultas: ConsultasCargaRepository) {}

  async ejecutar(entrada: {
    usuarioAppId: string;
  }): Promise<CargaEnColaVerificacion[]> {
    const cargas = await this.consultas.listarPendientesVerificacion();

    return cargas.map(({ sesionContador, ...carga }) => {
      const propia =
        sesionContador !== null &&
        sesionContador.usuarioAppId === entrada.usuarioAppId;
      const deOtro = sesionContador !== null && !propia;

      // El bloqueo manda: aunque ya haya sesion, no se puede verificar.
      let estadoVerificacion: EstadoVerificacion = 'LISTA';
      if (carga.bloqueadaPorCorte)
        estadoVerificacion = 'BLOQUEADA_CORTE_PENDIENTE';
      else if (propia) estadoVerificacion = 'EN_CURSO_PROPIA';
      else if (deOtro) estadoVerificacion = 'EN_CURSO_OTRO';

      return {
        ...carga,
        estadoVerificacion,
        miSesionId: propia ? sesionContador.id : null,
        verificandoPor: deOtro ? sesionContador.usuarioNombre : null,
      };
    });
  }
}

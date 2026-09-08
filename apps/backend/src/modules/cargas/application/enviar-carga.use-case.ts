import type { EstadoCarga } from '@prisma/client';

import {
  HandyErrorServidorError,
  HandyGateway,
  HandySinRespuestaError,
  HandyTokenInvalidoError,
  type ItemRutaHandy,
  type RespuestaCrearRuta,
} from '../../sincronizacion/application/handy.gateway';
import { puedeTransicionar } from '../domain/estados-carga';
import type { CargaRepository, EventoCarga } from './carga.repository';

/**
 * Caso de uso: enviar a Handy una carga ya conciliada por el doble conteo
 * (docs/04 `POST /eventos-carga/:id/enviar`; docs/02 seccion 4).
 *
 * Concentra la defensa contra el riesgo tecnico numero 1 (docs/02 seccion 7):
 * NO duplicar rutas al reintentar un envio incierto. Si el evento viene de
 * `ENVIO_INCIERTO`, antes de tocar Handy se consulta `route/current`; si la ruta
 * ya existe, el evento se concilia a `ENVIADA` sin reenviar nada.
 *
 * Transiciones: todas pasan por la maquina de estados del dominio
 * (`puedeTransicionar`). El unico camino a `ENVIADA` es
 * `LISTA_PARA_ENVIAR -> ENVIADA`, asi que un reintento desde `ERROR_ENVIO` o
 * `ENVIO_INCIERTO` primero vuelve a `LISTA_PARA_ENVIAR` (docs/02 seccion 3.1).
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos
 * (`CargaRepository`, `HandyGateway`), nunca de infraestructura. Los errores de
 * infraestructura llegan como excepciones tipadas del puerto y se traducen aca a
 * una transicion de estado + una bandera de alerta.
 */

/** Datos que el controlador extrae del request y del JWT. */
export interface EntradaEnviarCarga {
  eventoId: string;
  /**
   * Id del usuario de la app que dispara el envio (viaja en el JWT). Se conserva
   * para trazabilidad; el control de permisos por rol lo hace el controlador.
   */
  usuarioAppId: string;
}

/**
 * Resultado como union discriminada por `exito`.
 *
 * Exito:
 * - `idHandy`: id de la ruta en Handy (nueva, o la que ya existia).
 * - `yaExistia`: `true` solo cuando el evento estaba en `ENVIO_INCIERTO` y
 *   `route/current` revelo que la ruta ya se habia creado en el intento previo;
 *   no se reenvio nada.
 * - `productosRechazados`: `code`s que Handy rechazo por inventario y quedaron
 *   fuera de la ruta; el resto SI se envio. `[]` si no hubo ninguno.
 * - `generarAlertaInventario`: `true` si `productosRechazados` no esta vacio
 *   (alerta de urgencia media, docs/02 seccion 6).
 *
 * Rechazos:
 * - `ESTADO_INVALIDO`: el evento no existe, o su estado no admite envio (solo
 *   `LISTA_PARA_ENVIAR`, `ERROR_ENVIO` o `ENVIO_INCIERTO`).
 * - `ENVIO_INCIERTO`: timeout / sin respuesta / 5xx de Handy; no se sabe si la
 *   ruta se creo. El evento queda en `ENVIO_INCIERTO`. `generarAlertaAlta`.
 * - `ERROR_ENVIO`: token de Handy invalido o expirado; no lo resuelve el usuario
 *   operativo. El evento queda en `ERROR_ENVIO`. `generarAlertaAlta`.
 * - `INVENTARIO_INSUFICIENTE_TOTAL`: Handy rechazo por inventario todos los
 *   productos; no se creo ninguna ruta y el evento sigue `LISTA_PARA_ENVIAR`.
 *   `generarAlertaInventario`.
 */
export type ResultadoEnviarCarga =
  | {
      exito: true;
      idHandy: string;
      yaExistia: boolean;
      productosRechazados: string[];
      generarAlertaInventario: boolean;
    }
  | { exito: false; motivo: 'ESTADO_INVALIDO' }
  | {
      exito: false;
      motivo: 'ENVIO_INCIERTO' | 'ERROR_ENVIO';
      generarAlertaAlta: true;
    }
  | {
      exito: false;
      motivo: 'INVENTARIO_INSUFICIENTE_TOTAL';
      productosRechazados: string[];
      generarAlertaInventario: true;
    };

/** Estados desde los que tiene sentido (re)enviar una carga. */
const ESTADOS_QUE_PERMITEN_ENVIO: ReadonlySet<EstadoCarga> = new Set<EstadoCarga>(
  ['LISTA_PARA_ENVIAR', 'ERROR_ENVIO', 'ENVIO_INCIERTO'],
);

export class EnviarCargaUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly handy: HandyGateway,
  ) {}

  async ejecutar(
    entrada: EntradaEnviarCarga,
    ahora: Date,
  ): Promise<ResultadoEnviarCarga> {
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento === null || !ESTADOS_QUE_PERMITEN_ENVIO.has(evento.estado)) {
      return { exito: false, motivo: 'ESTADO_INVALIDO' };
    }

    try {
      // 1. ENVIO_INCIERTO: antes de reintentar hay que descartar que la ruta ya
      //    se haya creado en el intento anterior (docs/02 seccion 7, riesgo 1).
      if (evento.estado === 'ENVIO_INCIERTO') {
        const rutaExistente = await this.handy.consultarRutaAbierta(
          evento.usuarioHandyId,
        );
        if (rutaExistente !== null) {
          await this.conciliarComoEnviada(evento, rutaExistente.id, ahora);
          return {
            exito: true,
            idHandy: rutaExistente.id,
            yaExistia: true,
            productosRechazados: [],
            generarAlertaInventario: false,
          };
        }
      }

      // 2. Reintento desde ERROR_ENVIO / ENVIO_INCIERTO: volver a
      //    LISTA_PARA_ENVIAR, unico origen valido de la transicion a ENVIADA.
      const enLista = await this.normalizarALista(evento);

      // 3. Cantidades finales: la del conteo si coincidio, la cantidad final
      //    acordada si hubo discrepancia resuelta.
      const productos = await this.construirProductos(enLista.id);
      if (productos.length === 0) {
        // Un evento listo para enviar sin un solo producto es una
        // inconsistencia; no se manda una ruta vacia a Handy.
        return { exito: false, motivo: 'ESTADO_INVALIDO' };
      }

      // 4. Enviar segun el tipo, aislando el inventario insuficiente.
      const envio = await this.enviarAislando(enLista, productos);
      if (!envio.exito) {
        return envio.resultado;
      }

      // 5. Exito: registrar el idHandy y pasar a ENVIADA.
      await this.conciliarComoEnviada(enLista, envio.idHandy, ahora);
      return {
        exito: true,
        idHandy: envio.idHandy,
        yaExistia: false,
        productosRechazados: envio.productosRechazados,
        generarAlertaInventario: envio.productosRechazados.length > 0,
      };
    } catch (error) {
      return this.manejarFalloDeEnvio(error, entrada.eventoId);
    }
  }

  /**
   * Envia la carga (`crearRuta` para INICIAL, `recargarRuta` para RECARGA) y,
   * si Handy rechaza productos por inventario, los aisla y reenvia el resto una
   * sola vez. Un segundo rechazo —o que el aislamiento no deje nada que
   * enviar— termina sin crear ruta.
   */
  private async enviarAislando(
    evento: EventoCarga,
    productos: ItemRutaHandy[],
  ): Promise<
    | { exito: true; idHandy: string; productosRechazados: string[] }
    | { exito: false; resultado: ResultadoEnviarCarga }
  > {
    const rechazados = new Set<string>();
    let restantes = productos;
    let respuesta = await this.enviarSegunTipo(evento, restantes);

    if (respuesta.estado === 'INVENTARIO_INSUFICIENTE') {
      for (const code of respuesta.productosRechazados) {
        rechazados.add(code);
      }
      restantes = restantes.filter((p) => !rechazados.has(p.product));
      if (restantes.length > 0) {
        respuesta = await this.enviarSegunTipo(evento, restantes);
      }
    }

    if (respuesta.estado === 'INVENTARIO_INSUFICIENTE') {
      // Segundo rechazo, o el aislamiento dejo la ruta sin productos: no se
      // insiste mas y no se crea ninguna ruta.
      for (const code of respuesta.productosRechazados) {
        rechazados.add(code);
      }
      return {
        exito: false,
        resultado: {
          exito: false,
          motivo: 'INVENTARIO_INSUFICIENTE_TOTAL',
          productosRechazados: [...rechazados],
          generarAlertaInventario: true,
        },
      };
    }

    return {
      exito: true,
      idHandy: respuesta.idHandy,
      productosRechazados: [...rechazados],
    };
  }

  private enviarSegunTipo(
    evento: EventoCarga,
    productos: ItemRutaHandy[],
  ): Promise<RespuestaCrearRuta> {
    if (evento.tipo === 'RECARGA') {
      return this.handy.recargarRuta(evento.usuarioHandyId, productos);
    }
    return this.handy.crearRuta(evento.usuarioHandyId, {
      products: productos,
      // Autoventa pura: sin pedidos de preventa. `initialAmount` no se envia
      // (movimientos de efectivo fuera de alcance, docs/01 seccion 2.2).
      salesOrders: [],
    });
  }

  /**
   * Reconstruye las cantidades a enviar a partir de los dos conteos cerrados y
   * de las discrepancias resueltas del evento.
   */
  private async construirProductos(
    eventoId: string,
  ): Promise<ItemRutaHandy[]> {
    const sesiones = await this.cargas.listarSesionesDeEvento(eventoId);
    const sesionVendedor = sesiones.find((s) => s.tipo === 'VENDEDOR');
    const sesionSegundoConteo = sesiones.find(
      (s) => s.estado === 'CERRADA' && s.id !== sesionVendedor?.id,
    );
    if (sesionVendedor === undefined || sesionSegundoConteo === undefined) {
      throw new Error(
        `EnviarCargaUseCase: el evento ${eventoId} no tiene los dos conteos cerrados`,
      );
    }

    const cantidades = new Map<string, number>();
    for (const item of await this.cargas.listarItemsDeSesion(
      sesionVendedor.id,
    )) {
      cantidades.set(item.productoCode, item.cantidad);
    }
    for (const item of await this.cargas.listarItemsDeSesion(
      sesionSegundoConteo.id,
    )) {
      // El segundo conteo solo aporta productos que el primero no listo. Si
      // difieren, hay discrepancia y manda la cantidad final resuelta (abajo).
      if (!cantidades.has(item.productoCode)) {
        cantidades.set(item.productoCode, item.cantidad);
      }
    }
    for (const d of await this.cargas.listarDiscrepancias(eventoId)) {
      if (d.cantidadFinal !== null) {
        cantidades.set(d.productoCode, d.cantidadFinal);
      }
    }

    return [...cantidades.entries()]
      .filter(([, cantidad]) => cantidad > 0)
      .map(([product, quantity]) => ({ product, quantity }));
  }

  /** Lleva el evento a `LISTA_PARA_ENVIAR` si no lo esta ya. */
  private async normalizarALista(evento: EventoCarga): Promise<EventoCarga> {
    if (evento.estado === 'LISTA_PARA_ENVIAR') {
      return evento;
    }
    if (!puedeTransicionar(evento.estado, 'LISTA_PARA_ENVIAR')) {
      // ERROR_ENVIO y ENVIO_INCIERTO siempre pueden; guardarrail defensivo.
      throw new Error(
        `EnviarCargaUseCase: transicion invalida ${evento.estado} -> LISTA_PARA_ENVIAR`,
      );
    }
    return this.cargas.cambiarEstado(evento.id, 'LISTA_PARA_ENVIAR');
  }

  /**
   * Deja el evento en `ENVIADA` con su `idHandy`, pasando por
   * `LISTA_PARA_ENVIAR` si hiciera falta y validando cada salto con la maquina
   * de estados.
   */
  private async conciliarComoEnviada(
    evento: EventoCarga,
    idHandy: string,
    ahora: Date,
  ): Promise<void> {
    const enLista = await this.normalizarALista(evento);
    if (!puedeTransicionar(enLista.estado, 'ENVIADA')) {
      // Inalcanzable con la maquina de estados actual; guardarrail defensivo.
      throw new Error(
        `EnviarCargaUseCase: transicion invalida ${enLista.estado} -> ENVIADA`,
      );
    }
    await this.cargas.marcarComoEnviada(enLista.id, idHandy, ahora);
  }

  /**
   * Traduce una excepcion del puerto de Handy a una transicion de estado y un
   * resultado con la bandera de alerta correspondiente. Cualquier error que no
   * sea del contrato del puerto se relanza: el evento queda en
   * `LISTA_PARA_ENVIAR` (reintentable) y el fallo sube al filtro global.
   */
  private async manejarFalloDeEnvio(
    error: unknown,
    eventoId: string,
  ): Promise<ResultadoEnviarCarga> {
    const esTokenInvalido = error instanceof HandyTokenInvalidoError;
    const esSinRespuesta =
      error instanceof HandySinRespuestaError ||
      error instanceof HandyErrorServidorError;
    if (!esTokenInvalido && !esSinRespuesta) {
      throw error;
    }

    const destino: EstadoCarga = esTokenInvalido
      ? 'ERROR_ENVIO'
      : 'ENVIO_INCIERTO';
    const evento = await this.cargas.buscarEventoPorId(eventoId);
    if (evento !== null) {
      await this.transicionarHacia(evento, destino);
    }

    return esTokenInvalido
      ? { exito: false, motivo: 'ERROR_ENVIO', generarAlertaAlta: true }
      : { exito: false, motivo: 'ENVIO_INCIERTO', generarAlertaAlta: true };
  }

  /**
   * Mueve el evento hacia `destino` (`ERROR_ENVIO` o `ENVIO_INCIERTO`)
   * respetando la maquina de estados: como no hay salto directo entre esos dos,
   * el paso legal es via `LISTA_PARA_ENVIAR`.
   */
  private async transicionarHacia(
    evento: EventoCarga,
    destino: EstadoCarga,
  ): Promise<void> {
    let actual = evento.estado;
    if (
      actual !== destino &&
      actual !== 'LISTA_PARA_ENVIAR' &&
      puedeTransicionar(actual, 'LISTA_PARA_ENVIAR')
    ) {
      await this.cargas.cambiarEstado(evento.id, 'LISTA_PARA_ENVIAR');
      actual = 'LISTA_PARA_ENVIAR';
    }
    if (actual !== destino && puedeTransicionar(actual, destino)) {
      await this.cargas.cambiarEstado(evento.id, destino);
    }
  }
}

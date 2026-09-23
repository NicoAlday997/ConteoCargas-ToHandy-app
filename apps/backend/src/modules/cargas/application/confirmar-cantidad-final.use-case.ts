import { puedeTransicionar } from '../domain/estados-carga';
import {
  confirmarCantidadFinal,
  todasResueltas,
  type EstadoDiscrepancia,
} from '../domain/resolver-discrepancia';
import type { CargaRepository, Discrepancia } from './carga.repository';
import type { VerificadorPin } from './verificador-pin.port';

/**
 * Caso de uso: paso 2 de la resolucion de una discrepancia (RF-15, docs/04
 * `PATCH /eventos-carga/:id/discrepancias/:productoCode/confirmar`). Una segunda
 * persona confirma con su propio PIN la cantidad final que otra capturo.
 *
 * REGLA CLAVE DEL SISTEMA (CLAUDE.md, docs/01 seccion 6 regla 3): ninguna
 * discrepancia se resuelve sin confirmacion cruzada. La misma persona no puede
 * capturar y confirmar. Ese rechazo lo hace el dominio (`confirmarCantidadFinal`
 * devuelve `AUTOCONFIRMACION_PROHIBIDA`) y este caso de uso NO persiste nada
 * cuando el dominio rechaza.
 *
 * El PIN se verifica aqui, en el momento de confirmar, y no se da por bueno
 * por el JWT: la sesion abierta en un dispositivo no prueba quien lo tiene en
 * la mano. Se verifica DESPUES de las reglas del dominio para que un intento
 * que igual seria rechazado (autoconfirmacion, ya confirmada) no gaste
 * intentos de PIN del usuario.
 *
 * Al confirmarse la ultima discrepancia pendiente del evento, este pasa a
 * `EN_ESPERA_AUTORIZACION` (RF-16): incluso conciliado, ninguna carga se envia
 * a Handy sin que un supervisor la autorice — el tercer par de ojos que cierra
 * el punto ciego de que ambos conteos se equivoquen igual (CLAUDE.md). La
 * transicion siempre se valida con `puedeTransicionar` del dominio.
 *
 * Capa de aplicacion: solo depende del dominio y de los puertos, nunca de
 * infraestructura (Prisma, HTTP, NestJS).
 */

/** Datos que el controlador extrae del request y del JWT. */
export interface EntradaConfirmarCantidadFinal {
  eventoId: string;
  productoCode: string;
  /** Id del usuario de la app que confirma (viaja en el JWT). */
  usuarioAppId: string;
  /** PIN que el usuario teclea al confirmar; se verifica contra el suyo. */
  pin: string;
  /**
   * Cantidad final que la persona VIO en pantalla al confirmar. Si alguien la
   * recapturo mientras tecleaba su PIN, se rechaza: nadie confirma una cantidad
   * que no vio.
   */
  cantidadFinal: number;
}

/**
 * Resultado como union discriminada por `exito`.
 *
 * En exito se devuelve la discrepancia ya persistida y `enEsperaAutorizacion`:
 * `true` si esta confirmacion resolvio la ultima discrepancia pendiente y el
 * evento quedo en `EN_ESPERA_AUTORIZACION`, a la espera de que un supervisor lo
 * autorice.
 *
 * Motivos de rechazo:
 * - `ESTADO_INVALIDO`: el evento no existe o no esta en `CONFLICTOS_PENDIENTES`.
 * - `DISCREPANCIA_NO_ENCONTRADA`: no hay discrepancia para ese `productoCode`.
 * - `AUTOCONFIRMACION_PROHIBIDA`: quien confirma es quien capturo (lo decide el
 *   dominio). Nada se persiste.
 * - `NO_HAY_CAPTURA_PREVIA`: nadie capturo la cantidad final todavia (lo decide
 *   el dominio).
 * - `YA_CONFIRMADA`: la discrepancia ya estaba confirmada (lo decide el dominio).
 * - `CANTIDAD_CAMBIO`: la cantidad capturada ya no es la que vio quien confirma
 *   (alguien la recapturo). Nada se persiste ni se verifica el PIN.
 * - `PIN_INCORRECTO` / `BLOQUEADO` / `INACTIVO`: el PIN no es el de quien
 *   confirma, o su usuario no puede autenticarse. Nada se persiste.
 */
export type ResultadoConfirmarCantidadFinal =
  | { exito: true; discrepancia: Discrepancia; enEsperaAutorizacion: boolean }
  | {
      exito: false;
      motivo:
        | 'ESTADO_INVALIDO'
        | 'DISCREPANCIA_NO_ENCONTRADA'
        | 'AUTOCONFIRMACION_PROHIBIDA'
        | 'NO_HAY_CAPTURA_PREVIA'
        | 'YA_CONFIRMADA'
        | 'CANTIDAD_CAMBIO';
    }
  | {
      exito: false;
      motivo: 'PIN_INCORRECTO';
      intentosRestantes: number | null;
    }
  | { exito: false; motivo: 'BLOQUEADO'; bloqueadoHasta: Date }
  | { exito: false; motivo: 'INACTIVO' };

/** Traduce la fila persistida al modelo puro del dominio. */
function aEstadoDiscrepancia(d: Discrepancia): EstadoDiscrepancia {
  return {
    productoCode: d.productoCode,
    cantidadPrimerConteo: d.cantidadVendedorOriginal,
    cantidadSegundoConteo: d.cantidadContadorOriginal,
    cantidadFinal: d.cantidadFinal ?? undefined,
    capturadaPorId: d.capturadaPor ?? undefined,
    confirmadaPorId: d.confirmadaPor ?? undefined,
  };
}

export class ConfirmarCantidadFinalUseCase {
  constructor(
    private readonly cargas: CargaRepository,
    private readonly verificadorPin: VerificadorPin,
  ) {}

  async ejecutar(
    entrada: EntradaConfirmarCantidadFinal,
    ahora: Date,
  ): Promise<ResultadoConfirmarCantidadFinal> {
    // 1. El evento debe existir y estar en CONFLICTOS_PENDIENTES.
    const evento = await this.cargas.buscarEventoPorId(entrada.eventoId);
    if (evento === null || evento.estado !== 'CONFLICTOS_PENDIENTES') {
      return { exito: false, motivo: 'ESTADO_INVALIDO' };
    }

    // 2. La discrepancia concreta tiene que existir dentro del evento.
    const discrepancias = await this.cargas.listarDiscrepancias(
      entrada.eventoId,
    );
    const discrepancia = discrepancias.find(
      (d) => d.productoCode === entrada.productoCode,
    );
    if (discrepancia === undefined) {
      return { exito: false, motivo: 'DISCREPANCIA_NO_ENCONTRADA' };
    }

    // 3. El dominio decide si la confirmacion es valida. Aca es donde se corta
    //    la autoconfirmacion: si rechaza, se sale sin tocar la persistencia.
    const resolucion = confirmarCantidadFinal(
      aEstadoDiscrepancia(discrepancia),
      entrada.usuarioAppId,
    );
    if (!resolucion.exito) {
      // `confirmarCantidadFinal` solo rechaza por estos tres motivos;
      // `CANTIDAD_INVALIDA` pertenece al paso de captura.
      if (
        resolucion.motivo === 'NO_HAY_CAPTURA_PREVIA' ||
        resolucion.motivo === 'AUTOCONFIRMACION_PROHIBIDA' ||
        resolucion.motivo === 'YA_CONFIRMADA'
      ) {
        return { exito: false, motivo: resolucion.motivo };
      }
      throw new Error(
        `confirmarCantidadFinal devolvio un motivo inesperado: ${resolucion.motivo}`,
      );
    }

    // 4. Solo se confirma la cantidad que la persona tiene a la vista.
    if (discrepancia.cantidadFinal !== entrada.cantidadFinal) {
      return { exito: false, motivo: 'CANTIDAD_CAMBIO' };
    }

    // 5. Quien confirma demuestra ser quien dice con su propio PIN. Un PIN
    //    incorrecto suma al mismo bloqueo temporal que el login.
    const pin = await this.verificadorPin.verificar(
      entrada.usuarioAppId,
      entrada.pin,
      ahora,
    );
    if (!pin.valido) {
      const { valido: _valido, ...rechazo } = pin;
      return { exito: false, ...rechazo };
    }

    // 6. Persistir la confirmacion cruzada (paso 2).
    const actualizada = await this.cargas.actualizarDiscrepancia(
      entrada.eventoId,
      entrada.productoCode,
      {
        confirmadaPor: entrada.usuarioAppId,
        fechaConfirmacion: ahora,
      },
    );

    // 7. Si con esto quedaron TODAS las discrepancias del evento resueltas, el
    //    evento avanza a EN_ESPERA_AUTORIZACION (RF-16), no a LISTA_PARA_ENVIAR:
    //    todavia falta que un supervisor autorice el envio. La transicion se
    //    valida siempre contra la maquina de estados del dominio.
    const tras = await this.cargas.listarDiscrepancias(entrada.eventoId);
    let enEsperaAutorizacion = false;
    if (
      todasResueltas(tras.map(aEstadoDiscrepancia)) &&
      puedeTransicionar(evento.estado, 'EN_ESPERA_AUTORIZACION')
    ) {
      await this.cargas.cambiarEstado(
        entrada.eventoId,
        'EN_ESPERA_AUTORIZACION',
      );
      enEsperaAutorizacion = true;
    }

    return { exito: true, discrepancia: actualizada, enEsperaAutorizacion };
  }
}

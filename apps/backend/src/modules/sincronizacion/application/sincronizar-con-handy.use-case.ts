import type { MotivoRetencion } from '../domain/desactivacion-por-ausencia';
import { AlertaRepository } from './alerta.repository';
import { HandyTokenInvalidoError } from './handy.gateway';
import {
  SincronizarCatalogoUseCase,
  type DesactivacionRetenida,
  type ResultadoSincronizarCatalogo,
} from './sincronizar-catalogo.use-case';
import {
  SincronizarVendedoresUseCase,
  type ResultadoSincronizarVendedores,
} from './sincronizar-vendedores.use-case';

/** Quien pidio la sincronizacion: el boton del supervisor o el trabajo de las 5:00. */
export type OrigenSincronizacion = 'MANUAL' | 'AUTOMATICA';

export interface ResultadoSincronizarConHandy {
  productos: ResultadoSincronizarCatalogo;
  /** `null` si los productos pasaron pero los vendedores fallaron. */
  vendedores: ResultadoSincronizarVendedores | null;
  /** El error de los vendedores cuando `vendedores` es `null`; si no, `null`. */
  errorVendedores: unknown;
  sincronizadoEn: Date;
}

/** Desenlace de la corrida automatica: nunca lanza, avisa por alerta. */
export type ResultadoCorridaAutomatica =
  | { exito: true; resultado: ResultadoSincronizarConHandy }
  | { exito: false; error: unknown };

/**
 * Caso de uso: la sincronizacion completa con Handy. Es EL MISMO para el
 * boton del supervisor (`POST /admin/sincronizacion`) y para la corrida
 * automatica diaria: si divergieran, un dia darian resultados distintos y
 * nadie sabria por que. Solo cambia a quien se avisa y como.
 *
 * Orden: primero productos, luego vendedores. Si productos falla, vendedores
 * no corre (el error se propaga). Si productos pasa y vendedores falla, el
 * resultado lleva lo de productos y el error de vendedores: a medias es mejor
 * que nada, pero hay que decirlo.
 *
 * Alertas (centro de alertas del supervisor, docs/02 seccion 6):
 *  - Desactivacion retenida por un candado: siempre, MEDIA. Nadie la ve en la
 *    respuesta del boton y significa que el catalogo local puede estar viejo.
 *  - Corrida automatica que deja empaques sin confirmar: MEDIA, con el conteo.
 *    En el boton no hace falta: el supervisor lo ve en la hoja de resultado.
 *  - Corrida automatica que falla: BAJA (ALTA si el token es invalido). No se
 *    reintenta: se espera a la corrida del dia siguiente o al boton.
 */
export class SincronizarConHandyUseCase {
  constructor(
    private readonly catalogo: SincronizarCatalogoUseCase,
    private readonly vendedores: SincronizarVendedoresUseCase,
    private readonly alertas: AlertaRepository,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  async ejecutar(
    origen: OrigenSincronizacion,
  ): Promise<ResultadoSincronizarConHandy> {
    const productos = await this.catalogo.ejecutar();
    if (productos.desactivacionRetenida) {
      await this.alertarRetencion('productos', productos.desactivacionRetenida);
    }

    let vendedores: ResultadoSincronizarVendedores | null = null;
    let errorVendedores: unknown = null;
    try {
      vendedores = await this.vendedores.ejecutar();
    } catch (error) {
      errorVendedores = error;
    }
    if (vendedores?.desactivacionRetenida) {
      await this.alertarRetencion('vendedores', vendedores.desactivacionRetenida);
    }

    if (origen === 'AUTOMATICA') {
      if (productos.sinConfirmarEmpaque > 0) {
        const n = productos.sinConfirmarEmpaque;
        await this.alertas.crear({
          tipo: 'EMPAQUES_SIN_CONFIRMAR',
          urgencia: 'MEDIA',
          mensaje:
            n === 1
              ? '1 producto no se puede contar hasta que confirmes como se vende.'
              : `${n} productos no se pueden contar hasta que confirmes como se venden.`,
        });
      }
      if (vendedores === null) {
        await this.alertarFallo(errorVendedores, 'los vendedores');
      }
    }

    return {
      productos,
      vendedores,
      errorVendedores,
      sincronizadoEn: this.reloj(),
    };
  }

  /**
   * La corrida de las 5:00. No lanza: si Handy no responde, deja la alerta y
   * espera al dia siguiente. Sin reintentos en bucle: si Handy esta caido,
   * insistir solo gasta el limite de peticiones y retrasa a quien si puede
   * resolverlo; el boton sigue disponible para forzarla.
   */
  async ejecutarAutomatica(): Promise<ResultadoCorridaAutomatica> {
    try {
      return { exito: true, resultado: await this.ejecutar('AUTOMATICA') };
    } catch (error) {
      await this.alertarFallo(error, 'el catalogo');
      return { exito: false, error };
    }
  }

  private async alertarFallo(error: unknown, que: string): Promise<void> {
    if (error instanceof HandyTokenInvalidoError) {
      await this.alertas.crear({
        tipo: 'TOKEN_HANDY_INVALIDO',
        urgencia: 'ALTA',
        mensaje: `La sincronizacion automatica no pudo actualizar ${que}: Handy rechazo el token de integracion. Hay que regenerarlo en el servidor.`,
      });
      return;
    }
    await this.alertas.crear({
      tipo: 'SINCRONIZACION_FALLIDA',
      urgencia: 'BAJA',
      mensaje: `La sincronizacion automatica no pudo actualizar ${que}: Handy no respondio. Se intentara de nuevo mañana a las 5:00; puedes forzarla desde "Sincronizar con Handy".`,
    });
  }

  private async alertarRetencion(
    que: 'productos' | 'vendedores',
    retencion: DesactivacionRetenida,
  ): Promise<void> {
    await this.alertas.crear({
      tipo: 'DESACTIVACION_RETENIDA',
      urgencia: 'MEDIA',
      mensaje: `Handy dejo de listar ${retencion.faltantes} de ${retencion.activos} ${que} activos ${POR_QUE[retencion.motivo]}. Por seguridad no se desactivo ninguno: revisa el catalogo en Handy.`,
    });
  }
}

const POR_QUE: Record<MotivoRetencion, string> = {
  SIN_REGISTROS: '(Handy respondio sin ningun registro)',
  PAGINACION_INCOMPLETA: '(llegaron menos registros de los que Handy reporto)',
  DEMASIADOS_FALTANTES: '(mas del 30 % de golpe)',
};

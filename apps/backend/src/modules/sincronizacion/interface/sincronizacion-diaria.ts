import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { SincronizarConCandadoUseCase } from '../application/sincronizar-con-candado.use-case';

/** 5:00 todos los dias: el catalogo ya esta fresco cuando llega el primer vendedor a las 6. */
export const CRON_SINCRONIZACION_DIARIA = '0 5 * * *';
export const ZONA_SINCRONIZACION_DIARIA = 'America/Mexico_City';

/**
 * `SINCRONIZACION_AUTOMATICA`: encendida salvo que diga explicitamente que no
 * (`false`, `0`, `no`, `off`). En desarrollo local estorba.
 */
export function sincronizacionAutomaticaEncendida(
  valor: string | undefined,
): boolean {
  if (valor === undefined) return true;
  return !['false', '0', 'no', 'off'].includes(valor.trim().toLowerCase());
}

/**
 * Disparador de la sincronizacion automatica diaria (docs/02 seccion 4.6).
 * Corre sin usuario: no pide rol ni token de app (el de Handy vive en el
 * servidor). Toda la logica, incluidas las alertas y la politica de no
 * reintentar, esta en `SincronizarConHandyUseCase.ejecutarAutomatica` (via
 * `SincronizarConCandadoUseCase`, que deja la corrida en la bitacora): aqui
 * solo se programa y se registra en el log.
 */
@Injectable()
export class SincronizacionDiaria implements OnModuleInit {
  private readonly logger = new Logger(SincronizacionDiaria.name);
  private readonly encendida: boolean;

  constructor(
    private readonly sincronizar: SincronizarConCandadoUseCase,
    config: ConfigService,
  ) {
    this.encendida = sincronizacionAutomaticaEncendida(
      config.get<string>('SINCRONIZACION_AUTOMATICA'),
    );
  }

  onModuleInit(): void {
    this.logger.log(
      this.encendida
        ? `Sincronizacion automatica con Handy: todos los dias a las 5:00 (${ZONA_SINCRONIZACION_DIARIA}).`
        : 'Sincronizacion automatica con Handy apagada (SINCRONIZACION_AUTOMATICA).',
    );
  }

  @Cron(CRON_SINCRONIZACION_DIARIA, {
    name: 'sincronizacion-diaria',
    timeZone: ZONA_SINCRONIZACION_DIARIA,
  })
  async correr(): Promise<void> {
    if (!this.encendida) return;
    try {
      const corrida = await this.sincronizar.ejecutarAutomatica();
      if (corrida.exito) {
        const { productos, vendedores } = corrida.resultado;
        this.logger.log(
          `Sincronizacion automatica: productos ${productos.nuevos} nuevos, ` +
            `${productos.actualizados} actualizados, ${productos.desactivados} desactivados, ` +
            `${productos.sinConfirmarEmpaque} sin empaque confirmado; ` +
            (vendedores
              ? `vendedores ${vendedores.nuevos} nuevos, ${vendedores.actualizados} actualizados, ${vendedores.desactivados} desactivados.`
              : 'vendedores fallaron (alerta registrada).'),
        );
      } else {
        this.logger.warn(
          `Sincronizacion automatica fallida; se reintentara mañana a las 5:00: ${String(
            (corrida.error as Error)?.message ?? corrida.error,
          )}`,
        );
      }
    } catch (error) {
      // Solo llega aqui si ni siquiera se pudo guardar la alerta.
      this.logger.error(
        'Sincronizacion automatica: fallo y no se pudo registrar la alerta',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

import type { AlertaRepository, NuevaAlerta } from './alerta.repository';
import {
  HandyErrorServidorError,
  HandyTokenInvalidoError,
} from './handy.gateway';
import type {
  ResultadoSincronizarCatalogo,
  SincronizarCatalogoUseCase,
} from './sincronizar-catalogo.use-case';
import { SincronizarConHandyUseCase } from './sincronizar-con-handy.use-case';
import type {
  ResultadoSincronizarVendedores,
  SincronizarVendedoresUseCase,
} from './sincronizar-vendedores.use-case';

/**
 * Pruebas del caso de uso que comparten el boton del supervisor y la corrida
 * automatica de las 5:00. Los dos casos de uso de sincronizacion van como
 * dobles: aqui importa el orden, que se hace con un fallo y a quien se avisa.
 */

const AHORA = new Date('2026-09-30T11:00:00.000Z');

function productos(
  over: Partial<ResultadoSincronizarCatalogo> = {},
): ResultadoSincronizarCatalogo {
  return {
    nuevos: 3,
    actualizados: 1,
    desactivados: 0,
    sinConfirmarEmpaque: 0,
    desactivacionRetenida: null,
    ...over,
  };
}

function vendedores(
  over: Partial<ResultadoSincronizarVendedores> = {},
): ResultadoSincronizarVendedores {
  return {
    nuevos: 0,
    actualizados: 1,
    desactivados: 0,
    desactivacionRetenida: null,
    ...over,
  };
}

class AlertasEnMemoria implements AlertaRepository {
  readonly creadas: NuevaAlerta[] = [];
  async crear(alerta: NuevaAlerta): Promise<void> {
    this.creadas.push(alerta);
  }
}

function armar(opciones: {
  productos?: () => Promise<ResultadoSincronizarCatalogo>;
  vendedores?: () => Promise<ResultadoSincronizarVendedores>;
}) {
  const orden: string[] = [];
  const catalogo = {
    ejecutar: jest.fn(async () => {
      orden.push('productos');
      return (opciones.productos ?? (async () => productos()))();
    }),
  } as unknown as SincronizarCatalogoUseCase;
  const vendedoresUc = {
    ejecutar: jest.fn(async () => {
      orden.push('vendedores');
      return (opciones.vendedores ?? (async () => vendedores()))();
    }),
  } as unknown as SincronizarVendedoresUseCase;
  const alertas = new AlertasEnMemoria();
  const useCase = new SincronizarConHandyUseCase(
    catalogo,
    vendedoresUc,
    alertas,
    () => AHORA,
  );
  return { useCase, alertas, orden, vendedoresUc };
}

describe('SincronizarConHandyUseCase', () => {
  it('sincroniza primero productos y luego vendedores', async () => {
    const { useCase, orden } = armar({});

    const resultado = await useCase.ejecutar('MANUAL');

    expect(orden).toEqual(['productos', 'vendedores']);
    expect(resultado).toEqual({
      productos: productos(),
      vendedores: vendedores(),
      errorVendedores: null,
      sincronizadoEn: AHORA,
    });
  });

  it('si productos falla, vendedores no corre y el error se propaga', async () => {
    const fallo = new HandyErrorServidorError('/product', 503);
    const { useCase, orden } = armar({
      productos: () => Promise.reject(fallo),
    });

    await expect(useCase.ejecutar('MANUAL')).rejects.toBe(fallo);
    expect(orden).toEqual(['productos']);
  });

  it('si vendedores falla, devuelve productos y el error de vendedores', async () => {
    const fallo = new HandyErrorServidorError('/user', 503);
    const { useCase } = armar({ vendedores: () => Promise.reject(fallo) });

    const resultado = await useCase.ejecutar('MANUAL');

    expect(resultado.productos).toEqual(productos());
    expect(resultado.vendedores).toBeNull();
    expect(resultado.errorVendedores).toBe(fallo);
  });

  describe('alertas', () => {
    it('el boton no alerta por empaques sin confirmar: el supervisor ya lo ve', async () => {
      const { useCase, alertas } = armar({
        productos: async () => productos({ sinConfirmarEmpaque: 3 }),
      });

      await useCase.ejecutar('MANUAL');

      expect(alertas.creadas).toEqual([]);
    });

    it('la corrida automatica alerta MEDIA si deja empaques sin confirmar', async () => {
      const { useCase, alertas } = armar({
        productos: async () => productos({ sinConfirmarEmpaque: 3 }),
      });

      await useCase.ejecutarAutomatica();

      expect(alertas.creadas).toEqual([
        {
          tipo: 'EMPAQUES_SIN_CONFIRMAR',
          urgencia: 'MEDIA',
          mensaje:
            '3 productos no se pueden contar hasta que confirmes como se venden.',
        },
      ]);
    });

    it('la corrida automatica sin pendientes no alerta', async () => {
      const { useCase, alertas } = armar({});

      const corrida = await useCase.ejecutarAutomatica();

      expect(corrida.exito).toBe(true);
      expect(alertas.creadas).toEqual([]);
    });

    it('una desactivacion retenida alerta MEDIA, venga de donde venga', async () => {
      const { useCase, alertas } = armar({
        productos: async () =>
          productos({
            desactivacionRetenida: {
              motivo: 'DEMASIADOS_FALTANTES',
              faltantes: 40,
              activos: 104,
            },
          }),
      });

      await useCase.ejecutar('MANUAL');

      expect(alertas.creadas).toEqual([
        expect.objectContaining({
          tipo: 'DESACTIVACION_RETENIDA',
          urgencia: 'MEDIA',
          mensaje: expect.stringContaining('40 de 104 productos'),
        }),
      ]);
    });
  });

  describe('corrida automatica', () => {
    it('si Handy no responde, no lanza, no reintenta y deja alerta BAJA', async () => {
      const fallo = new HandyErrorServidorError('/product', 503);
      const productosFallidos = jest.fn(() => Promise.reject(fallo));
      const { useCase, alertas, orden } = armar({ productos: productosFallidos });

      const corrida = await useCase.ejecutarAutomatica();

      expect(corrida).toEqual({ exito: false, error: fallo });
      // Un solo intento: espera al dia siguiente o al boton.
      expect(productosFallidos).toHaveBeenCalledTimes(1);
      expect(orden).toEqual(['productos']);
      expect(alertas.creadas).toEqual([
        expect.objectContaining({
          tipo: 'SINCRONIZACION_FALLIDA',
          urgencia: 'BAJA',
        }),
      ]);
    });

    it('con el token invalido la alerta es ALTA', async () => {
      const { useCase, alertas } = armar({
        productos: () => Promise.reject(new HandyTokenInvalidoError('/product')),
      });

      await useCase.ejecutarAutomatica();

      expect(alertas.creadas).toEqual([
        expect.objectContaining({
          tipo: 'TOKEN_HANDY_INVALIDO',
          urgencia: 'ALTA',
        }),
      ]);
    });

    it('si solo fallan los vendedores, alerta y conserva lo de productos', async () => {
      const { useCase, alertas } = armar({
        vendedores: () =>
          Promise.reject(new HandyErrorServidorError('/user', 502)),
      });

      const corrida = await useCase.ejecutarAutomatica();

      expect(corrida).toEqual(
        expect.objectContaining({
          exito: true,
          resultado: expect.objectContaining({ vendedores: null }),
        }),
      );
      expect(alertas.creadas).toEqual([
        expect.objectContaining({
          tipo: 'SINCRONIZACION_FALLIDA',
          mensaje: expect.stringContaining('los vendedores'),
        }),
      ]);
    });
  });
});

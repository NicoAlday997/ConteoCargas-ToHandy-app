import type {
  FiltrosHistorial,
  HistorialRepository,
  PaginaCargas,
} from './historial.repository';
import {
  ConsultarHistorialUseCase,
  type EntradaConsultarHistorial,
  type SolicitanteHistorial,
} from './consultar-historial.use-case';

/**
 * Pruebas del caso de uso "consultar historial" (RF-23). Sin base de datos:
 * doble en memoria del puerto `HistorialRepository` que solo registra los
 * filtros recibidos, para verificar la normalizacion de `page`/`pageSize`.
 */

/** Hoy es 23 de septiembre por la tarde (hora de Mexico). */
const AHORA = new Date('2026-09-23T18:00:00-06:00');
const HACE_14_DIAS = new Date('2026-09-09T00:00:00-06:00');

const SUPERVISOR: SolicitanteHistorial = { usuarioAppId: 's1', rolApp: 'SUPERVISOR' };
const CONTADOR: SolicitanteHistorial = { usuarioAppId: 'c1', rolApp: 'CONTADOR' };
const VENDEDOR: SolicitanteHistorial = { usuarioAppId: 'v1', rolApp: 'VENDEDOR' };

const PAGINA_VACIA: PaginaCargas = { items: [], total: 0, page: 1, pageSize: 1 };

class FakeHistorialRepository implements HistorialRepository {
  ultimosFiltros: FiltrosHistorial | undefined;

  async listarCargas(filtros: FiltrosHistorial): Promise<PaginaCargas> {
    this.ultimosFiltros = filtros;
    return { ...PAGINA_VACIA, page: filtros.page, pageSize: filtros.pageSize };
  }

  async obtenerCargaConsolidada(): Promise<null> {
    throw new Error('no usado en estas pruebas');
  }
}

describe('ConsultarHistorialUseCase', () => {
  let repo: FakeHistorialRepository;
  let useCase: ConsultarHistorialUseCase;

  beforeEach(() => {
    repo = new FakeHistorialRepository();
    useCase = new ConsultarHistorialUseCase(repo);
  });

  it('aplica page=1 y pageSize=20 por defecto cuando no vienen en la entrada', async () => {
    await useCase.ejecutar(SUPERVISOR, {}, AHORA);

    expect(repo.ultimosFiltros?.page).toBe(1);
    expect(repo.ultimosFiltros?.pageSize).toBe(20);
  });

  it('respeta page y pageSize cuando vienen validos', async () => {
    await useCase.ejecutar(SUPERVISOR, { page: 3, pageSize: 10 }, AHORA);

    expect(repo.ultimosFiltros?.page).toBe(3);
    expect(repo.ultimosFiltros?.pageSize).toBe(10);
  });

  it('acota pageSize a 100 aunque el cliente pida mas', async () => {
    await useCase.ejecutar(SUPERVISOR, { pageSize: 5000 }, AHORA);

    expect(repo.ultimosFiltros?.pageSize).toBe(100);
  });

  it('ignora page/pageSize invalidos (0 o negativos) y usa el valor por defecto', async () => {
    await useCase.ejecutar(SUPERVISOR, { page: 0, pageSize: -5 }, AHORA);

    expect(repo.ultimosFiltros?.page).toBe(1);
    expect(repo.ultimosFiltros?.pageSize).toBe(20);
  });

  it('pasa el resto de los filtros sin modificarlos, incluido conDiscrepancia: false', async () => {
    const entrada: EntradaConsultarHistorial = {
      rutaId: 'ruta-1',
      fechaInicio: new Date('2026-09-01T00:00:00-06:00'),
      fechaFin: new Date('2026-09-01T23:59:59-06:00'),
      estado: 'ENVIADA',
      conDiscrepancia: false,
      tipo: 'RECARGA',
    };

    await useCase.ejecutar(SUPERVISOR, entrada, AHORA);

    expect(repo.ultimosFiltros).toMatchObject({
      rutaId: 'ruta-1',
      fechaInicio: entrada.fechaInicio,
      fechaFin: entrada.fechaFin,
      estado: 'ENVIADA',
      conDiscrepancia: false,
      tipo: 'RECARGA',
    });
  });

  it('pasa el filtro sinLiquidar para ver cargas iniciadas con la ruta anterior sin liquidar', async () => {
    await useCase.ejecutar(SUPERVISOR, { sinLiquidar: true }, AHORA);

    expect(repo.ultimosFiltros?.sinLiquidar).toBe(true);
  });

  it('devuelve exactamente lo que el puerto responde', async () => {
    const resultado = await useCase.ejecutar(SUPERVISOR, { page: 2, pageSize: 15 }, AHORA);

    expect(resultado).toEqual({ items: [], total: 0, page: 2, pageSize: 15 });
  });

  describe('alcance por rol', () => {
    it('SUPERVISOR: sin filtro de vendedor ni fecha minima', async () => {
      await useCase.ejecutar(SUPERVISOR, {}, AHORA);

      expect(repo.ultimosFiltros?.vendedorUsuarioAppId).toBeUndefined();
      expect(repo.ultimosFiltros?.fechaInicio).toBeUndefined();
    });

    it('CONTADOR: cargas de todos, desde hace 14 dias', async () => {
      await useCase.ejecutar(CONTADOR, {}, AHORA);

      expect(repo.ultimosFiltros?.vendedorUsuarioAppId).toBeUndefined();
      expect(repo.ultimosFiltros?.fechaInicio).toEqual(HACE_14_DIAS);
    });

    it('VENDEDOR: solo sus cargas, desde hace 14 dias', async () => {
      await useCase.ejecutar(VENDEDOR, {}, AHORA);

      expect(repo.ultimosFiltros?.vendedorUsuarioAppId).toBe('v1');
      expect(repo.ultimosFiltros?.fechaInicio).toEqual(HACE_14_DIAS);
    });

    it('un vendedor no puede ir mas atras de 14 dias pidiendo otra fechaInicio', async () => {
      await useCase.ejecutar(
        VENDEDOR,
        { fechaInicio: new Date('2026-01-01T00:00:00-06:00') },
        AHORA,
      );

      expect(repo.ultimosFiltros?.fechaInicio).toEqual(HACE_14_DIAS);
    });

    it('un vendedor si puede estrechar a una fecha mas reciente', async () => {
      const reciente = new Date('2026-09-20T00:00:00-06:00');

      await useCase.ejecutar(VENDEDOR, { fechaInicio: reciente }, AHORA);

      expect(repo.ultimosFiltros?.fechaInicio).toEqual(reciente);
    });

    it('el filtro de vendedor sale del solicitante, no de los filtros del cliente', async () => {
      // Aunque llegara algo extra en los filtros, el caso de uso no lo usa.
      const intento = { vendedorUsuarioAppId: 'v2' } as EntradaConsultarHistorial;

      await useCase.ejecutar(VENDEDOR, intento, AHORA);

      expect(repo.ultimosFiltros?.vendedorUsuarioAppId).toBe('v1');
    });
  });
});

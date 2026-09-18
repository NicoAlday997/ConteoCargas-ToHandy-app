import type {
  FiltrosHistorial,
  HistorialRepository,
  PaginaCargas,
} from './historial.repository';
import {
  ConsultarHistorialUseCase,
  type EntradaConsultarHistorial,
} from './consultar-historial.use-case';

/**
 * Pruebas del caso de uso "consultar historial" (RF-23). Sin base de datos:
 * doble en memoria del puerto `HistorialRepository` que solo registra los
 * filtros recibidos, para verificar la normalizacion de `page`/`pageSize`.
 */

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
    await useCase.ejecutar({});

    expect(repo.ultimosFiltros?.page).toBe(1);
    expect(repo.ultimosFiltros?.pageSize).toBe(20);
  });

  it('respeta page y pageSize cuando vienen validos', async () => {
    await useCase.ejecutar({ page: 3, pageSize: 10 });

    expect(repo.ultimosFiltros?.page).toBe(3);
    expect(repo.ultimosFiltros?.pageSize).toBe(10);
  });

  it('acota pageSize a 100 aunque el cliente pida mas', async () => {
    await useCase.ejecutar({ pageSize: 5000 });

    expect(repo.ultimosFiltros?.pageSize).toBe(100);
  });

  it('ignora page/pageSize invalidos (0 o negativos) y usa el valor por defecto', async () => {
    await useCase.ejecutar({ page: 0, pageSize: -5 });

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

    await useCase.ejecutar(entrada);

    expect(repo.ultimosFiltros).toMatchObject({
      rutaId: 'ruta-1',
      fechaInicio: entrada.fechaInicio,
      fechaFin: entrada.fechaFin,
      estado: 'ENVIADA',
      conDiscrepancia: false,
      tipo: 'RECARGA',
    });
  });

  it('devuelve exactamente lo que el puerto responde', async () => {
    const resultado = await useCase.ejecutar({ page: 2, pageSize: 15 });

    expect(resultado).toEqual({ items: [], total: 0, page: 2, pageSize: 15 });
  });
});

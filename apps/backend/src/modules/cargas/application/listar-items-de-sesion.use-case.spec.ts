import type {
  CapturaGuardada,
  CargaRepository,
  SesionConteo,
} from './carga.repository';
import { ListarItemsDeSesionUseCase } from './listar-items-de-sesion.use-case';

/**
 * Pruebas del caso de uso "listar items de sesion": la app lo usa para
 * reconciliar su copia local. Solo el dueño de la sesion puede leerla.
 */

const AHORA = new Date('2026-09-22T08:00:00-06:00');

const SESION: SesionConteo = {
  id: 'se-1',
  eventoCargaId: 'ev-1',
  tipo: 'CONTADOR',
  usuarioAppId: 'c1',
  dispositivoId: null,
  ubicacion: null,
  estado: 'ABIERTA',
  iniciadaEn: AHORA,
  finalizadaEn: null,
};

const CAPTURAS: CapturaGuardada[] = [
  {
    productoCode: 'CHICLE',
    paquetes: 0,
    sueltas: 7,
    cantidad: 7,
    capturadoEn: new Date('2026-09-22T08:15:00-06:00'),
    recibidoEn: new Date('2026-09-22T08:31:00-06:00'),
  },
];

function repositorio(sesion: SesionConteo | null): CargaRepository {
  // Solo se usan dos metodos: el resto del puerto no hace falta en el doble.
  return {
    buscarSesionPorId: async () => sesion,
    listarCapturasDeSesion: async () => CAPTURAS,
  } as unknown as CargaRepository;
}

describe('ListarItemsDeSesionUseCase', () => {
  const entrada = { eventoId: 'ev-1', sesionId: 'se-1', usuarioAppId: 'c1' };

  it('devuelve lo guardado con sus fechas al dueño de la sesion', async () => {
    const useCase = new ListarItemsDeSesionUseCase(repositorio(SESION));

    expect(await useCase.ejecutar(entrada)).toEqual({
      exito: true,
      items: CAPTURAS,
    });
  });

  it('SESION_NO_ENCONTRADA si no existe o es de otro evento', async () => {
    expect(
      await new ListarItemsDeSesionUseCase(repositorio(null)).ejecutar(entrada),
    ).toEqual({ exito: false, motivo: 'SESION_NO_ENCONTRADA' });
    expect(
      await new ListarItemsDeSesionUseCase(
        repositorio({ ...SESION, eventoCargaId: 'ev-otro' }),
      ).ejecutar(entrada),
    ).toEqual({ exito: false, motivo: 'SESION_NO_ENCONTRADA' });
  });

  it('SESION_AJENA: un conteo independiente no se muestra a otro usuario', async () => {
    const useCase = new ListarItemsDeSesionUseCase(repositorio(SESION));

    expect(
      await useCase.ejecutar({ ...entrada, usuarioAppId: 'vendedor-1' }),
    ).toEqual({ exito: false, motivo: 'SESION_AJENA' });
  });
});

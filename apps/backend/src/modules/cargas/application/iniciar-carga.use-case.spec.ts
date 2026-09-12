import type { TipoSesion, UbicacionConteo } from '@prisma/client';

import type {
  AsignacionRepository,
  AsignacionVigente,
} from './asignacion.repository';
import type {
  CargaRepository,
  DatosCrearEvento,
  Discrepancia,
  DatosActualizarDiscrepancia,
  DiscrepanciaAGuardar,
  EventoCarga,
  ItemAGuardar,
  ItemCapturado,
  SesionConteo,
} from './carga.repository';
import {
  IniciarCargaUseCase,
  type ResultadoIniciarCarga,
} from './iniciar-carga.use-case';

/**
 * Pruebas del caso de uso "iniciar carga" (RF-12). Sin base de datos: dobles en
 * memoria de los puertos `CargaRepository` y `AsignacionRepository`.
 */

const AHORA = new Date('2026-09-08T07:30:00-06:00');

/**
 * Doble del repositorio de cargas: solo implementa lo que este caso de uso usa
 * (`crearEvento`, `crearSesion`) y registra sus llamadas. El resto lanza para
 * que una prueba falle si el caso de uso empieza a depender de mas.
 */
class FakeCargaRepository implements CargaRepository {
  readonly eventosCreados: DatosCrearEvento[] = [];
  readonly sesionesCreadas: Array<{
    eventoId: string;
    tipo: TipoSesion;
    usuarioAppId: string;
    dispositivoId?: string;
  }> = [];
  private secuencia = 0;

  async crearEvento(datos: DatosCrearEvento): Promise<EventoCarga> {
    this.secuencia += 1;
    this.eventosCreados.push(datos);
    return {
      id: `ev-${this.secuencia}`,
      rutaId: datos.rutaId,
      plantillaId: datos.plantillaId,
      tipo: datos.tipo,
      tipoOperacion: datos.tipoOperacion,
      usuarioHandyId: datos.usuarioHandyId,
      // Invariante de alta que el adaptador real garantiza por el default del esquema.
      estado: 'BORRADOR',
      fechaConteo: datos.fechaConteo,
      autorizadaPorId: null,
      fechaAutorizacion: null,
      creadoEn: datos.fechaConteo,
    };
  }

  async crearSesion(
    eventoId: string,
    tipo: TipoSesion,
    usuarioAppId: string,
    dispositivoId?: string,
    ubicacion?: UbicacionConteo,
  ): Promise<SesionConteo> {
    this.secuencia += 1;
    this.sesionesCreadas.push({ eventoId, tipo, usuarioAppId, dispositivoId });
    return {
      id: `se-${this.secuencia}`,
      eventoCargaId: eventoId,
      tipo,
      usuarioAppId,
      dispositivoId: dispositivoId ?? null,
      ubicacion: ubicacion ?? null,
      estado: 'ABIERTA',
      iniciadaEn: AHORA,
      finalizadaEn: null,
    };
  }

  buscarEventoPorId(): Promise<EventoCarga | null> {
    throw new Error('no usado en esta prueba');
  }
  cambiarEstado(): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  marcarComoEnviada(): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  autorizarEvento(): Promise<EventoCarga> {
    throw new Error('no usado en esta prueba');
  }
  buscarSesionPorId(): Promise<SesionConteo | null> {
    throw new Error('no usado en esta prueba');
  }
  guardarItems(_sesionId: string, _items: ItemAGuardar[]): Promise<void> {
    throw new Error('no usado en esta prueba');
  }
  finalizarSesion(): Promise<SesionConteo> {
    throw new Error('no usado en esta prueba');
  }
  listarItemsDeSesion(): Promise<ItemCapturado[]> {
    throw new Error('no usado en esta prueba');
  }
  listarSesionesDeEvento(): Promise<SesionConteo[]> {
    throw new Error('no usado en esta prueba');
  }
  guardarDiscrepancias(
    _eventoId: string,
    _discrepancias: DiscrepanciaAGuardar[],
  ): Promise<void> {
    throw new Error('no usado en esta prueba');
  }
  listarDiscrepancias(): Promise<Discrepancia[]> {
    throw new Error('no usado en esta prueba');
  }
  actualizarDiscrepancia(
    _eventoId: string,
    _productoCode: string,
    _datos: DatosActualizarDiscrepancia,
  ): Promise<Discrepancia> {
    throw new Error('no usado en esta prueba');
  }
  reabrirDiscrepancia(): Promise<Discrepancia> {
    throw new Error('no usado en esta prueba');
  }
}

/** Doble de la asignacion: se le fija a mano lo que devuelve. */
class FakeAsignacionRepository implements AsignacionRepository {
  vigente: AsignacionVigente | null = null;
  readonly consultas: string[] = [];

  async buscarAsignacionVigente(
    usuarioAppId: string,
  ): Promise<AsignacionVigente | null> {
    this.consultas.push(usuarioAppId);
    return this.vigente;
  }
}

function exigirExito(
  resultado: ResultadoIniciarCarga,
): Extract<ResultadoIniciarCarga, { exito: true }> {
  if (!resultado.exito) {
    throw new Error(`se esperaba exito pero el motivo fue ${resultado.motivo}`);
  }
  return resultado;
}

describe('IniciarCargaUseCase', () => {
  let cargas: FakeCargaRepository;
  let asignaciones: FakeAsignacionRepository;
  let useCase: IniciarCargaUseCase;

  beforeEach(() => {
    cargas = new FakeCargaRepository();
    asignaciones = new FakeAsignacionRepository();
    useCase = new IniciarCargaUseCase(cargas, asignaciones);
  });

  it('sin asignacion vigente: devuelve SIN_RUTA_ASIGNADA y no crea nada', async () => {
    asignaciones.vigente = null;

    const resultado = await useCase.ejecutar(
      { usuarioAppId: 'v1', tipo: 'INICIAL', usuarioHandyId: 42 },
      AHORA,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'SIN_RUTA_ASIGNADA' });
    expect(cargas.eventosCreados).toHaveLength(0);
    expect(cargas.sesionesCreadas).toHaveLength(0);
  });

  it('crea el evento en BORRADOR con ruta y plantilla de la asignacion como snapshot', async () => {
    asignaciones.vigente = { rutaId: 'ruta-7', plantillaId: 'plantilla-3' };

    const resultado = exigirExito(
      await useCase.ejecutar(
        { usuarioAppId: 'v1', tipo: 'INICIAL', usuarioHandyId: 42 },
        AHORA,
      ),
    );

    expect(asignaciones.consultas).toEqual(['v1']);
    expect(cargas.eventosCreados).toEqual([
      {
        rutaId: 'ruta-7',
        plantillaId: 'plantilla-3',
        tipo: 'INICIAL',
        usuarioHandyId: 42,
        tipoOperacion: 'AUTOVENTA',
        fechaConteo: AHORA,
      },
    ]);
    expect(resultado.evento.estado).toBe('BORRADOR');
    expect(resultado.evento.rutaId).toBe('ruta-7');
    expect(resultado.evento.plantillaId).toBe('plantilla-3');
  });

  it('crea la sesion del primer conteo (VENDEDOR, ABIERTA) para ese usuario y evento', async () => {
    asignaciones.vigente = { rutaId: 'ruta-7', plantillaId: 'plantilla-3' };

    const resultado = exigirExito(
      await useCase.ejecutar(
        { usuarioAppId: 'v1', tipo: 'INICIAL', usuarioHandyId: 42 },
        AHORA,
      ),
    );

    expect(cargas.sesionesCreadas).toEqual([
      {
        eventoId: resultado.evento.id,
        tipo: 'VENDEDOR',
        usuarioAppId: 'v1',
        dispositivoId: undefined,
      },
    ]);
    expect(resultado.sesion.tipo).toBe('VENDEDOR');
    expect(resultado.sesion.estado).toBe('ABIERTA');
    expect(resultado.sesion.usuarioAppId).toBe('v1');
    expect(resultado.sesion.eventoCargaId).toBe(resultado.evento.id);
  });

  it('propaga plantillaId null cuando la ruta no tiene plantilla', async () => {
    asignaciones.vigente = { rutaId: 'ruta-9', plantillaId: null };

    const resultado = exigirExito(
      await useCase.ejecutar(
        { usuarioAppId: 'v2', tipo: 'RECARGA', usuarioHandyId: 7 },
        AHORA,
      ),
    );

    expect(cargas.eventosCreados[0].plantillaId).toBeNull();
    expect(resultado.evento.plantillaId).toBeNull();
  });

  it('respeta el tipo RECARGA recibido', async () => {
    asignaciones.vigente = { rutaId: 'ruta-9', plantillaId: null };

    const resultado = exigirExito(
      await useCase.ejecutar(
        { usuarioAppId: 'v2', tipo: 'RECARGA', usuarioHandyId: 7 },
        AHORA,
      ),
    );

    expect(cargas.eventosCreados[0].tipo).toBe('RECARGA');
    expect(resultado.evento.tipo).toBe('RECARGA');
  });
});

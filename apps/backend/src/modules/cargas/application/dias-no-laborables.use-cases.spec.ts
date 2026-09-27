import {
  type DiaNoLaborable,
  DiaNoLaborableDuplicadoError,
  DiaNoLaborableRepository,
} from './dia-no-laborable.repository';
import { ListarFechasOperativasDisponiblesUseCase } from './listar-fechas-operativas-disponibles.use-case';
import { MarcarDiaNoLaborableUseCase } from './marcar-dia-no-laborable.use-case';
import { QuitarDiaNoLaborableUseCase } from './quitar-dia-no-laborable.use-case';

/**
 * Casos de uso del calendario laboral: las opciones que ve la app y la
 * administracion de dias no laborables. Doble en memoria del repositorio que
 * se porta como la tabla (la fecha es la llave).
 *
 * Septiembre de 2026: sabado 26, domingo 27, lunes 28.
 */

const dia = (texto: string) => new Date(`${texto}T00:00:00-06:00`);
const SABADO = new Date('2026-09-26T17:00:00-06:00');

class FakeDiasNoLaborables extends DiaNoLaborableRepository {
  readonly filas = new Map<number, DiaNoLaborable>();

  async listarEntre(desde: Date, hasta: Date): Promise<DiaNoLaborable[]> {
    return [...this.filas.values()]
      .filter((d) => d.fecha >= desde && d.fecha <= hasta)
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }

  async marcar(fecha: Date, motivo: string, usuarioId: string): Promise<DiaNoLaborable> {
    if (this.filas.has(fecha.getTime())) throw new DiaNoLaborableDuplicadoError();
    const fila = {
      fecha,
      motivo,
      creadoPorId: usuarioId,
      creadoPorNombre: null,
      creadoEn: SABADO,
    };
    this.filas.set(fecha.getTime(), fila);
    return fila;
  }

  async quitar(fecha: Date): Promise<boolean> {
    return this.filas.delete(fecha.getTime());
  }
}

describe('ListarFechasOperativasDisponiblesUseCase', () => {
  let repo: FakeDiasNoLaborables;
  let useCase: ListarFechasOperativasDisponiblesUseCase;

  beforeEach(() => {
    repo = new FakeDiasNoLaborables();
    useCase = new ListarFechasOperativasDisponiblesUseCase(repo);
  });

  it('vendedor en sabado: hoy y el lunes, con etiquetas que no dicen "mañana"', async () => {
    const opciones = await useCase.ejecutar('VENDEDOR', SABADO);

    expect(opciones.map(({ dia, etiqueta, esHoy }) => ({ dia, etiqueta, esHoy }))).toEqual([
      { dia: '2026-09-26', etiqueta: 'Hoy, sábado 26 de septiembre', esHoy: true },
      { dia: '2026-09-28', etiqueta: 'El lunes 28 de septiembre', esHoy: false },
    ]);
  });

  it('vendedor en domingo: solo el lunes', async () => {
    const opciones = await useCase.ejecutar('VENDEDOR', new Date('2026-09-27T10:00:00-06:00'));

    expect(opciones.map((o) => o.dia)).toEqual(['2026-09-28']);
  });

  it('respeta los dias marcados', async () => {
    await repo.marcar(dia('2026-09-28'), 'Festivo', 'sup');

    const opciones = await useCase.ejecutar('VENDEDOR', SABADO);

    expect(opciones.map((o) => o.dia)).toEqual(['2026-09-26', '2026-09-29']);
  });

  it('supervisor: todos los dias habiles de hoy en adelante, sin domingos', async () => {
    const opciones = await useCase.ejecutar('SUPERVISOR', SABADO);

    expect(opciones.length).toBeGreaterThan(2);
    expect(opciones[0].dia).toBe('2026-09-26');
    expect(opciones.map((o) => o.dia)).not.toContain('2026-09-27');
  });
});

describe('MarcarDiaNoLaborableUseCase', () => {
  let repo: FakeDiasNoLaborables;
  let useCase: MarcarDiaNoLaborableUseCase;

  beforeEach(() => {
    repo = new FakeDiasNoLaborables();
    useCase = new MarcarDiaNoLaborableUseCase(repo);
  });

  it('marca un dia futuro normalizado al inicio del dia, con el motivo sin espacios', async () => {
    const resultado = await useCase.ejecutar(
      { fecha: new Date('2026-11-16T15:00:00-06:00'), motivo: '  Revolucion ', usuarioAppId: 'sup' },
      SABADO,
    );

    expect(resultado).toEqual({
      exito: true,
      dia: expect.objectContaining({ fecha: dia('2026-11-16'), motivo: 'Revolucion', creadoPorId: 'sup' }),
    });
  });

  it('acepta hoy', async () => {
    const resultado = await useCase.ejecutar(
      { fecha: dia('2026-09-26'), motivo: 'Lluvia', usuarioAppId: 'sup' },
      SABADO,
    );

    expect(resultado.exito).toBe(true);
  });

  it('FECHA_PASADA si el dia ya paso', async () => {
    const resultado = await useCase.ejecutar(
      { fecha: dia('2026-09-25'), motivo: 'Festivo', usuarioAppId: 'sup' },
      SABADO,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'FECHA_PASADA' });
    expect(repo.filas.size).toBe(0);
  });

  it('no guarda domingos: ya salen de la semana laboral', async () => {
    const resultado = await useCase.ejecutar(
      { fecha: dia('2026-09-27'), motivo: 'Domingo', usuarioAppId: 'sup' },
      SABADO,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'NO_SE_TRABAJA_POR_SEMANA' });
    expect(repo.filas.size).toBe(0);
  });

  it('MOTIVO_REQUERIDO con menos de 3 caracteres', async () => {
    const resultado = await useCase.ejecutar(
      { fecha: dia('2026-09-28'), motivo: ' x ', usuarioAppId: 'sup' },
      SABADO,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'MOTIVO_REQUERIDO' });
  });

  it('YA_MARCADO si ese dia ya estaba', async () => {
    await useCase.ejecutar({ fecha: dia('2026-09-28'), motivo: 'Festivo', usuarioAppId: 'sup' }, SABADO);

    const resultado = await useCase.ejecutar(
      { fecha: dia('2026-09-28'), motivo: 'Otro', usuarioAppId: 'sup' },
      SABADO,
    );

    expect(resultado).toEqual({ exito: false, motivo: 'YA_MARCADO' });
  });
});

describe('QuitarDiaNoLaborableUseCase', () => {
  let repo: FakeDiasNoLaborables;
  let useCase: QuitarDiaNoLaborableUseCase;

  beforeEach(() => {
    repo = new FakeDiasNoLaborables();
    useCase = new QuitarDiaNoLaborableUseCase(repo);
  });

  it('quita un dia marcado', async () => {
    await repo.marcar(dia('2026-09-28'), 'Festivo', 'sup');

    expect(await useCase.ejecutar(dia('2026-09-28'), SABADO)).toEqual({ exito: true });
    expect(repo.filas.size).toBe(0);
  });

  it('NO_MARCADO si no estaba', async () => {
    expect(await useCase.ejecutar(dia('2026-09-28'), SABADO)).toEqual({
      exito: false,
      motivo: 'NO_MARCADO',
    });
  });

  it('FECHA_PASADA: los dias pasados se quedan como registro', async () => {
    await repo.marcar(dia('2026-09-16'), 'Independencia', 'sup');

    expect(await useCase.ejecutar(dia('2026-09-16'), SABADO)).toEqual({
      exito: false,
      motivo: 'FECHA_PASADA',
    });
    expect(repo.filas.size).toBe(1);
  });
});

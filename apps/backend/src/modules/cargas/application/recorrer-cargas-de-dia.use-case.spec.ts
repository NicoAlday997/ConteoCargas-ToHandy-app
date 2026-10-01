import type { EstadoCarga, TipoCarga } from '@prisma/client';

import {
  CargaInicialDuplicadaError,
  type DatosRecorrerFechaOperativa,
  type EventoCarga,
} from './carga.repository';
import type { CargaDelDia } from './consultas-carga.repository';
import type { DiaNoLaborable } from './dia-no-laborable.repository';
import {
  RecorrerCargasDeDiaUseCase,
  type EntradaRecorrerCargasDeDia,
} from './recorrer-cargas-de-dia.use-case';

/**
 * Pruebas de "recorrer las cargas de un dia". Dobles en memoria: una sola
 * tabla de cargas que comparten el repositorio de escritura y el de consultas.
 *
 * Septiembre de 2026: AHORA es el viernes 25; el 26 es sabado (el dia que no
 * se trabajo), el 27 domingo y el 28 lunes.
 */

const AHORA = new Date('2026-09-25T18:00:00-06:00');
const DIA_25 = new Date('2026-09-25T00:00:00-06:00');
const DIA_26 = new Date('2026-09-26T00:00:00-06:00');
const DIA_27 = new Date('2026-09-27T00:00:00-06:00');
const DIA_28 = new Date('2026-09-28T00:00:00-06:00');
const SUPERVISOR = 'u-supervisor';
const MOTIVO = 'Paro de transportistas';

interface Carga {
  id: string;
  rutaId: string;
  rutaNombre: string;
  tipo: TipoCarga;
  estado: EstadoCarga;
  fechaOperativa: Date;
}

class Tabla {
  cargas: Carga[] = [];

  sembrar(parcial: Partial<Carga> & { id: string; rutaId: string }): void {
    this.cargas.push({
      rutaNombre: `Ruta ${parcial.rutaId.replace('ruta-', '')}`,
      tipo: 'INICIAL',
      estado: 'EN_ESPERA_AUTORIZACION',
      fechaOperativa: DIA_26,
      ...parcial,
    });
  }

  fechaDe(id: string): Date {
    const carga = this.cargas.find((c) => c.id === id);
    if (!carga) throw new Error(`carga ${id} inexistente`);
    return carga.fechaOperativa;
  }
}

class FakeCargaRepository {
  readonly recorridos: DatosRecorrerFechaOperativa[] = [];
  /** Si se fija, `recorrerFechaOperativa` lanza este error sin mover nada (carrera). */
  errorAlRecorrer: Error | null = null;

  constructor(private readonly tabla: Tabla) {}

  async buscarCargaInicialDeFecha(
    rutaId: string,
    fechaOperativa: Date,
  ): Promise<EventoCarga | null> {
    const carga = this.tabla.cargas.find(
      (c) =>
        c.rutaId === rutaId &&
        c.tipo === 'INICIAL' &&
        c.estado !== 'CANCELADA' &&
        c.fechaOperativa.getTime() === fechaOperativa.getTime(),
    );
    return carga ? ({ id: carga.id } as EventoCarga) : null;
  }

  async recorrerFechaOperativa(
    datos: DatosRecorrerFechaOperativa,
  ): Promise<void> {
    if (this.errorAlRecorrer !== null) throw this.errorAlRecorrer;
    this.recorridos.push(datos);
    for (const { eventoId } of datos.eventos) {
      const carga = this.tabla.cargas.find((c) => c.id === eventoId);
      if (!carga) throw new Error(`carga ${eventoId} inexistente`);
      carga.fechaOperativa = datos.fechaNueva;
    }
  }
}

class FakeConsultas {
  constructor(private readonly tabla: Tabla) {}

  async listarCargasDeFecha(fechaOperativa: Date): Promise<CargaDelDia[]> {
    return this.tabla.cargas
      .filter((c) => c.fechaOperativa.getTime() === fechaOperativa.getTime())
      .map((c) => ({
        ...c,
        vendedorNombre: `Vendedor ${c.rutaNombre}`,
        totalProductos: 12,
      }));
  }
}

class FakeDiasNoLaborables {
  dias: Date[] = [DIA_26];

  async listarEntre(desde: Date, hasta: Date): Promise<DiaNoLaborable[]> {
    return this.dias
      .filter((d) => d >= desde && d <= hasta)
      .map((fecha) => ({
        fecha,
        motivo: 'paro',
        creadoPorId: null,
        creadoPorNombre: null,
        creadoEn: fecha,
      }));
  }
}

function entrada(
  parcial: Partial<EntradaRecorrerCargasDeDia> = {},
): EntradaRecorrerCargasDeDia {
  return {
    fechaOrigen: DIA_26,
    fechaDestino: DIA_28,
    motivo: MOTIVO,
    usuarioAppId: SUPERVISOR,
    ...parcial,
  };
}

describe('RecorrerCargasDeDiaUseCase', () => {
  let tabla: Tabla;
  let cargas: FakeCargaRepository;
  let dias: FakeDiasNoLaborables;
  let useCase: RecorrerCargasDeDiaUseCase;

  beforeEach(() => {
    tabla = new Tabla();
    cargas = new FakeCargaRepository(tabla);
    dias = new FakeDiasNoLaborables();
    useCase = new RecorrerCargasDeDiaUseCase(
      cargas as never,
      new FakeConsultas(tabla) as never,
      dias as never,
    );
  });

  it('mueve las ENVIADAS junto con las demas, cada una con su renglon de bitacora', async () => {
    tabla.sembrar({ id: 'ev-1', rutaId: 'ruta-1', estado: 'ENVIADA' });
    tabla.sembrar({
      id: 'ev-1r',
      rutaId: 'ruta-1',
      tipo: 'RECARGA',
      estado: 'ENVIADA',
    });
    tabla.sembrar({
      id: 'ev-2',
      rutaId: 'ruta-2',
      estado: 'EN_ESPERA_CONTADOR',
    });

    const resultado = await useCase.ejecutar(entrada(), AHORA);

    expect(resultado).toMatchObject({ exito: true, movidas: 3 });
    expect(tabla.fechaDe('ev-1')).toEqual(DIA_28);
    expect(tabla.fechaDe('ev-1r')).toEqual(DIA_28);
    expect(tabla.fechaDe('ev-2')).toEqual(DIA_28);
    expect(cargas.recorridos).toEqual([
      {
        eventos: [
          { eventoId: 'ev-1', fechaAnterior: DIA_26 },
          { eventoId: 'ev-1r', fechaAnterior: DIA_26 },
          { eventoId: 'ev-2', fechaAnterior: DIA_26 },
        ],
        fechaNueva: DIA_28,
        cambiadaPorId: SUPERVISOR,
        motivo: MOTIVO,
      },
    ]);
    if (resultado.exito) {
      expect(resultado.eventos.map((e) => e.fechaOperativa)).toEqual([
        DIA_28,
        DIA_28,
        DIA_28,
      ]);
    }
  });

  it('salta las CANCELADAS y las ENVIO_INCIERTO: se quedan en su dia', async () => {
    tabla.sembrar({ id: 'ev-1', rutaId: 'ruta-1', estado: 'ENVIADA' });
    tabla.sembrar({ id: 'ev-c', rutaId: 'ruta-2', estado: 'CANCELADA' });
    tabla.sembrar({ id: 'ev-i', rutaId: 'ruta-3', estado: 'ENVIO_INCIERTO' });

    const resultado = await useCase.ejecutar(entrada(), AHORA);

    expect(resultado).toMatchObject({ exito: true, movidas: 1 });
    expect(tabla.fechaDe('ev-1')).toEqual(DIA_28);
    expect(tabla.fechaDe('ev-c')).toEqual(DIA_26);
    expect(tabla.fechaDe('ev-i')).toEqual(DIA_26);
  });

  it('todo en una sola transaccion: una llamada con todas las cargas', async () => {
    for (let n = 1; n <= 6; n += 1) {
      tabla.sembrar({ id: `ev-${n}`, rutaId: `ruta-${n}` });
    }

    await useCase.ejecutar(entrada(), AHORA);

    expect(cargas.recorridos).toHaveLength(1);
    expect(cargas.recorridos[0].eventos).toHaveLength(6);
  });

  it('si la transaccion choca a la mitad (carrera), no se mueve ninguna y responde el conflicto', async () => {
    tabla.sembrar({ id: 'ev-1', rutaId: 'ruta-1' });
    tabla.sembrar({ id: 'ev-3', rutaId: 'ruta-3' });
    // Simula que otra INICIAL de la Ruta 3 aparecio en el destino justo antes.
    cargas.errorAlRecorrer = new CargaInicialDuplicadaError();
    const original = cargas.buscarCargaInicialDeFecha.bind(cargas);
    let llamadas = 0;
    cargas.buscarCargaInicialDeFecha = async (rutaId, fecha) => {
      llamadas += 1;
      // Las primeras dos revisiones (antes de recorrer) no ven nada.
      if (llamadas <= 2) return original(rutaId, fecha);
      return rutaId === 'ruta-3' ? ({ id: 'ev-tarde' } as EventoCarga) : null;
    };

    const resultado = await useCase.ejecutar(entrada(), AHORA);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'CONFLICTO_EN_DESTINO',
      rutas: [
        {
          rutaId: 'ruta-3',
          rutaNombre: 'Ruta 3',
          eventoIdEnDestino: 'ev-tarde',
        },
      ],
    });
    expect(tabla.fechaDe('ev-1')).toEqual(DIA_26);
    expect(tabla.fechaDe('ev-3')).toEqual(DIA_26);
  });

  it('conflicto en destino: no mueve NINGUNA y nombra las rutas que chocan', async () => {
    tabla.sembrar({ id: 'ev-1', rutaId: 'ruta-1' });
    tabla.sembrar({ id: 'ev-3', rutaId: 'ruta-3' });
    tabla.sembrar({
      id: 'ev-3-lunes',
      rutaId: 'ruta-3',
      fechaOperativa: DIA_28,
    });

    const resultado = await useCase.ejecutar(entrada(), AHORA);

    expect(resultado).toEqual({
      exito: false,
      motivo: 'CONFLICTO_EN_DESTINO',
      rutas: [
        {
          rutaId: 'ruta-3',
          rutaNombre: 'Ruta 3',
          eventoIdEnDestino: 'ev-3-lunes',
        },
      ],
    });
    expect(cargas.recorridos).toEqual([]);
    expect(tabla.fechaDe('ev-1')).toEqual(DIA_26);
  });

  it('una RECARGA no choca con la INICIAL del destino: solo las INICIAL son unicas', async () => {
    tabla.sembrar({ id: 'ev-3r', rutaId: 'ruta-3', tipo: 'RECARGA' });
    tabla.sembrar({
      id: 'ev-3-lunes',
      rutaId: 'ruta-3',
      fechaOperativa: DIA_28,
    });

    const resultado = await useCase.ejecutar(entrada(), AHORA);

    expect(resultado).toMatchObject({ exito: true, movidas: 1 });
  });

  describe('fecha destino', () => {
    beforeEach(() => {
      tabla.sembrar({ id: 'ev-1', rutaId: 'ruta-1' });
    });

    it('un domingo se rechaza (no es habil)', async () => {
      const resultado = await useCase.ejecutar(
        entrada({ fechaDestino: DIA_27 }),
        AHORA,
      );
      expect(resultado).toEqual({
        exito: false,
        motivo: 'FECHA_NO_DISPONIBLE',
      });
      expect(cargas.recorridos).toEqual([]);
    });

    it('un dia marcado como no laborable se rechaza', async () => {
      dias.dias.push(DIA_28);
      const resultado = await useCase.ejecutar(entrada(), AHORA);
      expect(resultado).toEqual({
        exito: false,
        motivo: 'FECHA_NO_DISPONIBLE',
      });
    });

    it('igual o anterior al origen se rechaza', async () => {
      for (const fechaDestino of [DIA_26, DIA_25]) {
        const resultado = await useCase.ejecutar(
          entrada({ fechaDestino }),
          AHORA,
        );
        expect(resultado).toEqual({
          exito: false,
          motivo: 'FECHA_DESTINO_INVALIDA',
        });
      }
      expect(cargas.recorridos).toEqual([]);
    });
  });

  it('motivo obligatorio de al menos 10 caracteres', async () => {
    tabla.sembrar({ id: 'ev-1', rutaId: 'ruta-1' });
    for (const motivo of ['', '   ', 'frio', 'nevo mal', '  abcdefghi  ']) {
      const resultado = await useCase.ejecutar(entrada({ motivo }), AHORA);
      expect(resultado).toEqual({ exito: false, motivo: 'MOTIVO_REQUERIDO' });
    }
    expect(cargas.recorridos).toEqual([]);
  });

  it('un dia sin cargas que mover responde 0 sin abrir transaccion', async () => {
    tabla.sembrar({ id: 'ev-c', rutaId: 'ruta-1', estado: 'CANCELADA' });
    const resultado = await useCase.ejecutar(entrada(), AHORA);
    expect(resultado).toEqual({ exito: true, movidas: 0, eventos: [] });
    expect(cargas.recorridos).toEqual([]);
  });

  describe('previsualizar', () => {
    it('separa las que se mueven de las que se quedan y sugiere el siguiente dia habil', async () => {
      tabla.sembrar({ id: 'ev-1', rutaId: 'ruta-1', estado: 'ENVIADA' });
      tabla.sembrar({ id: 'ev-c', rutaId: 'ruta-2', estado: 'CANCELADA' });

      const vista = await useCase.previsualizar(DIA_26, AHORA);

      expect(vista.cargas.map((c) => c.id)).toEqual(['ev-1']);
      expect(vista.excluidas.map((c) => c.id)).toEqual(['ev-c']);
      // El 27 es domingo: el siguiente habil despues del 26 es el lunes 28.
      expect(vista.destinoSugerido).toEqual(DIA_28);
    });
  });
});

import type {
  DatosActualizarPlantilla,
  DatosCrearPlantilla,
  Plantilla,
  PlantillaRepository,
  ProductoDePlantilla,
  ResumenPlantilla,
  RutaConPlantilla,
  RutaDePlantilla,
} from './plantilla.repository';

/**
 * Doble en memoria de `PlantillaRepository` compartido por las pruebas de los
 * casos de uso de plantillas. El sufijo `.fake-spec.ts` lo deja fuera del
 * build (tsconfig.build excluye `*spec.ts`) sin que jest lo corra como prueba.
 */

export const AHORA = new Date('2026-09-24T08:00:00-06:00');

export function plantillaDePrueba(
  overrides: Partial<Plantilla> = {},
): Plantilla {
  return {
    id: 'pl-1',
    nombre: 'Refrescos',
    descripcion: null,
    activa: true,
    creadaEn: AHORA,
    actualizadaEn: AHORA,
    ...overrides,
  };
}

export function productoDePrueba(
  code: string,
  nombre: string,
  familia: string | null = 'REFRESCOS',
): ProductoDePlantilla {
  return {
    code,
    nombre,
    familia,
    modalidadVenta: 'POR_PIEZA',
    piezasPorPaquete: 12,
    factorConfirmado: true,
    activo: true,
  };
}

interface Asignacion {
  rutaId: string;
  plantillaId: string | null;
  vigente: boolean;
}

export class PlantillaEnMemoria implements PlantillaRepository {
  readonly plantillas = new Map<string, Plantilla>();
  /** Catalogo completo por codigo. */
  readonly catalogo = new Map<string, ProductoDePlantilla>();
  /** plantillaId -> codigos. */
  readonly productosPorPlantilla = new Map<string, Set<string>>();
  readonly rutas = new Map<string, RutaDePlantilla & { activa: boolean }>();
  asignaciones: Asignacion[] = [];

  readonly actualizaciones: Array<{
    id: string;
    datos: DatosActualizarPlantilla;
  }> = [];
  readonly creadas: DatosCrearPlantilla[] = [];
  readonly agregados: Array<{ plantillaId: string; codes: string[] }> = [];
  readonly quitados: Array<{ plantillaId: string; codes: string[] }> = [];
  private secuencia = 0;

  sembrarPlantilla(plantilla: Plantilla, codes: string[] = []): void {
    this.plantillas.set(plantilla.id, plantilla);
    this.productosPorPlantilla.set(plantilla.id, new Set(codes));
  }

  sembrarProducto(producto: ProductoDePlantilla): void {
    this.catalogo.set(producto.code, producto);
  }

  sembrarRuta(id: string, activa = true): void {
    this.rutas.set(id, {
      id,
      nombre: `Ruta ${id}`,
      codigo: id.toUpperCase(),
      activa,
    });
  }

  private rutasDe(plantillaId: string): RutaDePlantilla[] {
    const ids = new Set(
      this.asignaciones
        .filter((a) => a.vigente && a.plantillaId === plantillaId)
        .map((a) => a.rutaId),
    );
    return [...ids].map((id) => {
      const { activa: _activa, ...ruta } = this.rutas.get(id)!;
      return ruta;
    });
  }

  async listar(incluirInactivas: boolean): Promise<ResumenPlantilla[]> {
    return [...this.plantillas.values()]
      .filter((p) => incluirInactivas || p.activa)
      .map((p) => ({
        ...p,
        totalProductos: this.productosPorPlantilla.get(p.id)?.size ?? 0,
        rutas: this.rutasDe(p.id),
      }));
  }

  async buscarPorId(id: string): Promise<Plantilla | null> {
    return this.plantillas.get(id) ?? null;
  }

  async listarNombres(): Promise<Array<{ id: string; nombre: string }>> {
    return [...this.plantillas.values()].map(({ id, nombre }) => ({
      id,
      nombre,
    }));
  }

  async listarProductos(plantillaId: string): Promise<ProductoDePlantilla[]> {
    const codes =
      this.productosPorPlantilla.get(plantillaId) ?? new Set<string>();
    return [...codes].map((c) => ({ ...this.catalogo.get(c)! }));
  }

  async listarRutasVigentes(plantillaId: string): Promise<RutaDePlantilla[]> {
    return this.rutasDe(plantillaId);
  }

  async crear(datos: DatosCrearPlantilla): Promise<Plantilla> {
    this.creadas.push(datos);
    this.secuencia += 1;
    const plantilla = plantillaDePrueba({
      id: `nueva-${this.secuencia}`,
      ...datos,
    });
    this.sembrarPlantilla(plantilla);
    return plantilla;
  }

  async actualizar(
    id: string,
    datos: DatosActualizarPlantilla,
  ): Promise<Plantilla> {
    this.actualizaciones.push({ id, datos });
    const actual = this.plantillas.get(id);
    if (actual === undefined) throw new Error(`plantilla inexistente: ${id}`);
    const actualizada: Plantilla = {
      ...actual,
      ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
      ...(datos.descripcion !== undefined
        ? { descripcion: datos.descripcion }
        : {}),
      ...(datos.activa !== undefined ? { activa: datos.activa } : {}),
    };
    this.plantillas.set(id, actualizada);
    return actualizada;
  }

  async buscarCodigosExistentes(codes: string[]): Promise<Set<string>> {
    return new Set(codes.filter((c) => this.catalogo.has(c)));
  }

  async agregarProductos(
    plantillaId: string,
    codes: string[],
  ): Promise<number> {
    this.agregados.push({ plantillaId, codes });
    const actuales = this.productosPorPlantilla.get(plantillaId)!;
    let nuevos = 0;
    for (const c of codes) {
      if (actuales.has(c)) continue;
      actuales.add(c);
      nuevos += 1;
    }
    return nuevos;
  }

  async quitarProductos(plantillaId: string, codes: string[]): Promise<number> {
    this.quitados.push({ plantillaId, codes });
    const actuales = this.productosPorPlantilla.get(plantillaId)!;
    let quitados = 0;
    for (const c of codes) {
      if (actuales.delete(c)) quitados += 1;
    }
    return quitados;
  }

  async listarRutas(): Promise<RutaConPlantilla[]> {
    throw new Error('no usado en estas pruebas');
  }

  async buscarRuta(
    rutaId: string,
  ): Promise<{ id: string; activa: boolean } | null> {
    const ruta = this.rutas.get(rutaId);
    return ruta ? { id: ruta.id, activa: ruta.activa } : null;
  }

  async asignarARuta(rutaId: string, plantillaId: string): Promise<number> {
    let actualizadas = 0;
    for (const a of this.asignaciones) {
      if (a.rutaId === rutaId && a.vigente) {
        a.plantillaId = plantillaId;
        actualizadas += 1;
      }
    }
    return actualizadas;
  }
}

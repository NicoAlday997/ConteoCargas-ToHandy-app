import type {
  CatalogoRepository,
  ProductoGuardado,
  ProductoLocal,
  ResumenCache,
  VendedorGuardado,
  VendedorHandyLocal,
} from './catalogo.repository';

/**
 * Doble en memoria de `CatalogoRepository` compartido por las pruebas de la
 * sincronizacion. Aplica los upserts como el adaptador Prisma (sin factor de
 * empaque: eso lo cubre `prisma-catalogo.repository.spec.ts`) para que una
 * segunda sincronizacion vea lo que dejo la primera. El sufijo `.fake-spec.ts`
 * lo deja fuera del build sin que jest lo corra como prueba.
 */
export class CatalogoEnMemoria implements CatalogoRepository {
  readonly productos = new Map<string, ProductoGuardado>();
  readonly vendedores = new Map<number, VendedorGuardado>();
  /** Cada lote que recibio `upsertProductos`, en orden. */
  readonly lotesProductos: ProductoLocal[][] = [];
  readonly lotesVendedores: VendedorHandyLocal[][] = [];
  readonly productosDesactivados: string[] = [];
  readonly vendedoresDesactivados: number[] = [];

  sembrarProducto(over: Partial<ProductoGuardado> & { code: string }): void {
    this.productos.set(over.code, {
      nombre: 'Producto 1',
      precioCentavos: 7750,
      unidadCode: 'PZA',
      unidadDescripcion: 'Pieza',
      familia: 'Abarrotes',
      activo: true,
      ...over,
    });
  }

  sembrarVendedor(over: Partial<VendedorGuardado> & { idHandy: number }): void {
    this.vendedores.set(over.idHandy, {
      nombre: 'Vendedor Uno',
      email: 'uno@ruta.mx',
      rolHandyId: 4,
      rolHandyAuthority: 'ROLE_SALES',
      activo: true,
      fotoUrl: null,
      ...over,
    });
  }

  async upsertProductos(productos: ProductoLocal[]): Promise<void> {
    this.lotesProductos.push(productos);
    for (const p of productos) {
      this.productos.set(p.code, {
        code: p.code,
        nombre: p.nombre,
        precioCentavos: p.precioCentavos,
        unidadCode: p.unidadCode,
        unidadDescripcion: p.unidadDescripcion,
        familia: p.familia,
        activo: p.activo,
      });
    }
  }

  async upsertVendedores(vendedores: VendedorHandyLocal[]): Promise<void> {
    this.lotesVendedores.push(vendedores);
    for (const v of vendedores) {
      const anterior = this.vendedores.get(v.idHandy);
      this.vendedores.set(v.idHandy, {
        idHandy: v.idHandy,
        nombre: v.nombre,
        email: v.email,
        rolHandyId: v.rolHandyId,
        rolHandyAuthority: v.rolHandyAuthority,
        activo: v.activo,
        fotoUrl:
          v.fotoUrl === undefined ? (anterior?.fotoUrl ?? null) : v.fotoUrl,
      });
    }
  }

  async buscarProductos(
    codes: string[],
  ): Promise<Map<string, ProductoGuardado>> {
    return new Map(
      codes
        .filter((c) => this.productos.has(c))
        .map((c) => [c, { ...this.productos.get(c)! }]),
    );
  }

  async buscarVendedores(ids: number[]): Promise<Map<number, VendedorGuardado>> {
    return new Map(
      ids
        .filter((id) => this.vendedores.has(id))
        .map((id) => [id, { ...this.vendedores.get(id)! }]),
    );
  }

  async listarCodesProductosActivos(): Promise<string[]> {
    return [...this.productos.values()]
      .filter((p) => p.activo)
      .map((p) => p.code);
  }

  async listarIdsVendedoresActivos(): Promise<number[]> {
    return [...this.vendedores.values()]
      .filter((v) => v.activo)
      .map((v) => v.idHandy);
  }

  async desactivarProductos(codes: string[]): Promise<void> {
    for (const code of codes) {
      this.productosDesactivados.push(code);
      const p = this.productos.get(code);
      if (p) p.activo = false;
    }
  }

  async desactivarVendedores(ids: number[]): Promise<void> {
    for (const id of ids) {
      this.vendedoresDesactivados.push(id);
      const v = this.vendedores.get(id);
      if (v) v.activo = false;
    }
  }

  resumen(): Promise<ResumenCache> {
    throw new Error('no usado en estas pruebas');
  }
}

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  CatalogoRepository,
  type ProductoLocal,
  type VendedorHandyLocal,
} from '../application/catalogo.repository';

/**
 * Adaptador Prisma del cache local de Handy. Aqui SI se conoce el esquema; la
 * capa de aplicacion solo ve el puerto `CatalogoRepository`.
 *
 * Se usa `upsert` (nunca `create` a secas) para que una re-sincronizacion no
 * duplique registros, y NUNCA se borra: un producto o vendedor deshabilitado en
 * Handy llega con `activo = false` y se conserva para no romper las referencias
 * del historial (docs/02 seccion 3.2).
 */
@Injectable()
export class PrismaCatalogoRepository extends CatalogoRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async upsertProductos(productos: ProductoLocal[]): Promise<void> {
    if (productos.length === 0) {
      return;
    }
    const sincronizadoEn = new Date();

    const upserts = productos.map((p) =>
      this.prisma.producto.upsert({
        where: { code: p.code },
        create: {
          code: p.code,
          nombre: p.nombre,
          precioCentavos: p.precioCentavos,
          unidadCode: p.unidadCode,
          unidadDescripcion: p.unidadDescripcion,
          familia: p.familia,
          activo: p.activo,
          lastUpdatedHandy: p.lastUpdatedHandy,
          ultimaSincronizacionLocal: sincronizadoEn,
          // Producto nuevo: el factor nace propuesto, nunca confirmado.
          piezasPorPaquete: p.piezasPorPaquetePropuesto,
          factorConfirmado: false,
        },
        // El factor de empaque NO se actualiza aqui: ver `propuestas`.
        update: {
          nombre: p.nombre,
          precioCentavos: p.precioCentavos,
          unidadCode: p.unidadCode,
          unidadDescripcion: p.unidadDescripcion,
          familia: p.familia,
          // Un producto que dejo de estar habilitado en Handy queda con
          // `activo = false`; el registro NO se elimina.
          activo: p.activo,
          lastUpdatedHandy: p.lastUpdatedHandy,
          ultimaSincronizacionLocal: sincronizadoEn,
        },
      }),
    );

    // Propuesta de factor para productos existentes. El `where` repite en la
    // base la regla del caso de uso (solo si no hay factor guardado ni
    // confirmado) para que una confirmacion hecha por un supervisor mientras
    // corre la sincronizacion nunca se pise.
    const propuestas = productos
      .filter((p) => p.piezasPorPaquetePropuesto !== null)
      .map((p) =>
        this.prisma.producto.updateMany({
          where: {
            code: p.code,
            piezasPorPaquete: null,
            factorConfirmado: false,
          },
          data: { piezasPorPaquete: p.piezasPorPaquetePropuesto },
        }),
      );

    await this.prisma.$transaction([...upserts, ...propuestas]);
  }

  async upsertVendedores(vendedores: VendedorHandyLocal[]): Promise<void> {
    if (vendedores.length === 0) {
      return;
    }
    const sincronizadoEn = new Date();

    await this.prisma.$transaction(
      vendedores.map((v) =>
        this.prisma.usuarioHandy.upsert({
          where: { idHandy: v.idHandy },
          create: {
            idHandy: v.idHandy,
            nombre: v.nombre,
            email: v.email,
            rolHandyId: v.rolHandyId,
            rolHandyAuthority: v.rolHandyAuthority,
            activo: v.activo,
            ultimaSincronizacion: sincronizadoEn,
          },
          update: {
            nombre: v.nombre,
            email: v.email,
            rolHandyId: v.rolHandyId,
            rolHandyAuthority: v.rolHandyAuthority,
            // Igual que con productos: un vendedor deshabilitado en Handy se
            // marca inactivo, nunca se borra (preserva la trazabilidad).
            activo: v.activo,
            ultimaSincronizacion: sincronizadoEn,
          },
        }),
      ),
    );
  }
}

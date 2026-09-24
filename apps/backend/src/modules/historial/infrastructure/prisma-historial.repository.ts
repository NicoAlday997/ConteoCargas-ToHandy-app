import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  HistorialRepository,
  type CargaConsolidada,
  type CargaHistorial,
  type EventoConsolidado,
  type FiltrosHistorial,
  type InicioSinLiquidar,
  type PaginaCargas,
  type ProductoConsolidado,
} from '../application/historial.repository';

/**
 * Adaptador Prisma del puerto `HistorialRepository`. Aqui SI se conoce el
 * esquema; la capa de aplicacion solo ve el puerto abstracto.
 *
 * Tanto el listado como el detalle resuelven ruta, vendedor, contador y
 * autorizador con un `include` sobre las relaciones de `EventoCarga` en una
 * sola consulta (Prisma la traduce a JOINs / una consulta batched por
 * relacion, no una consulta por fila): no hay N+1 por carga.
 */

/** Las unicas dos sesiones que participan en la comparacion (docs/02 seccion 3). */
const TIPOS_SESION_COMPARABLE = ['VENDEDOR', 'CONTADOR'] as const;

/** Permiso consumido al iniciar con la ruta anterior sin liquidar. */
const includePermiso = {
  select: {
    motivo: true,
    otorgadoPor: { select: { nombreCompleto: true } },
  },
} satisfies Prisma.EventoCarga$permisoCargaSinLiquidarArgs;

const includeListado = {
  ruta: { select: { nombre: true } },
  autorizadaPor: { select: { nombreCompleto: true } },
  permisoCargaSinLiquidar: includePermiso,
  sesiones: {
    where: { tipo: { in: [...TIPOS_SESION_COMPARABLE] } },
    select: {
      tipo: true,
      usuarioApp: { select: { nombreCompleto: true } },
      items: { select: { productoCode: true } },
    },
  },
  _count: { select: { discrepancias: true } },
} satisfies Prisma.EventoCargaInclude;

type FilaListado = Prisma.EventoCargaGetPayload<{ include: typeof includeListado }>;

const includeConsolidada = {
  ruta: { select: { nombre: true } },
  autorizadaPor: { select: { nombreCompleto: true } },
  permisoCargaSinLiquidar: includePermiso,
  sesiones: {
    where: { tipo: { in: [...TIPOS_SESION_COMPARABLE] } },
    select: {
      tipo: true,
      usuarioAppId: true,
      usuarioApp: { select: { nombreCompleto: true } },
      items: { select: { productoCode: true, cantidad: true } },
    },
  },
  discrepancias: {
    select: {
      productoCode: true,
      cantidadVendedorOriginal: true,
      cantidadContadorOriginal: true,
      cantidadFinal: true,
      usuarioCaptura: { select: { nombreCompleto: true } },
      usuarioConfirma: { select: { nombreCompleto: true } },
    },
  },
} satisfies Prisma.EventoCargaInclude;

type FilaConsolidada = Prisma.EventoCargaGetPayload<{
  include: typeof includeConsolidada;
}>;

@Injectable()
export class PrismaHistorialRepository extends HistorialRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listarCargas(filtros: FiltrosHistorial): Promise<PaginaCargas> {
    const where = this.aWhere(filtros);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.eventoCarga.findMany({
        where,
        include: includeListado,
        // Organizado por el dia para el que salio el camion, no por cuando se
        // conto; dentro del dia, lo mas reciente primero.
        orderBy: [
          { fechaOperativa: 'desc' },
          { fechaConteo: 'desc' },
          { creadoEn: 'desc' },
        ],
        skip: (filtros.page - 1) * filtros.pageSize,
        take: filtros.pageSize,
      }),
      this.prisma.eventoCarga.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.aCargaHistorial(row)),
      total,
      page: filtros.page,
      pageSize: filtros.pageSize,
    };
  }

  async obtenerCargaConsolidada(
    eventoId: string,
  ): Promise<CargaConsolidada | null> {
    const evento = await this.prisma.eventoCarga.findUnique({
      where: { id: eventoId },
      include: includeConsolidada,
    });
    if (evento === null) {
      return null;
    }

    const sesionVendedor = evento.sesiones.find((s) => s.tipo === 'VENDEDOR');
    const sesionContador = evento.sesiones.find((s) => s.tipo === 'CONTADOR');
    const cantidadesVendedor = new Map(
      sesionVendedor?.items.map((i) => [i.productoCode, i.cantidad]) ?? [],
    );
    const cantidadesContador = new Map(
      sesionContador?.items.map((i) => [i.productoCode, i.cantidad]) ?? [],
    );
    const discrepanciasPorProducto = new Map(
      evento.discrepancias.map((d) => [d.productoCode, d]),
    );

    // Union de los tres conjuntos: en el caso normal, discrepancias ya es
    // subconjunto de lo capturado, pero unirlos defensivamente evita perder un
    // producto si algun item se borro despues de compararse.
    const codigos = new Set<string>([
      ...cantidadesVendedor.keys(),
      ...cantidadesContador.keys(),
      ...discrepanciasPorProducto.keys(),
    ]);

    const catalogo = await this.prisma.producto.findMany({
      where: { code: { in: [...codigos] } },
      select: {
        code: true,
        nombre: true,
        unidadCode: true,
        unidadDescripcion: true,
        familia: true,
        modalidadVenta: true,
        piezasPorPaquete: true,
        factorConfirmado: true,
      },
    });
    const catalogoPorCode = new Map(catalogo.map((p) => [p.code, p]));

    const productos: ProductoConsolidado[] = [...codigos].map((productoCode) => {
      const info = catalogoPorCode.get(productoCode);
      const discrepancia = discrepanciasPorProducto.get(productoCode);

      const base = {
        productoCode,
        nombre: info?.nombre ?? productoCode,
        unidadCode: info?.unidadCode ?? '',
        unidadDescripcion: info?.unidadDescripcion ?? '',
        familia: info?.familia ?? null,
        modalidadVenta: info?.modalidadVenta ?? 'POR_PIEZA',
        piezasPorPaquete: info?.piezasPorPaquete ?? null,
        factorConfirmado: info?.factorConfirmado ?? false,
      };

      if (discrepancia) {
        return {
          ...base,
          cantidadFinal: discrepancia.cantidadFinal,
          tuvoDiscrepancia: true,
          cantidadVendedor: discrepancia.cantidadVendedorOriginal,
          cantidadContador: discrepancia.cantidadContadorOriginal,
          capturadaPorNombre: discrepancia.usuarioCaptura?.nombreCompleto ?? null,
          confirmadaPorNombre:
            discrepancia.usuarioConfirma?.nombreCompleto ?? null,
        };
      }

      // Sin discrepancia: ambos conteos coincidieron, asi que cualquiera de
      // los dos tiene la cantidad final.
      return {
        ...base,
        cantidadFinal:
          cantidadesVendedor.get(productoCode) ??
          cantidadesContador.get(productoCode) ??
          0,
        tuvoDiscrepancia: false,
        cantidadVendedor: null,
        cantidadContador: null,
        capturadaPorNombre: null,
        confirmadaPorNombre: null,
      };
    });

    return {
      evento: this.aEventoConsolidado(evento),
      productos,
      vendedorUsuarioAppId: sesionVendedor?.usuarioAppId ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Filtros y mapeo fila Prisma -> vista de la capa de aplicacion.
  // -------------------------------------------------------------------------

  private aWhere(filtros: FiltrosHistorial): Prisma.EventoCargaWhereInput {
    return {
      rutaId: filtros.rutaId,
      tipo: filtros.tipo,
      estado: filtros.estado,
      fechaOperativa:
        filtros.fechaInicio !== undefined || filtros.fechaFin !== undefined
          ? { gte: filtros.fechaInicio, lte: filtros.fechaFin }
          : undefined,
      // "Sus cargas" = las que conto como vendedor, aunque la ruta se haya
      // reasignado despues.
      sesiones:
        filtros.vendedorUsuarioAppId === undefined
          ? undefined
          : {
              some: {
                tipo: 'VENDEDOR',
                usuarioAppId: filtros.vendedorUsuarioAppId,
              },
            },
      // Cargas iniciadas con la ruta anterior sin liquidar (con permiso).
      rutaHandySinLiquidarId:
        filtros.sinLiquidar === undefined
          ? undefined
          : filtros.sinLiquidar
            ? { not: null }
            : null,
      // No hay restriccion por defecto entre "con" y "sin" discrepancia
      // (CLAUDE.md, docs/01 seccion 6 regla 4): `conDiscrepancia` es solo un
      // filtro mas que el supervisor puede o no aplicar.
      discrepancias:
        filtros.conDiscrepancia === undefined
          ? undefined
          : filtros.conDiscrepancia
            ? { some: {} }
            : { none: {} },
    };
  }

  private aCargaHistorial(row: FilaListado): CargaHistorial {
    const sesionVendedor = row.sesiones.find((s) => s.tipo === 'VENDEDOR');
    const sesionContador = row.sesiones.find((s) => s.tipo === 'CONTADOR');
    const codigos = new Set<string>([
      ...(sesionVendedor?.items.map((i) => i.productoCode) ?? []),
      ...(sesionContador?.items.map((i) => i.productoCode) ?? []),
    ]);

    return {
      id: row.id,
      rutaNombre: row.ruta.nombre,
      tipo: row.tipo,
      estado: row.estado,
      fechaOperativa: row.fechaOperativa,
      fechaConteo: row.fechaConteo,
      vendedorNombre: sesionVendedor?.usuarioApp.nombreCompleto ?? null,
      contadorNombre: sesionContador?.usuarioApp.nombreCompleto ?? null,
      totalProductos: codigos.size,
      productosConDiscrepancia: row._count.discrepancias,
      autorizada: row.autorizadaPorId !== null,
      autorizadaPorNombre: row.autorizadaPor?.nombreCompleto ?? null,
      inicioSinLiquidar: this.aInicioSinLiquidar(row),
      liquidacionNoVerificada: row.liquidacionNoVerificada,
    };
  }

  private aEventoConsolidado(row: FilaConsolidada): EventoConsolidado {
    const sesionVendedor = row.sesiones.find((s) => s.tipo === 'VENDEDOR');
    const sesionContador = row.sesiones.find((s) => s.tipo === 'CONTADOR');

    return {
      id: row.id,
      rutaNombre: row.ruta.nombre,
      tipo: row.tipo,
      estado: row.estado,
      fechaOperativa: row.fechaOperativa,
      fechaConteo: row.fechaConteo,
      vendedorNombre: sesionVendedor?.usuarioApp.nombreCompleto ?? null,
      contadorNombre: sesionContador?.usuarioApp.nombreCompleto ?? null,
      autorizada: row.autorizadaPorId !== null,
      autorizadaPorNombre: row.autorizadaPor?.nombreCompleto ?? null,
      inicioSinLiquidar: this.aInicioSinLiquidar(row),
      liquidacionNoVerificada: row.liquidacionNoVerificada,
    };
  }

  private aInicioSinLiquidar(
    row: FilaListado | FilaConsolidada,
  ): InicioSinLiquidar | null {
    if (row.rutaHandySinLiquidarId === null) {
      return null;
    }
    return {
      rutaHandyId: row.rutaHandySinLiquidarId,
      permisoOtorgadoPorNombre:
        row.permisoCargaSinLiquidar?.otorgadoPor.nombreCompleto ?? null,
      permisoMotivo: row.permisoCargaSinLiquidar?.motivo ?? null,
    };
  }
}

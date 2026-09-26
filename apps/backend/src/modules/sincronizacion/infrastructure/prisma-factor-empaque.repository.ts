import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  FactorEmpaqueRepository,
  type DatosConfirmarFactor,
  type FactorDeCatalogo,
  type FactorGuardado,
  type FactorPendiente,
  type FactorProducto,
} from '../application/factor-empaque.repository';

/** Columnas que forman un `FactorProducto`. */
const SELECT_FACTOR_PRODUCTO = {
  code: true,
  nombre: true,
  modalidadVenta: true,
  piezasPorPaquete: true,
  factorConfirmado: true,
  factorConfirmadoPorId: true,
  fechaConfirmacionFactor: true,
} as const;

/** Productos que cuentan como pendientes de confirmar el factor. */
const WHERE_PENDIENTE = { activo: true, factorConfirmado: false } as const;

/**
 * Carga que aun puede llegar a Handy. ENVIO_INCIERTO y ERROR_ENVIO cuentan:
 * ambos vuelven a LISTA_PARA_ENVIAR y se reintentan con lo ya calculado. Las
 * CANCELADAS no: ya nunca van a llegar.
 */
const ESTADO_NO_ENVIADA = { notIn: ['ENVIADA', 'CANCELADA'] } satisfies Prisma.EnumEstadoCargaFilter;

/**
 * Adaptador Prisma del factor de empaque. La propuesta automatica durante la
 * sincronizacion la escribe `PrismaCatalogoRepository.upsertProductos`; aqui
 * vive la lectura del estado y la confirmacion del supervisor.
 */
@Injectable()
export class PrismaFactorEmpaqueRepository extends FactorEmpaqueRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async buscarFactores(codes: string[]): Promise<Map<string, FactorGuardado>> {
    if (codes.length === 0) {
      return new Map();
    }
    const filas = await this.prisma.producto.findMany({
      where: { code: { in: codes } },
      select: { code: true, piezasPorPaquete: true, factorConfirmado: true },
    });
    return new Map(
      filas.map((f) => [
        f.code,
        {
          piezasPorPaquete: f.piezasPorPaquete,
          factorConfirmado: f.factorConfirmado,
        },
      ]),
    );
  }

  async listarPendientes(): Promise<FactorPendiente[]> {
    const filas = await this.prisma.producto.findMany({
      where: WHERE_PENDIENTE,
      select: {
        code: true,
        nombre: true,
        familia: true,
        modalidadVenta: true,
        piezasPorPaquete: true,
      },
      orderBy: { nombre: 'asc' },
    });
    return filas.map((f) => ({
      code: f.code,
      nombre: f.nombre,
      familia: f.familia,
      modalidadVenta: f.modalidadVenta,
      piezasPorPaqueteSugerido: f.piezasPorPaquete,
    }));
  }

  contarPendientes(): Promise<number> {
    return this.prisma.producto.count({ where: WHERE_PENDIENTE });
  }

  buscarPorCode(code: string): Promise<FactorProducto | null> {
    return this.prisma.producto.findUnique({
      where: { code },
      select: SELECT_FACTOR_PRODUCTO,
    });
  }

  async listarTodos(): Promise<FactorDeCatalogo[]> {
    const filas = await this.prisma.producto.findMany({
      where: { activo: true },
      select: {
        code: true,
        nombre: true,
        familia: true,
        modalidadVenta: true,
        piezasPorPaquete: true,
        factorConfirmado: true,
        fechaConfirmacionFactor: true,
        factorConfirmadoPor: { select: { nombreCompleto: true } },
      },
      orderBy: { nombre: 'asc' },
    });
    return filas.map((f) => ({
      code: f.code,
      nombre: f.nombre,
      familia: f.familia,
      modalidadVenta: f.modalidadVenta,
      piezasPorPaquete: f.piezasPorPaquete,
      factorConfirmado: f.factorConfirmado,
      confirmadoPor: f.factorConfirmadoPor?.nombreCompleto ?? null,
      fechaConfirmacionFactor: f.fechaConfirmacionFactor,
    }));
  }

  contarCargasEnCursoConProducto(code: string): Promise<number> {
    return this.prisma.eventoCarga.count({
      where: {
        estado: ESTADO_NO_ENVIADA,
        sesiones: { some: { items: { some: { productoCode: code } } } },
      },
    });
  }

  async confirmar(datos: DatosConfirmarFactor): Promise<FactorProducto> {
    const [producto] = await this.prisma.$transaction([
      this.prisma.producto.update({
        where: { code: datos.productoCode },
        data: {
          modalidadVenta: datos.modalidadVenta,
          piezasPorPaquete: datos.piezasPorPaquete,
          factorConfirmado: true,
          factorConfirmadoPorId: datos.confirmadoPorId,
          fechaConfirmacionFactor: datos.fecha,
        },
        select: SELECT_FACTOR_PRODUCTO,
      }),
      this.prisma.cambioFactorEmpaque.create({
        data: {
          productoCode: datos.productoCode,
          modalidadAnterior: datos.anterior.modalidadVenta,
          piezasAnterior: datos.anterior.piezasPorPaquete,
          estabaConfirmado: datos.anterior.factorConfirmado,
          modalidadNueva: datos.modalidadVenta,
          piezasNueva: datos.piezasPorPaquete,
          cambiadoPorId: datos.confirmadoPorId,
          fecha: datos.fecha,
          cargasEnCurso: datos.cargasEnCurso,
        },
      }),
    ]);
    return producto;
  }
}

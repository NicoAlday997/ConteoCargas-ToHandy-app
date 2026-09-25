import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  PlantillaRepository,
  type DatosActualizarPlantilla,
  type DatosCrearPlantilla,
  type Plantilla,
  type ProductoDePlantilla,
  type ResumenPlantilla,
  type RutaConPlantilla,
  type RutaDePlantilla,
} from '../application/plantilla.repository';

/**
 * Adaptador Prisma del puerto `PlantillaRepository`. Aqui SI se conoce el
 * esquema; la capa de aplicacion solo ve el puerto.
 */
@Injectable()
export class PrismaPlantillaRepository extends PlantillaRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private static readonly SELECT_PLANTILLA = {
    id: true,
    nombre: true,
    descripcion: true,
    activa: true,
    creadaEn: true,
    actualizadaEn: true,
  } satisfies Prisma.PlantillaCargaSelect;

  private static readonly SELECT_RUTA = {
    id: true,
    nombre: true,
    codigo: true,
  } satisfies Prisma.RutaSelect;

  private static readonly VIGENTE = {
    vigenteHasta: null,
  } satisfies Prisma.AsignacionRutaVendedorWhereInput;

  async listar(incluirInactivas: boolean): Promise<ResumenPlantilla[]> {
    const filas = await this.prisma.plantillaCarga.findMany({
      where: incluirInactivas ? {} : { activa: true },
      select: {
        ...PrismaPlantillaRepository.SELECT_PLANTILLA,
        _count: { select: { productos: true } },
        asignaciones: {
          where: PrismaPlantillaRepository.VIGENTE,
          select: { ruta: { select: PrismaPlantillaRepository.SELECT_RUTA } },
        },
      },
      orderBy: [{ activa: 'desc' }, { nombre: 'asc' }],
    });

    return filas.map(({ _count, asignaciones, ...plantilla }) => ({
      ...plantilla,
      totalProductos: _count.productos,
      rutas: rutasUnicas(asignaciones.map((a) => a.ruta)),
    }));
  }

  async buscarPorId(id: string): Promise<Plantilla | null> {
    return this.prisma.plantillaCarga.findUnique({
      where: { id },
      select: PrismaPlantillaRepository.SELECT_PLANTILLA,
    });
  }

  async listarNombres(): Promise<Array<{ id: string; nombre: string }>> {
    return this.prisma.plantillaCarga.findMany({
      select: { id: true, nombre: true },
    });
  }

  async listarProductos(plantillaId: string): Promise<ProductoDePlantilla[]> {
    const filas = await this.prisma.plantillaProducto.findMany({
      where: { plantillaId },
      select: {
        producto: {
          select: {
            code: true,
            nombre: true,
            familia: true,
            modalidadVenta: true,
            piezasPorPaquete: true,
            factorConfirmado: true,
            activo: true,
          },
        },
      },
    });
    return filas.map((f) => f.producto);
  }

  async listarRutasVigentes(plantillaId: string): Promise<RutaDePlantilla[]> {
    const asignaciones = await this.prisma.asignacionRutaVendedor.findMany({
      where: { plantillaId, ...PrismaPlantillaRepository.VIGENTE },
      select: { ruta: { select: PrismaPlantillaRepository.SELECT_RUTA } },
    });
    return rutasUnicas(asignaciones.map((a) => a.ruta));
  }

  async crear(datos: DatosCrearPlantilla): Promise<Plantilla> {
    return this.prisma.plantillaCarga.create({
      data: { nombre: datos.nombre, descripcion: datos.descripcion },
      select: PrismaPlantillaRepository.SELECT_PLANTILLA,
    });
  }

  async actualizar(
    id: string,
    datos: DatosActualizarPlantilla,
  ): Promise<Plantilla> {
    return this.prisma.plantillaCarga.update({
      where: { id },
      // `undefined` = Prisma no toca el campo: un PATCH parcial.
      data: {
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        activa: datos.activa,
      },
      select: PrismaPlantillaRepository.SELECT_PLANTILLA,
    });
  }

  async buscarCodigosExistentes(codes: string[]): Promise<Set<string>> {
    if (codes.length === 0) return new Set();
    const filas = await this.prisma.producto.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    return new Set(filas.map((f) => f.code));
  }

  async agregarProductos(
    plantillaId: string,
    codes: string[],
  ): Promise<number> {
    if (codes.length === 0) return 0;
    // El indice unico (plantillaId, productoCode) descarta los que ya estaban,
    // incluso si otro supervisor los agrego al mismo tiempo.
    const { count } = await this.prisma.plantillaProducto.createMany({
      data: codes.map((productoCode) => ({ plantillaId, productoCode })),
      skipDuplicates: true,
    });
    return count;
  }

  async quitarProductos(plantillaId: string, codes: string[]): Promise<number> {
    if (codes.length === 0) return 0;
    const { count } = await this.prisma.plantillaProducto.deleteMany({
      where: { plantillaId, productoCode: { in: codes } },
    });
    return count;
  }

  async listarRutas(): Promise<RutaConPlantilla[]> {
    const rutas = await this.prisma.ruta.findMany({
      where: { activa: true },
      select: {
        ...PrismaPlantillaRepository.SELECT_RUTA,
        asignaciones: {
          where: PrismaPlantillaRepository.VIGENTE,
          select: {
            usuarioApp: { select: { nombreCompleto: true } },
            plantilla: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    return rutas.map(({ asignaciones, ...ruta }) => {
      const plantillas = new Map<string, { id: string; nombre: string }>();
      for (const a of asignaciones) {
        if (a.plantilla) plantillas.set(a.plantilla.id, a.plantilla);
      }
      return {
        ...ruta,
        vendedores: asignaciones.map((a) => a.usuarioApp.nombreCompleto),
        plantillas: [...plantillas.values()],
        sinPlantilla: asignaciones.some((a) => a.plantilla === null),
      };
    });
  }

  async buscarRuta(
    rutaId: string,
  ): Promise<{ id: string; activa: boolean } | null> {
    return this.prisma.ruta.findUnique({
      where: { id: rutaId },
      select: { id: true, activa: true },
    });
  }

  async asignarARuta(rutaId: string, plantillaId: string): Promise<number> {
    const { count } = await this.prisma.asignacionRutaVendedor.updateMany({
      where: { rutaId, ...PrismaPlantillaRepository.VIGENTE },
      data: { plantillaId },
    });
    return count;
  }
}

/** Varios vendedores pueden compartir ruta: cada ruta una sola vez, por nombre. */
function rutasUnicas(rutas: RutaDePlantilla[]): RutaDePlantilla[] {
  const porId = new Map(rutas.map((r) => [r.id, r]));
  return [...porId.values()].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { numeric: true }),
  );
}

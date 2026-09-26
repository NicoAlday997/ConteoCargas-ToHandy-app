import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  ConsultasCargaRepository,
  type CargaConConflictos,
  type CargaPendienteVerificacion,
  type DiaRecargable,
  type DiscrepanciaDetalle,
  type LadoDiscrepancia,
} from '../application/consultas-carga.repository';

/**
 * Adaptador Prisma del puerto de lectura `ConsultasCargaRepository`. Cada vista
 * se resuelve con un `include` sobre las relaciones de `EventoCarga` (una sola
 * consulta por listado, sin N+1 por fila), igual que el historial.
 */

const includePendientes = {
  ruta: { select: { nombre: true } },
  usuarioHandy: { select: { nombre: true } },
  sesiones: {
    where: { tipo: { in: ['VENDEDOR', 'CONTADOR'] } },
    select: {
      id: true,
      tipo: true,
      usuarioAppId: true,
      estado: true,
      usuarioApp: { select: { nombreCompleto: true } },
      _count: { select: { items: true } },
    },
  },
} satisfies Prisma.EventoCargaInclude;

type FilaPendiente = Prisma.EventoCargaGetPayload<{
  include: typeof includePendientes;
}>;

@Injectable()
export class PrismaConsultasCargaRepository extends ConsultasCargaRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listarPendientesVerificacion(): Promise<CargaPendienteVerificacion[]> {
    const rows = await this.prisma.eventoCarga.findMany({
      where: {
        estado: { in: ['EN_ESPERA_CONTADOR', 'BLOQUEADA_CORTE_PENDIENTE'] },
      },
      include: includePendientes,
      // La que lleva mas tiempo esperando va primero.
      orderBy: [{ fechaConteo: 'asc' }, { creadoEn: 'asc' }],
    });
    return rows.map((row) => this.aPendiente(row));
  }

  async listarConflictosDeParticipante(
    usuarioAppId: string,
  ): Promise<CargaConConflictos[]> {
    const rows = await this.prisma.eventoCarga.findMany({
      where: {
        estado: 'CONFLICTOS_PENDIENTES',
        sesiones: { some: { usuarioAppId } },
      },
      include: {
        ruta: { select: { nombre: true } },
        discrepancias: { select: { confirmadaPor: true } },
      },
      orderBy: [{ fechaConteo: 'asc' }, { creadoEn: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      rutaNombre: row.ruta.nombre,
      tipo: row.tipo,
      fechaConteo: row.fechaConteo,
      totalDiscrepancias: row.discrepancias.length,
      resueltas: row.discrepancias.filter((d) => d.confirmadaPor !== null)
        .length,
    }));
  }

  async listarInicialesEnviadasDesde(
    rutaId: string,
    desde: Date,
  ): Promise<DiaRecargable[]> {
    const rows = await this.prisma.eventoCarga.findMany({
      where: {
        rutaId,
        tipo: 'INICIAL',
        estado: 'ENVIADA',
        fechaOperativa: { gte: desde },
      },
      select: { id: true, fechaOperativa: true },
      orderBy: { fechaOperativa: 'asc' },
    });
    return rows.map((row) => ({
      fechaOperativa: row.fechaOperativa,
      eventoInicialId: row.id,
    }));
  }

  async listarDiscrepanciasDetalle(
    eventoId: string,
  ): Promise<DiscrepanciaDetalle[]> {
    const rows = await this.prisma.discrepanciaResuelta.findMany({
      where: { eventoCargaId: eventoId },
      include: {
        producto: {
          select: {
            nombre: true,
            unidadDescripcion: true,
            modalidadVenta: true,
            piezasPorPaquete: true,
            factorConfirmado: true,
          },
        },
        usuarioCaptura: { select: { nombreCompleto: true } },
        usuarioConfirma: { select: { nombreCompleto: true } },
      },
      orderBy: { producto: { nombre: 'asc' } },
    });
    const sesiones = await this.prisma.sesionConteo.findMany({
      where: { eventoCargaId: eventoId },
      select: {
        id: true,
        tipo: true,
        estado: true,
        items: {
          where: { productoCode: { in: rows.map((r) => r.productoCode) } },
          select: {
            productoCode: true,
            paquetes: true,
            sueltas: true,
            cantidad: true,
          },
        },
      },
      orderBy: { iniciadaEn: 'asc' },
    });
    // Mismo criterio que `FinalizarSesionUseCase` al comparar: el primer conteo
    // es la sesion VENDEDOR; el segundo, la otra sesion cerrada.
    const primera = sesiones.find((s) => s.tipo === 'VENDEDOR');
    const segunda = sesiones.find(
      (s) => s.estado === 'CERRADA' && s.id !== primera?.id,
    );
    const lado = (
      sesion: (typeof sesiones)[number] | undefined,
      productoCode: string,
      piezas: number,
    ): LadoDiscrepancia => {
      const item = sesion?.items.find((i) => i.productoCode === productoCode);
      // Sin item la sesion no conto el producto: 0 piezas, 0 + 0 tecleado.
      const coincide = item ? item.cantidad === piezas : piezas === 0;
      return {
        tipoSesion: sesion?.tipo ?? null,
        paquetes: coincide ? (item?.paquetes ?? 0) : null,
        sueltas: coincide ? (item?.sueltas ?? 0) : null,
      };
    };

    return rows.map((r) => ({
      productoCode: r.productoCode,
      cantidadVendedorOriginal: r.cantidadVendedorOriginal,
      cantidadContadorOriginal: r.cantidadContadorOriginal,
      cantidadFinal: r.cantidadFinal,
      capturadaPor: r.capturadaPor,
      fechaCaptura: r.fechaCaptura,
      confirmadaPor: r.confirmadaPor,
      fechaConfirmacion: r.fechaConfirmacion,
      productoNombre: r.producto.nombre,
      unidadDescripcion: r.producto.unidadDescripcion,
      modalidadVenta: r.producto.modalidadVenta,
      piezasPorPaquete: r.producto.piezasPorPaquete,
      factorConfirmado: r.producto.factorConfirmado,
      capturadaPorNombre: r.usuarioCaptura?.nombreCompleto ?? null,
      confirmadaPorNombre: r.usuarioConfirma?.nombreCompleto ?? null,
      primerConteo: lado(primera, r.productoCode, r.cantidadVendedorOriginal),
      segundoConteo: lado(segunda, r.productoCode, r.cantidadContadorOriginal),
    }));
  }

  private aPendiente(row: FilaPendiente): CargaPendienteVerificacion {
    const vendedor = row.sesiones.find((s) => s.tipo === 'VENDEDOR');
    const contador = row.sesiones.find((s) => s.tipo === 'CONTADOR');
    return {
      id: row.id,
      rutaNombre: row.ruta.nombre,
      // El nombre en la app es el que conoce el contador; el de Handy es respaldo.
      vendedorNombre:
        vendedor?.usuarioApp.nombreCompleto ?? row.usuarioHandy.nombre ?? null,
      tipo: row.tipo,
      fechaConteo: row.fechaConteo,
      totalProductos: vendedor?._count.items ?? 0,
      bloqueadaPorCorte: row.estado === 'BLOQUEADA_CORTE_PENDIENTE',
      fechaBloqueoCortePendiente: row.fechaBloqueoCortePendiente,
      sesionContador:
        contador === undefined
          ? null
          : {
              id: contador.id,
              usuarioAppId: contador.usuarioAppId,
              usuarioNombre: contador.usuarioApp.nombreCompleto,
              estado: contador.estado,
            },
    };
  }
}

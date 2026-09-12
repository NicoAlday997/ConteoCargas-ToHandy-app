import { Injectable } from '@nestjs/common';
import type {
  EstadoCarga,
  EventoCarga as EventoCargaRow,
  DiscrepanciaResuelta as DiscrepanciaRow,
  SesionConteo as SesionConteoRow,
  TipoSesion,
  UbicacionConteo,
} from '@prisma/client';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  CargaRepository,
  type DatosActualizarDiscrepancia,
  type DatosCrearEvento,
  type DatosReabrirDiscrepancia,
  type Discrepancia,
  type DiscrepanciaAGuardar,
  type EventoCarga,
  type ItemAGuardar,
  type ItemCapturado,
  type SesionConteo,
} from '../application/carga.repository';

/**
 * Adaptador Prisma del puerto `CargaRepository`. Aqui SI se conoce el esquema y
 * las claves compuestas; la capa de aplicacion solo ve el puerto abstracto.
 *
 * Las cantidades de una sesion se reemplazan en bloque (borrar + `createMany`
 * dentro de una transaccion), nunca con `upsert` producto a producto: es mas
 * rapido y no deja huerfanos cuando el usuario quita un producto que ya habia
 * capturado.
 */
@Injectable()
export class PrismaCargaRepository extends CargaRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async crearEvento(datos: DatosCrearEvento): Promise<EventoCarga> {
    const row = await this.prisma.eventoCarga.create({
      data: {
        // `rutaId`, `plantillaId` y `tipoOperacion` son SNAPSHOT del momento:
        // se copian de la asignacion vigente y no cambian si el vendedor se
        // reasigna despues.
        rutaId: datos.rutaId,
        plantillaId: datos.plantillaId,
        tipoOperacion: datos.tipoOperacion,
        tipo: datos.tipo,
        usuarioHandyId: datos.usuarioHandyId,
        fechaConteo: datos.fechaConteo,
        // `estado` se queda en el default `BORRADOR` del esquema.
      },
    });
    return this.aEventoCarga(row);
  }

  async buscarEventoPorId(id: string): Promise<EventoCarga | null> {
    const row = await this.prisma.eventoCarga.findUnique({ where: { id } });
    return row === null ? null : this.aEventoCarga(row);
  }

  async cambiarEstado(
    eventoId: string,
    nuevoEstado: EstadoCarga,
  ): Promise<EventoCarga> {
    const row = await this.prisma.eventoCarga.update({
      where: { id: eventoId },
      data: { estado: nuevoEstado },
    });
    return this.aEventoCarga(row);
  }

  async marcarComoEnviada(
    eventoId: string,
    idHandy: string,
    ahora: Date,
  ): Promise<EventoCarga> {
    const row = await this.prisma.eventoCarga.update({
      where: { id: eventoId },
      // Los tres campos se fijan juntos para no dejar una ventana con `idHandy`
      // puesto pero el estado aun en `LISTA_PARA_ENVIAR`.
      data: { idHandy, fechaEnvioReal: ahora, estado: 'ENVIADA' },
    });
    return this.aEventoCarga(row);
  }

  async autorizarEvento(
    eventoId: string,
    autorizadaPorId: string,
    ahora: Date,
  ): Promise<EventoCarga> {
    const row = await this.prisma.eventoCarga.update({
      where: { id: eventoId },
      // Los tres campos se fijan juntos: sin ventana con `autorizadaPorId`
      // puesto pero el estado aun en `EN_ESPERA_AUTORIZACION`.
      data: {
        autorizadaPorId,
        fechaAutorizacion: ahora,
        estado: 'LISTA_PARA_ENVIAR',
      },
    });
    return this.aEventoCarga(row);
  }

  async crearSesion(
    eventoId: string,
    tipo: TipoSesion,
    usuarioAppId: string,
    dispositivoId?: string,
    ubicacion?: UbicacionConteo,
  ): Promise<SesionConteo> {
    const row = await this.prisma.sesionConteo.create({
      data: {
        eventoCargaId: eventoId,
        tipo,
        usuarioAppId,
        dispositivoId,
        ubicacion,
        // `estado` se queda en el default `ABIERTA` del esquema.
      },
    });
    return this.aSesionConteo(row);
  }

  async buscarSesionPorId(sesionId: string): Promise<SesionConteo | null> {
    const row = await this.prisma.sesionConteo.findUnique({
      where: { id: sesionId },
    });
    return row === null ? null : this.aSesionConteo(row);
  }

  async guardarItems(sesionId: string, items: ItemAGuardar[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Reemplazo total: primero se borra lo capturado antes en la sesion.
      await tx.conteoItem.deleteMany({ where: { sesionId } });
      if (items.length > 0) {
        await tx.conteoItem.createMany({
          data: items.map((i) => ({
            sesionId,
            productoCode: i.productoCode,
            cantidad: i.cantidad,
          })),
        });
      }
    });
  }

  async finalizarSesion(sesionId: string, ahora: Date): Promise<SesionConteo> {
    const row = await this.prisma.sesionConteo.update({
      where: { id: sesionId },
      data: { estado: 'CERRADA', finalizadaEn: ahora },
    });
    return this.aSesionConteo(row);
  }

  async listarItemsDeSesion(sesionId: string): Promise<ItemCapturado[]> {
    return this.prisma.conteoItem.findMany({
      where: { sesionId },
      select: { productoCode: true, cantidad: true },
      orderBy: { productoCode: 'asc' },
    });
  }

  async listarSesionesDeEvento(eventoId: string): Promise<SesionConteo[]> {
    const rows = await this.prisma.sesionConteo.findMany({
      where: { eventoCargaId: eventoId },
      orderBy: { iniciadaEn: 'asc' },
    });
    // El mapeo devuelve la sesion completa, incluidos `tipo` y `usuarioAppId`,
    // que el caso de uso necesita para distinguir el conteo del vendedor del
    // segundo conteo y para el control de dueño de la sesion.
    return rows.map((r) => this.aSesionConteo(r));
  }

  async guardarDiscrepancias(
    eventoId: string,
    discrepancias: DiscrepanciaAGuardar[],
  ): Promise<void> {
    if (discrepancias.length === 0) {
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.discrepanciaResuelta.createMany({
        data: discrepancias.map((d) => ({
          eventoCargaId: eventoId,
          productoCode: d.productoCode,
          cantidadVendedorOriginal: d.cantidadVendedorOriginal,
          cantidadContadorOriginal: d.cantidadContadorOriginal,
        })),
        // Si un `productoCode` ya tenia fila (con su captura/confirmacion), se
        // respeta: solo se insertan las discrepancias nuevas del evento.
        skipDuplicates: true,
      });
    });
  }

  async listarDiscrepancias(eventoId: string): Promise<Discrepancia[]> {
    const rows = await this.prisma.discrepanciaResuelta.findMany({
      where: { eventoCargaId: eventoId },
      orderBy: { productoCode: 'asc' },
    });
    return rows.map((r) => this.aDiscrepancia(r));
  }

  async actualizarDiscrepancia(
    eventoId: string,
    productoCode: string,
    datos: DatosActualizarDiscrepancia,
  ): Promise<Discrepancia> {
    const row = await this.prisma.discrepanciaResuelta.update({
      // Clave compuesta `(eventoCargaId, productoCode)` del `@@unique` del modelo.
      where: {
        eventoCargaId_productoCode: { eventoCargaId: eventoId, productoCode },
      },
      data: {
        // `undefined` = Prisma no toca el campo: permite aplicar la captura y la
        // confirmacion cruzada en llamadas separadas.
        cantidadFinal: datos.cantidadFinal,
        capturadaPor: datos.capturadaPor,
        fechaCaptura: datos.fechaCaptura,
        confirmadaPor: datos.confirmadaPor,
        fechaConfirmacion: datos.fechaConfirmacion,
      },
    });
    return this.aDiscrepancia(row);
  }

  async reabrirDiscrepancia(
    eventoId: string,
    datos: DatosReabrirDiscrepancia,
  ): Promise<Discrepancia> {
    const row = await this.prisma.discrepanciaResuelta.upsert({
      where: {
        eventoCargaId_productoCode: {
          eventoCargaId: eventoId,
          productoCode: datos.productoCode,
        },
      },
      create: {
        eventoCargaId: eventoId,
        productoCode: datos.productoCode,
        cantidadVendedorOriginal: datos.cantidadVendedorOriginal,
        cantidadContadorOriginal: datos.cantidadContadorOriginal,
        cantidadFinal: datos.cantidadFinal ?? null,
        capturadaPor: datos.capturadaPor ?? null,
        fechaCaptura: datos.fechaCaptura ?? null,
      },
      // A diferencia de guardarDiscrepancias (createMany + skipDuplicates), aca
      // se sobreescribe la fila entera si ya existia: confirmadaPor y
      // fechaConfirmacion SIEMPRE quedan en null, aunque la discrepancia ya
      // estuviera confirmada.
      update: {
        cantidadVendedorOriginal: datos.cantidadVendedorOriginal,
        cantidadContadorOriginal: datos.cantidadContadorOriginal,
        cantidadFinal: datos.cantidadFinal ?? null,
        capturadaPor: datos.capturadaPor ?? null,
        fechaCaptura: datos.fechaCaptura ?? null,
        confirmadaPor: null,
        fechaConfirmacion: null,
      },
    });
    return this.aDiscrepancia(row);
  }

  // -------------------------------------------------------------------------
  // Mapeo fila Prisma -> vista de la capa de aplicacion (select explicito para
  // no arrastrar campos internos del esquema al contrato del puerto).
  // -------------------------------------------------------------------------

  private aEventoCarga(row: EventoCargaRow): EventoCarga {
    return {
      id: row.id,
      rutaId: row.rutaId,
      plantillaId: row.plantillaId,
      tipo: row.tipo,
      tipoOperacion: row.tipoOperacion,
      usuarioHandyId: row.usuarioHandyId,
      estado: row.estado,
      fechaConteo: row.fechaConteo,
      autorizadaPorId: row.autorizadaPorId,
      fechaAutorizacion: row.fechaAutorizacion,
      creadoEn: row.creadoEn,
    };
  }

  private aSesionConteo(row: SesionConteoRow): SesionConteo {
    return {
      id: row.id,
      eventoCargaId: row.eventoCargaId,
      tipo: row.tipo,
      usuarioAppId: row.usuarioAppId,
      dispositivoId: row.dispositivoId,
      ubicacion: row.ubicacion,
      estado: row.estado,
      iniciadaEn: row.iniciadaEn,
      finalizadaEn: row.finalizadaEn,
    };
  }

  private aDiscrepancia(row: DiscrepanciaRow): Discrepancia {
    return {
      productoCode: row.productoCode,
      cantidadVendedorOriginal: row.cantidadVendedorOriginal,
      cantidadContadorOriginal: row.cantidadContadorOriginal,
      cantidadFinal: row.cantidadFinal,
      capturadaPor: row.capturadaPor,
      fechaCaptura: row.fechaCaptura,
      confirmadaPor: row.confirmadaPor,
      fechaConfirmacion: row.fechaConfirmacion,
    };
  }
}

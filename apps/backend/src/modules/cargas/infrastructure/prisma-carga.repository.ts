import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  CargaInicialDuplicadaError,
  CargaInicialSinTerminarError,
  CargaRepository,
  type DatosActualizarDiscrepancia,
  type DatosConfirmarDiscrepancia,
  type DatosSesionInicial,
  type DecidirEstadoTrasConfirmar,
  type DatosCambiarFechaOperativa,
  type DatosRecorrerFechaOperativa,
  type DatosCrearEvento,
  type DatosReabrirDiscrepancia,
  type Discrepancia,
  type DiscrepanciaAGuardar,
  type CapturaGuardada,
  type EventoCarga,
  type ItemAGuardar,
  type ItemCapturado,
  type SesionConteo,
} from '../application/carga.repository';

/**
 * Indice unico parcial creado a mano en la migracion
 * `20261002120000_inicial_sin_terminar_unica` (Prisma no los modela): una sola
 * INICIAL sin terminar por ruta, sin importar la fecha.
 */
const INDICE_INICIAL_SIN_TERMINAR = 'evento_carga_inicial_sin_terminar_unica';

/**
 * `true` si la violacion de unicidad es la de ese indice y no la de
 * `eventos_carga_inicial_ruta_fecha_key` (ruta + fecha). Prisma reporta en
 * `meta.target` el nombre del indice o las columnas, segun la version: con
 * columnas, solo `rutaId` (sin `fechaOperativa`) es el indice nuevo.
 */
function violaInicialSinTerminar(
  error: Prisma.PrismaClientKnownRequestError,
): boolean {
  const target = error.meta?.target;
  const texto = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return texto.includes(INDICE_INICIAL_SIN_TERMINAR) || texto === 'rutaId';
}

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

  async crearEventoConSesion(
    datos: DatosCrearEvento,
    sesion: DatosSesionInicial,
  ): Promise<{ evento: EventoCarga; sesion: SesionConteo }> {
    try {
      // Una transaccion: si la sesion no se puede crear, el evento tampoco
      // queda (una INICIAL sin sesion bloquearia la ruta).
      return await this.prisma.$transaction(async (tx) => {
        const evento = await tx.eventoCarga.create({
          data: {
            // `rutaId`, `plantillaId` y `tipoOperacion` son SNAPSHOT del
            // momento: se copian de la asignacion vigente y no cambian si el
            // vendedor se reasigna despues.
            rutaId: datos.rutaId,
            plantillaId: datos.plantillaId,
            tipoOperacion: datos.tipoOperacion,
            tipo: datos.tipo,
            usuarioHandyId: datos.usuarioHandyId,
            fechaConteo: datos.fechaConteo,
            fechaOperativa: datos.fechaOperativa,
            // `estado` se queda en el default `BORRADOR` del esquema.
          },
        });
        const creada = await tx.sesionConteo.create({
          data: {
            eventoCargaId: evento.id,
            tipo: sesion.tipo,
            usuarioAppId: sesion.usuarioAppId,
            // `estado` se queda en el default `ABIERTA` del esquema.
          },
        });
        return {
          evento: this.aEventoCarga(evento),
          sesion: this.aSesionConteo(creada),
        };
      });
    } catch (error) {
      // P2002 = violacion de unicidad. Del alta del evento solo puede venir de
      // uno de los dos indices parciales de la INICIAL: "una sin terminar por
      // ruta" o "una por ruta y fecha operativa". La sesion acaba de nacer con
      // un evento nuevo, asi que su `(eventoCargaId, usuarioAppId)` no choca.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw violaInicialSinTerminar(error)
          ? new CargaInicialSinTerminarError()
          : new CargaInicialDuplicadaError();
      }
      throw error;
    }
  }

  async buscarEventoPorId(id: string): Promise<EventoCarga | null> {
    const row = await this.prisma.eventoCarga.findUnique({ where: { id } });
    return row === null ? null : this.aEventoCarga(row);
  }

  async buscarCargaInicialDeFecha(
    rutaId: string,
    fechaOperativa: Date,
  ): Promise<EventoCarga | null> {
    // Las CANCELADAS no cuentan: si no, cancelar una carga inicial abierta por
    // error dejaria el dia bloqueado (mismo criterio que el indice parcial).
    const row = await this.prisma.eventoCarga.findFirst({
      where: {
        rutaId,
        fechaOperativa,
        tipo: 'INICIAL',
        estado: { not: 'CANCELADA' },
      },
      orderBy: { creadoEn: 'asc' },
    });
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

  async bloquearPorCortePendiente(
    eventoId: string,
    ahora: Date,
  ): Promise<EventoCarga> {
    const row = await this.prisma.eventoCarga.update({
      where: { id: eventoId },
      // Los dos campos se fijan juntos: sin ventana con `fechaBloqueoCortePendiente`
      // puesto pero el estado aun en `EN_ESPERA_CONTADOR`.
      data: {
        fechaBloqueoCortePendiente: ahora,
        estado: 'BLOQUEADA_CORTE_PENDIENTE',
      },
    });
    return this.aEventoCarga(row);
  }

  async desbloquearEvento(eventoId: string, ahora: Date): Promise<EventoCarga> {
    const row = await this.prisma.eventoCarga.update({
      where: { id: eventoId },
      data: { fechaDesbloqueo: ahora, estado: 'EN_ESPERA_CONTADOR' },
    });
    return this.aEventoCarga(row);
  }

  async cancelarEvento(
    eventoId: string,
    usuarioAppId: string,
    motivo: string | null,
    ahora: Date,
  ): Promise<EventoCarga> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.eventoCarga.update({
        where: { id: eventoId },
        data: {
          estado: 'CANCELADA',
          canceladaPorId: usuarioAppId,
          fechaCancelacion: ahora,
          motivoCancelacion: motivo,
        },
      });
      // Una sesion abierta de un evento cancelado apareceria como pendiente en
      // la cola del contador o en "Continuar carga": se cierran todas.
      await tx.sesionConteo.updateMany({
        where: { eventoCargaId: eventoId, estado: 'ABIERTA' },
        data: { estado: 'CERRADA', finalizadaEn: ahora },
      });
      return this.aEventoCarga(row);
    });
  }

  async cambiarFechaOperativa(
    datos: DatosCambiarFechaOperativa,
  ): Promise<EventoCarga> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.eventoCarga.update({
          where: { id: datos.eventoId },
          data: { fechaOperativa: datos.fechaNueva },
        });
        await tx.cambioFechaOperativa.create({
          data: {
            eventoCargaId: datos.eventoId,
            fechaAnterior: datos.fechaAnterior,
            fechaNueva: datos.fechaNueva,
            cambiadaPorId: datos.cambiadaPorId,
            motivo: datos.motivo,
          },
        });
        // Sesiones e items no se tocan: cuelgan de la sesion, no de la fecha.
        return this.aEventoCarga(row);
      });
    } catch (error) {
      // Mismo indice parcial que en `crearEventoConSesion`: una INICIAL por ruta y fecha.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new CargaInicialDuplicadaError();
      }
      throw error;
    }
  }

  async recorrerFechaOperativa(
    datos: DatosRecorrerFechaOperativa,
  ): Promise<void> {
    try {
      // Una transaccion para todo el dia: o se mueven todas o ninguna.
      await this.prisma.$transaction(async (tx) => {
        for (const evento of datos.eventos) {
          await tx.eventoCarga.update({
            where: { id: evento.eventoId },
            data: { fechaOperativa: datos.fechaNueva },
          });
          await tx.cambioFechaOperativa.create({
            data: {
              eventoCargaId: evento.eventoId,
              fechaAnterior: evento.fechaAnterior,
              fechaNueva: datos.fechaNueva,
              cambiadaPorId: datos.cambiadaPorId,
              motivo: datos.motivo,
            },
          });
        }
        // Sesiones e items no se tocan: cuelgan de la sesion, no de la fecha.
      });
    } catch (error) {
      // Mismo indice parcial que en `crearEventoConSesion`: una INICIAL por ruta y fecha.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new CargaInicialDuplicadaError();
      }
      throw error;
    }
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
            paquetes: i.paquetes,
            sueltas: i.sueltas,
            cantidad: i.cantidad,
            capturadoEn: i.capturadoEn,
            recibidoEn: i.recibidoEn,
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

  async listarCapturasDeSesion(sesionId: string): Promise<CapturaGuardada[]> {
    return this.prisma.conteoItem.findMany({
      where: { sesionId },
      select: {
        productoCode: true,
        paquetes: true,
        sueltas: true,
        cantidad: true,
        capturadoEn: true,
        recibidoEn: true,
      },
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

  async confirmarDiscrepancia(
    eventoId: string,
    productoCode: string,
    datos: DatosConfirmarDiscrepancia,
    decidirEstado: DecidirEstadoTrasConfirmar,
  ): Promise<{ discrepancia: Discrepancia; evento: EventoCarga }> {
    return this.prisma.$transaction(async (tx) => {
      // Bloquea el evento hasta el final de la transaccion: dos confirmaciones
      // simultaneas de las dos ultimas discrepancias se forman en fila, y la
      // segunda ve ya confirmada la primera. Sin esto, cada una veria la otra
      // pendiente y ninguna avanzaria el evento.
      const [bloqueado] = await tx.$queryRaw<{ estado: EstadoCarga }[]>`
        SELECT "estado" FROM "eventos_carga" WHERE "id" = ${eventoId} FOR UPDATE`;
      if (bloqueado === undefined) {
        throw new Error(`evento ${eventoId} inexistente`);
      }
      const row = await tx.discrepanciaResuelta.update({
        where: {
          eventoCargaId_productoCode: { eventoCargaId: eventoId, productoCode },
        },
        data: {
          confirmadaPor: datos.confirmadaPor,
          fechaConfirmacion: datos.fechaConfirmacion,
        },
      });
      const todas = await tx.discrepanciaResuelta.findMany({
        where: { eventoCargaId: eventoId },
        orderBy: { productoCode: 'asc' },
      });
      const nuevoEstado = decidirEstado(
        bloqueado.estado,
        todas.map((r) => this.aDiscrepancia(r)),
      );
      const evento =
        nuevoEstado === null
          ? await tx.eventoCarga.findUniqueOrThrow({ where: { id: eventoId } })
          : await tx.eventoCarga.update({
              where: { id: eventoId },
              data: { estado: nuevoEstado },
            });
      return {
        discrepancia: this.aDiscrepancia(row),
        evento: this.aEventoCarga(evento),
      };
    });
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
      fechaOperativa: row.fechaOperativa,
      autorizadaPorId: row.autorizadaPorId,
      fechaAutorizacion: row.fechaAutorizacion,
      fechaBloqueoCortePendiente: row.fechaBloqueoCortePendiente,
      fechaDesbloqueo: row.fechaDesbloqueo,
      idHandy: row.idHandy,
      canceladaPorId: row.canceladaPorId,
      fechaCancelacion: row.fechaCancelacion,
      motivoCancelacion: row.motivoCancelacion,
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

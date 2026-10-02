import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  AdminUsuarioRepository,
  CuentaHandyYaAsignadaError,
  SinSupervisorActivoError,
  type DatosActualizarUsuario,
  type DatosCrearUsuario,
  type MovimientoAcceso,
  type OcupanteCuentaHandy,
  type PaginaAccesos,
  type RegistroDesbloqueo,
  type RegistroRestablecimientoPin,
  type UsuarioAdmin,
} from '../application/admin-usuario.repository';
import { intercalarAccesos } from '../application/intercalar-accesos';

/**
 * Indice unico parcial creado a mano en la migracion
 * `20261001120000_cuenta_handy_unica_activa` (Prisma no los modela).
 */
const INDICE_CUENTA_HANDY_ACTIVA = 'usuarios_app_usuarioHandyId_activo_key';

/**
 * Llave del candado de Postgres que serializa los cambios de `activo` y
 * `rolApp`. Un numero fijo y propio de este uso: solo tiene que no chocar con
 * otro `pg_advisory_*` (sincronizacion usa 4_726_301).
 */
const LLAVE_CANDADO_SUPERVISORES = 4_726_302;

/**
 * `true` si el error de Prisma es la violacion de ese indice. Prisma reporta
 * en `meta.target` el nombre del indice o las columnas, segun la version.
 */
function violaCuentaHandyUnica(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  const target = error.meta?.target;
  const texto = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return (
    texto.includes(INDICE_CUENTA_HANDY_ACTIVA) ||
    texto.includes('usuarioHandyId')
  );
}

/**
 * Adaptador de infraestructura del repositorio de administracion de usuarios.
 * Aqui SI se conoce Prisma y el esquema; la capa de aplicacion solo ve el
 * puerto `AdminUsuarioRepository`.
 */
@Injectable()
export class PrismaAdminUsuarioRepository extends AdminUsuarioRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Select EXPLICITO compartido por todas las lecturas: `pinHash` (y cualquier
   * otro campo sensible) NUNCA sale de este adaptador.
   */
  private static readonly SELECT = {
    id: true,
    nombreCompleto: true,
    rolApp: true,
    usuarioHandyId: true,
    activo: true,
    debeCambiarPin: true,
    fechaUltimoCambioPin: true,
    bloqueadoHasta: true,
    creadoEn: true,
    actualizadoEn: true,
  } satisfies Prisma.UsuarioAppSelect;

  async listarTodos(): Promise<UsuarioAdmin[]> {
    const registros = await this.prisma.usuarioApp.findMany({
      // Sin filtro por `activo`: el panel de administracion tambien lista a los
      // usuarios dados de baja (RF-11), para no perder su trazabilidad.
      select: PrismaAdminUsuarioRepository.SELECT,
      orderBy: [{ activo: 'desc' }, { nombreCompleto: 'asc' }],
    });
    return registros.map((r) => this.aDominio(r));
  }

  async crear(datos: DatosCrearUsuario): Promise<UsuarioAdmin> {
    const registro = await this.traducirCuentaOcupada(
      datos.usuarioHandyId,
      () =>
        this.prisma.usuarioApp.create({
          data: {
            nombreCompleto: datos.nombreCompleto,
            rolApp: datos.rolApp,
            usuarioHandyId: datos.usuarioHandyId,
            pinHash: datos.pinHash,
            // Alta (RF-07 / RF-08): PIN temporal, se exige cambiarlo en el primer
            // login y el usuario nace activo.
            debeCambiarPin: true,
            activo: true,
          },
          select: PrismaAdminUsuarioRepository.SELECT,
        }),
    );
    return this.aDominio(registro);
  }

  /**
   * Si el cambio toca `activo` o `rolApp`, va en una transaccion que primero
   * toma `pg_advisory_xact_lock`, aplica el cambio y cuenta los supervisores
   * activos que QUEDAN: si son cero, lanza y la transaccion se revierte. El
   * candado hace que dos cambios simultaneos se vean: sin el, dos
   * supervisores desactivandose el uno al otro contarian cada uno al otro
   * todavia activo y los dos pasarian.
   */
  async actualizar(
    id: string,
    datos: DatosActualizarUsuario,
  ): Promise<UsuarioAdmin> {
    const data = {
      // `undefined` = Prisma no toca el campo; asi un PATCH parcial solo
      // modifica lo que realmente vino en el body.
      nombreCompleto: datos.nombreCompleto,
      rolApp: datos.rolApp,
      usuarioHandyId: datos.usuarioHandyId,
      activo: datos.activo,
      debeCambiarPin: datos.debeCambiarPin,
      pinHash: datos.pinHash,
      intentosFallidos: datos.intentosFallidos,
      bloqueadoHasta: datos.bloqueadoHasta,
    } satisfies Prisma.UsuarioAppUncheckedUpdateInput;
    const tocaSupervisores =
      datos.activo !== undefined || datos.rolApp !== undefined;

    const registro = await this.traducirCuentaOcupada(
      datos.usuarioHandyId ?? null,
      () =>
        tocaSupervisores
          ? this.prisma.$transaction(async (tx) => {
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LLAVE_CANDADO_SUPERVISORES})`;
              const actualizado = await tx.usuarioApp.update({
                where: { id },
                data,
                select: PrismaAdminUsuarioRepository.SELECT,
              });
              const quedan = await tx.usuarioApp.count({
                where: { rolApp: 'SUPERVISOR', activo: true },
              });
              if (quedan === 0) throw new SinSupervisorActivoError();
              return actualizado;
            })
          : this.prisma.usuarioApp.update({
              where: { id },
              data,
              select: PrismaAdminUsuarioRepository.SELECT,
            }),
    );
    return this.aDominio(registro);
  }

  async buscarPorId(id: string): Promise<UsuarioAdmin | null> {
    const registro = await this.prisma.usuarioApp.findUnique({
      where: { id },
      select: PrismaAdminUsuarioRepository.SELECT,
    });
    return registro === null ? null : this.aDominio(registro);
  }

  async restablecerPin(
    registro: RegistroRestablecimientoPin,
    pinHash: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Se fuerza el cambio en el siguiente login (RF-08) y se levanta el
      // bloqueo por intentos (RF-03).
      await tx.usuarioApp.update({
        where: { id: registro.usuarioAppId },
        data: {
          pinHash,
          debeCambiarPin: true,
          intentosFallidos: 0,
          bloqueadoHasta: null,
        },
      });
      await tx.historialRestablecimientoPin.create({
        data:
          registro.origen === 'SUPERVISOR'
            ? {
                usuarioAppId: registro.usuarioAppId,
                origen: 'SUPERVISOR',
                restablecidoPor: registro.restablecidoPor,
              }
            : {
                usuarioAppId: registro.usuarioAppId,
                origen: 'LINEA_COMANDOS',
                motivo: registro.motivo,
              },
      });
    });
  }

  async desbloquear(registro: RegistroDesbloqueo): Promise<UsuarioAdmin> {
    const actualizado = await this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuarioApp.update({
        where: { id: registro.usuarioAppId },
        data: { intentosFallidos: 0, bloqueadoHasta: null },
        select: PrismaAdminUsuarioRepository.SELECT,
      });
      await tx.historialDesbloqueo.create({
        data: {
          usuarioAppId: registro.usuarioAppId,
          desbloqueadoPor: registro.desbloqueadoPor,
          bloqueadoHasta: registro.bloqueadoHasta,
        },
      });
      return usuario;
    });
    return this.aDominio(actualizado);
  }

  /**
   * Sin SQL a mano: de cada tabla se traen los `page * pageSize` mas
   * recientes y `intercalarAccesos` los mezcla y recorta (ver ahi por que
   * alcanza). Mismo orden en las dos consultas que en la mezcla: fecha y
   * luego id, descendentes. Todo en una transaccion para que los totales
   * cuadren con los renglones.
   */
  async listarAccesos(
    usuarioAppId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginaAccesos> {
    const orden = [{ fecha: 'desc' }, { id: 'desc' }] as const;
    const autor = { select: { id: true, nombreCompleto: true } } as const;
    const [restablecimientos, desbloqueos, totalR, totalD] =
      await this.prisma.$transaction([
        this.prisma.historialRestablecimientoPin.findMany({
          where: { usuarioAppId },
          orderBy: [...orden],
          take: page * pageSize,
          select: {
            id: true,
            origen: true,
            motivo: true,
            fecha: true,
            admin: autor,
          },
        }),
        this.prisma.historialDesbloqueo.findMany({
          where: { usuarioAppId },
          orderBy: [...orden],
          take: page * pageSize,
          select: { id: true, bloqueadoHasta: true, fecha: true, admin: autor },
        }),
        this.prisma.historialRestablecimientoPin.count({
          where: { usuarioAppId },
        }),
        this.prisma.historialDesbloqueo.count({ where: { usuarioAppId } }),
      ]);

    const items = intercalarAccesos(
      restablecimientos.map((r): MovimientoAcceso => {
        // Los CHECK de `restablecimiento_origen_motivo` garantizan que un
        // renglon de SUPERVISOR trae quien y uno de LINEA_COMANDOS trae por que.
        if (r.origen === 'LINEA_COMANDOS' || r.admin === null) {
          return {
            id: r.id,
            tipo: 'PIN_RESTABLECIDO',
            fecha: r.fecha,
            origen: 'LINEA_COMANDOS',
            motivo: r.motivo ?? '',
          };
        }
        return {
          id: r.id,
          tipo: 'PIN_RESTABLECIDO',
          fecha: r.fecha,
          origen: 'SUPERVISOR',
          autor: r.admin,
        };
      }),
      desbloqueos.map((d): MovimientoAcceso => ({
        id: d.id,
        tipo: 'BLOQUEO_QUITADO',
        fecha: d.fecha,
        autor: d.admin,
        bloqueadoHasta: d.bloqueadoHasta,
      })),
      page,
      pageSize,
    );

    return { items, total: totalR + totalD, page, pageSize };
  }

  async contarSupervisoresActivos(): Promise<number> {
    return this.prisma.usuarioApp.count({
      where: { rolApp: 'SUPERVISOR', activo: true },
    });
  }

  async buscarActivoConCuentaHandy(
    usuarioHandyId: number,
    excluirId?: string,
  ): Promise<OcupanteCuentaHandy | null> {
    return this.prisma.usuarioApp.findFirst({
      where: {
        usuarioHandyId,
        activo: true,
        ...(excluirId !== undefined && { id: { not: excluirId } }),
      },
      select: { id: true, nombreCompleto: true },
    });
  }

  async nombreCuentaHandy(usuarioHandyId: number): Promise<string | null> {
    const cuenta = await this.prisma.usuarioHandy.findUnique({
      where: { idHandy: usuarioHandyId },
      select: { nombre: true },
    });
    return cuenta?.nombre ?? null;
  }

  /** La violacion del indice parcial sale como error del puerto, no de Prisma. */
  private async traducirCuentaOcupada<T>(
    usuarioHandyId: number | null,
    escribir: () => Promise<T>,
  ): Promise<T> {
    try {
      return await escribir();
    } catch (error) {
      if (violaCuentaHandyUnica(error)) {
        throw new CuentaHandyYaAsignadaError(usuarioHandyId);
      }
      throw error;
    }
  }

  private aDominio(registro: {
    id: string;
    nombreCompleto: string;
    rolApp: UsuarioAdmin['rolApp'];
    usuarioHandyId: number | null;
    activo: boolean;
    debeCambiarPin: boolean;
    fechaUltimoCambioPin: Date | null;
    bloqueadoHasta: Date | null;
    creadoEn: Date;
    actualizadoEn: Date;
  }): UsuarioAdmin {
    return { ...registro };
  }
}

/**
 * Puerto de persistencia del modulo de cargas: eventos de carga, sesiones de
 * conteo, items capturados y discrepancias (docs/04 seccion 1.4; RF-12 a RF-16).
 *
 * Capa de aplicacion: describe QUE se necesita de la persistencia, no COMO. No
 * importa Prisma, HTTP ni NestJS. El adaptador Prisma vive en `infrastructure/`.
 *
 * Los enums de `@prisma/client` se importan SOLO como tipo; en runtime se
 * trabaja con las cadenas literales (mismo criterio que `domain/estados-carga`).
 */

import type {
  EstadoCarga,
  EstadoSesion,
  TipoCarga,
  TipoOperacion,
  TipoSesion,
  UbicacionConteo,
} from '@prisma/client';

// ---------------------------------------------------------------------------
// Tipos de lectura (lo que el puerto devuelve)
// ---------------------------------------------------------------------------

/** Vista de un `EventoCarga` para la capa de aplicacion. */
export interface EventoCarga {
  id: string;
  /** Snapshot de la ruta al momento de crear el evento. */
  rutaId: string;
  /** Snapshot de la plantilla vigente; `null` si la ruta no tiene plantilla. */
  plantillaId: string | null;
  tipo: TipoCarga;
  tipoOperacion: TipoOperacion;
  usuarioHandyId: number;
  estado: EstadoCarga;
  fechaConteo: Date | null;
  creadoEn: Date;
}

/** Vista de una `SesionConteo` para la capa de aplicacion. */
export interface SesionConteo {
  id: string;
  eventoCargaId: string;
  tipo: TipoSesion;
  usuarioAppId: string;
  dispositivoId: string | null;
  ubicacion: UbicacionConteo | null;
  estado: EstadoSesion;
  iniciadaEn: Date;
  finalizadaEn: Date | null;
}

/**
 * Cantidad capturada de un producto dentro de una sesion. Estructuralmente
 * identico a `ItemConteo` del dominio, para poder pasarlo directo a
 * `compararConteos` sin transformar.
 */
export interface ItemCapturado {
  productoCode: string;
  cantidad: number;
}

/** Vista de una fila de `DiscrepanciaResuelta`. */
export interface Discrepancia {
  productoCode: string;
  /** Cantidad del primer conteo independiente (vendedor en autoventa). */
  cantidadVendedorOriginal: number;
  /** Cantidad del segundo conteo independiente (contador en autoventa). */
  cantidadContadorOriginal: number;
  cantidadFinal: number | null;
  capturadaPor: string | null;
  fechaCaptura: Date | null;
  confirmadaPor: string | null;
  fechaConfirmacion: Date | null;
}

// ---------------------------------------------------------------------------
// Tipos de escritura (lo que el puerto recibe)
// ---------------------------------------------------------------------------

/**
 * Datos para crear un `EventoCarga`. El evento nace SIEMPRE en `BORRADOR`
 * (default del esquema); el estado no se recibe aca. `rutaId` y `plantillaId`
 * son snapshots: se copian de la asignacion vigente y no cambian aunque el
 * vendedor se reasigne despues.
 */
export interface DatosCrearEvento {
  rutaId: string;
  plantillaId: string | null;
  tipo: TipoCarga;
  usuarioHandyId: number;
  tipoOperacion: TipoOperacion;
  /** Momento de negocio en que arranca el conteo. */
  fechaConteo: Date;
}

/** Item nuevo o actualizado dentro de una sesion. */
export interface ItemAGuardar {
  productoCode: string;
  cantidad: number;
}

/**
 * Discrepancia detectada por `compararConteos`, lista para persistir. Solo trae
 * las cantidades originales de cada conteo; la captura y confirmacion se agregan
 * despues con `actualizarDiscrepancia`.
 */
export interface DiscrepanciaAGuardar {
  productoCode: string;
  cantidadVendedorOriginal: number;
  cantidadContadorOriginal: number;
}

/**
 * Cambios sobre una discrepancia ya guardada: la captura de la cantidad final
 * (paso 1) y su confirmacion cruzada (paso 2). Todos los campos son opcionales
 * para poder aplicar un paso a la vez.
 */
export interface DatosActualizarDiscrepancia {
  cantidadFinal?: number;
  capturadaPor?: string;
  fechaCaptura?: Date;
  confirmadaPor?: string;
  fechaConfirmacion?: Date;
}

// ---------------------------------------------------------------------------
// Puerto
// ---------------------------------------------------------------------------

export abstract class CargaRepository {
  /** Crea un `EventoCarga` en estado `BORRADOR` y lo devuelve. */
  abstract crearEvento(datos: DatosCrearEvento): Promise<EventoCarga>;

  abstract buscarEventoPorId(id: string): Promise<EventoCarga | null>;

  /**
   * Fija el estado del evento al valor recibido y devuelve el evento
   * actualizado. La validez de la transicion la decide el caso de uso con
   * `puedeTransicionar` del dominio ANTES de llamar aca.
   */
  abstract cambiarEstado(
    eventoId: string,
    nuevoEstado: EstadoCarga,
  ): Promise<EventoCarga>;

  /**
   * Registra el envio exitoso a Handy sobre el evento, en una sola operacion:
   * fija `idHandy`, sella `fechaEnvioReal = ahora` y deja el estado en `ENVIADA`.
   *
   * El caso de uso ya valido con `puedeTransicionar` que el evento podia pasar a
   * `ENVIADA` antes de llamar aca; agrupar los tres campos evita una ventana en
   * la que el evento tenga `idHandy` pero siga en `LISTA_PARA_ENVIAR`.
   */
  abstract marcarComoEnviada(
    eventoId: string,
    idHandy: string,
    ahora: Date,
  ): Promise<EventoCarga>;

  /**
   * Crea una `SesionConteo` en estado `ABIERTA` para ese evento y usuario, y la
   * devuelve. `ubicacion` solo aplica al segundo conteo de una recarga (RF-18).
   */
  abstract crearSesion(
    eventoId: string,
    tipo: TipoSesion,
    usuarioAppId: string,
    dispositivoId?: string,
    ubicacion?: UbicacionConteo,
  ): Promise<SesionConteo>;

  abstract buscarSesionPorId(sesionId: string): Promise<SesionConteo | null>;

  /**
   * Reemplaza por completo las cantidades capturadas de la sesion por las
   * recibidas: un producto que ya no venga en `items` queda eliminado de la
   * sesion. Idempotente respecto al ultimo estado enviado.
   */
  abstract guardarItems(sesionId: string, items: ItemAGuardar[]): Promise<void>;

  /**
   * Cierra la sesion (`estado = CERRADA`) y sella `finalizadaEn` con `ahora`.
   * Recibe el instante en lugar de usar `new Date()` para que el caso de uso y
   * sus pruebas sean deterministas (mismo criterio que el resto del dominio).
   */
  abstract finalizarSesion(sesionId: string, ahora: Date): Promise<SesionConteo>;

  abstract listarItemsDeSesion(sesionId: string): Promise<ItemCapturado[]>;

  abstract listarSesionesDeEvento(eventoId: string): Promise<SesionConteo[]>;

  /**
   * Inserta las discrepancias del evento (upsert por `(eventoId, productoCode)`).
   * Preserva la captura/confirmacion previa de un producto si ya existia.
   */
  abstract guardarDiscrepancias(
    eventoId: string,
    discrepancias: DiscrepanciaAGuardar[],
  ): Promise<void>;

  abstract listarDiscrepancias(eventoId: string): Promise<Discrepancia[]>;

  /**
   * Aplica una captura o una confirmacion sobre una discrepancia concreta del
   * evento y devuelve su estado actualizado.
   */
  abstract actualizarDiscrepancia(
    eventoId: string,
    productoCode: string,
    datos: DatosActualizarDiscrepancia,
  ): Promise<Discrepancia>;
}

/**
 * Puerto de las familias del catalogo y su color. La familia no es una
 * entidad propia: es el texto `Producto.familia` que llega de Handy. El color
 * vive aparte, por nombre de familia.
 *
 * Capa de aplicacion: no importa Prisma, HTTP ni NestJS. El adaptador Prisma
 * vive en `infrastructure/`.
 */

import type { ColorFamilia } from '../domain/colores-familia';

/** Una familia con productos activos y cuantos tiene. */
export interface FamiliaDelCatalogo {
  familia: string;
  productos: number;
}

export abstract class FamiliaRepository {
  /**
   * Familias distintas de los productos ACTIVOS, con su conteo. Los productos
   * sin familia no aparecen. Sin orden garantizado.
   */
  abstract listarFamilias(): Promise<FamiliaDelCatalogo[]>;

  /** Color asignado a cada familia que tiene uno. */
  abstract listarColores(): Promise<Map<string, ColorFamilia>>;

  /** Si algun producto ACTIVO del catalogo tiene esa familia. */
  abstract existeFamilia(familia: string): Promise<boolean>;

  /** Asigna (o reemplaza) el color de la familia. */
  abstract asignarColor(
    familia: string,
    color: ColorFamilia,
    asignadoPorId: string,
  ): Promise<void>;

  /** Borra el color de la familia; no falla si no tenia. */
  abstract quitarColor(familia: string): Promise<void>;
}

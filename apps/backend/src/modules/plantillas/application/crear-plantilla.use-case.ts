import { claveNombre } from '../domain/politica-plantillas';
import type { Plantilla, PlantillaRepository } from './plantilla.repository';

export interface DatosNuevaPlantilla {
  nombre: string;
  descripcion?: string | null;
}

export type ResultadoCrearPlantilla =
  | { exito: true; plantilla: Plantilla }
  | { exito: false; motivo: 'NOMBRE_DUPLICADO' };

/**
 * Caso de uso: alta de una plantilla vacia (nace activa y sin productos).
 *
 * El nombre es lo unico que distingue una plantilla de otra en la app: dos
 * con el mismo nombre (aunque difieran en mayusculas o acentos) harian que el
 * supervisor asigne la equivocada a una ruta. Se compara contra TODAS,
 * incluidas las inactivas, que se pueden volver a activar.
 *
 * Capa de aplicacion: solo depende del dominio y del puerto.
 */
export class CrearPlantillaUseCase {
  constructor(private readonly plantillas: PlantillaRepository) {}

  async ejecutar(datos: DatosNuevaPlantilla): Promise<ResultadoCrearPlantilla> {
    const clave = claveNombre(datos.nombre);
    const existentes = await this.plantillas.listarNombres();
    if (existentes.some((p) => claveNombre(p.nombre) === clave)) {
      return { exito: false, motivo: 'NOMBRE_DUPLICADO' };
    }

    const plantilla = await this.plantillas.crear({
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
    });
    return { exito: true, plantilla };
  }
}

import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { AgregarProductosAPlantillaUseCase } from './application/agregar-productos-a-plantilla.use-case';
import { AsignarPlantillaARutaUseCase } from './application/asignar-plantilla-a-ruta.use-case';
import { CrearPlantillaUseCase } from './application/crear-plantilla.use-case';
import { EditarPlantillaUseCase } from './application/editar-plantilla.use-case';
import { ListarPlantillasUseCase } from './application/listar-plantillas.use-case';
import { PlantillaRepository } from './application/plantilla.repository';
import { QuitarProductosDePlantillaUseCase } from './application/quitar-productos-de-plantilla.use-case';
import { VerPlantillaUseCase } from './application/ver-plantilla.use-case';
import { PrismaPlantillaRepository } from './infrastructure/prisma-plantilla.repository';
import { PlantillasController } from './interface/plantillas.controller';

/** Los casos de uso dependen solo del puerto: todos se construyen igual. */
const CASOS_DE_USO = [
  ListarPlantillasUseCase,
  VerPlantillaUseCase,
  CrearPlantillaUseCase,
  EditarPlantillaUseCase,
  AgregarProductosAPlantillaUseCase,
  QuitarProductosDePlantillaUseCase,
  AsignarPlantillaARutaUseCase,
];

@Module({
  // AuthSharedModule ya es @Global; se importa de forma explicita para dejar
  // clara la dependencia de `JwtAuthGuard` / `RolesGuard`.
  imports: [AuthSharedModule],
  controllers: [PlantillasController],
  providers: [
    { provide: PlantillaRepository, useClass: PrismaPlantillaRepository },
    // Los casos de uso son clases planas (sin @Injectable): se construyen a
    // mano inyectando el puerto ya resuelto.
    ...CASOS_DE_USO.map((CasoDeUso) => ({
      provide: CasoDeUso,
      useFactory: (plantillas: PlantillaRepository) =>
        new CasoDeUso(plantillas),
      inject: [PlantillaRepository],
    })),
  ],
})
export class PlantillasModule {}

import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { AsignarColorFamiliaUseCase } from './application/asignar-color-familia.use-case';
import { FamiliaRepository } from './application/familia.repository';
import { ListarFamiliasUseCase } from './application/listar-familias.use-case';
import { PrismaFamiliaRepository } from './infrastructure/prisma-familia.repository';
import { FamiliasController } from './interface/familias.controller';

/** Los casos de uso dependen solo del puerto: todos se construyen igual. */
const CASOS_DE_USO = [ListarFamiliasUseCase, AsignarColorFamiliaUseCase];

@Module({
  // AuthSharedModule ya es @Global; se importa de forma explicita para dejar
  // clara la dependencia de `JwtAuthGuard` / `RolesGuard`.
  imports: [AuthSharedModule],
  controllers: [FamiliasController],
  providers: [
    { provide: FamiliaRepository, useClass: PrismaFamiliaRepository },
    ...CASOS_DE_USO.map((CasoDeUso) => ({
      provide: CasoDeUso,
      useFactory: (familias: FamiliaRepository) => new CasoDeUso(familias),
      inject: [FamiliaRepository],
    })),
  ],
})
export class CatalogoModule {}

import { Module } from '@nestjs/common';

import { SaludController } from './interface/salud.controller';

/** Endpoint de salud para Render. `PrismaService` llega del `PrismaModule` global. */
@Module({
  controllers: [SaludController],
})
export class SaludModule {}

/*
  Warnings:

  - A unique constraint covering the columns `[eventoCargaId,usuarioAppId]` on the table `sesiones_conteo` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "sesiones_conteo_eventoCargaId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_conteo_eventoCargaId_usuarioAppId_key" ON "sesiones_conteo"("eventoCargaId", "usuarioAppId");

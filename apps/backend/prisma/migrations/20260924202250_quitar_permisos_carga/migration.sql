/*
  Warnings:

  - You are about to drop the column `liquidacionNoVerificada` on the `eventos_carga` table. All the data in the column will be lost.
  - You are about to drop the column `rutaHandySinLiquidarId` on the `eventos_carga` table. All the data in the column will be lost.
  - You are about to drop the `permisos_carga_sin_liquidar` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "permisos_carga_sin_liquidar" DROP CONSTRAINT "permisos_carga_sin_liquidar_eventoCargaId_fkey";

-- DropForeignKey
ALTER TABLE "permisos_carga_sin_liquidar" DROP CONSTRAINT "permisos_carga_sin_liquidar_otorgadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "permisos_carga_sin_liquidar" DROP CONSTRAINT "permisos_carga_sin_liquidar_rutaId_fkey";

-- AlterTable
ALTER TABLE "eventos_carga" DROP COLUMN "liquidacionNoVerificada",
DROP COLUMN "rutaHandySinLiquidarId";

-- DropTable
DROP TABLE "permisos_carga_sin_liquidar";

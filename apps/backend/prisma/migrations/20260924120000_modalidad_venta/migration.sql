-- CreateEnum
CREATE TYPE "ModalidadVenta" AS ENUM ('COMPLETO', 'POR_PIEZA');

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "modalidadVenta" "ModalidadVenta" NOT NULL DEFAULT 'POR_PIEZA';

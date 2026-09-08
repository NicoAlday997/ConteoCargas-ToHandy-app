-- CreateEnum
CREATE TYPE "TipoOperacion" AS ENUM ('AUTOVENTA', 'PREVENTA');

-- AlterTable
ALTER TABLE "asignaciones_ruta_vendedor" ADD COLUMN     "plantillaId" TEXT;

-- AlterTable
ALTER TABLE "eventos_carga" ADD COLUMN     "plantillaId" TEXT,
ADD COLUMN     "tipoOperacion" "TipoOperacion" NOT NULL DEFAULT 'AUTOVENTA';

-- CreateTable
CREATE TABLE "plantillas_carga" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantillas_carga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_producto" (
    "id" TEXT NOT NULL,
    "plantillaId" TEXT NOT NULL,
    "productoCode" TEXT NOT NULL,

    CONSTRAINT "plantillas_producto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plantillas_producto_productoCode_idx" ON "plantillas_producto"("productoCode");

-- CreateIndex
CREATE UNIQUE INDEX "plantillas_producto_plantillaId_productoCode_key" ON "plantillas_producto"("plantillaId", "productoCode");

-- CreateIndex
CREATE INDEX "asignaciones_ruta_vendedor_plantillaId_idx" ON "asignaciones_ruta_vendedor"("plantillaId");

-- CreateIndex
CREATE INDEX "eventos_carga_plantillaId_idx" ON "eventos_carga"("plantillaId");

-- AddForeignKey
ALTER TABLE "asignaciones_ruta_vendedor" ADD CONSTRAINT "asignaciones_ruta_vendedor_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_carga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_producto" ADD CONSTRAINT "plantillas_producto_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_carga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_producto" ADD CONSTRAINT "plantillas_producto_productoCode_fkey" FOREIGN KEY ("productoCode") REFERENCES "productos"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_carga" ADD CONSTRAINT "eventos_carga_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_carga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

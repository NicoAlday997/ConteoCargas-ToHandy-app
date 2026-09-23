-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "factorConfirmado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "factorConfirmadoPorId" TEXT,
ADD COLUMN     "fechaConfirmacionFactor" TIMESTAMP(3),
ADD COLUMN     "piezasPorPaquete" INTEGER;

-- CreateIndex
CREATE INDEX "productos_factorConfirmadoPorId_idx" ON "productos"("factorConfirmadoPorId");

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_factorConfirmadoPorId_fkey" FOREIGN KEY ("factorConfirmadoPorId") REFERENCES "usuarios_app"("id") ON DELETE SET NULL ON UPDATE CASCADE;

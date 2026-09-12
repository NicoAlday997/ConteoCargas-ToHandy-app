-- AlterEnum
ALTER TYPE "EstadoCarga" ADD VALUE 'EN_ESPERA_AUTORIZACION';

-- AlterTable
ALTER TABLE "eventos_carga" ADD COLUMN     "autorizadaPorId" TEXT,
ADD COLUMN     "fechaAutorizacion" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "eventos_carga_autorizadaPorId_idx" ON "eventos_carga"("autorizadaPorId");

-- AddForeignKey
ALTER TABLE "eventos_carga" ADD CONSTRAINT "eventos_carga_autorizadaPorId_fkey" FOREIGN KEY ("autorizadaPorId") REFERENCES "usuarios_app"("id") ON DELETE SET NULL ON UPDATE CASCADE;

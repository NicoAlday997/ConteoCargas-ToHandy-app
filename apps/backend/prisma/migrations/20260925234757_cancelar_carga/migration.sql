-- AlterEnum
ALTER TYPE "EstadoCarga" ADD VALUE 'CANCELADA';

-- AlterTable
ALTER TABLE "eventos_carga" ADD COLUMN     "canceladaPorId" TEXT,
ADD COLUMN     "fechaCancelacion" TIMESTAMP(3),
ADD COLUMN     "motivoCancelacion" TEXT;

-- CreateIndex
CREATE INDEX "eventos_carga_canceladaPorId_idx" ON "eventos_carga"("canceladaPorId");

-- AddForeignKey
ALTER TABLE "eventos_carga" ADD CONSTRAINT "eventos_carga_canceladaPorId_fkey" FOREIGN KEY ("canceladaPorId") REFERENCES "usuarios_app"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- El indice parcial "una INICIAL por ruta y fecha operativa" tiene que dejar de
-- contar las canceladas (si no, cancelar una carga inicial bloquea el dia para
-- siempre). NO va en este archivo: Postgres no permite usar un valor de enum en
-- la misma transaccion en que se agrega ("New enum values must be committed
-- before they can be used"). Se recrea en la migracion siguiente,
-- `20260925234758_indice_inicial_sin_canceladas`.

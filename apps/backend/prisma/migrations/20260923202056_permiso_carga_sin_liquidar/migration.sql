-- AlterTable
ALTER TABLE "eventos_carga" ADD COLUMN     "liquidacionNoVerificada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rutaHandySinLiquidarId" TEXT;

-- CreateTable
CREATE TABLE "permisos_carga_sin_liquidar" (
    "id" TEXT NOT NULL,
    "rutaId" TEXT NOT NULL,
    "otorgadoPorId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "fechaOtorgado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaExpiracion" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "eventoCargaId" TEXT,

    CONSTRAINT "permisos_carga_sin_liquidar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permisos_carga_sin_liquidar_eventoCargaId_key" ON "permisos_carga_sin_liquidar"("eventoCargaId");

-- CreateIndex
CREATE INDEX "permisos_carga_sin_liquidar_rutaId_idx" ON "permisos_carga_sin_liquidar"("rutaId");

-- CreateIndex
CREATE INDEX "permisos_carga_sin_liquidar_usado_idx" ON "permisos_carga_sin_liquidar"("usado");

-- CreateIndex
CREATE INDEX "permisos_carga_sin_liquidar_otorgadoPorId_idx" ON "permisos_carga_sin_liquidar"("otorgadoPorId");

-- AddForeignKey
ALTER TABLE "permisos_carga_sin_liquidar" ADD CONSTRAINT "permisos_carga_sin_liquidar_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "rutas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permisos_carga_sin_liquidar" ADD CONSTRAINT "permisos_carga_sin_liquidar_otorgadoPorId_fkey" FOREIGN KEY ("otorgadoPorId") REFERENCES "usuarios_app"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permisos_carga_sin_liquidar" ADD CONSTRAINT "permisos_carga_sin_liquidar_eventoCargaId_fkey" FOREIGN KEY ("eventoCargaId") REFERENCES "eventos_carga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

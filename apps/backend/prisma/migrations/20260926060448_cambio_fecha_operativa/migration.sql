-- CreateTable
CREATE TABLE "cambios_fecha_operativa" (
    "id" TEXT NOT NULL,
    "eventoCargaId" TEXT NOT NULL,
    "fechaAnterior" TIMESTAMP(3) NOT NULL,
    "fechaNueva" TIMESTAMP(3) NOT NULL,
    "cambiadaPorId" TEXT NOT NULL,
    "motivo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cambios_fecha_operativa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cambios_fecha_operativa_eventoCargaId_idx" ON "cambios_fecha_operativa"("eventoCargaId");

-- AddForeignKey
ALTER TABLE "cambios_fecha_operativa" ADD CONSTRAINT "cambios_fecha_operativa_eventoCargaId_fkey" FOREIGN KEY ("eventoCargaId") REFERENCES "eventos_carga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_fecha_operativa" ADD CONSTRAINT "cambios_fecha_operativa_cambiadaPorId_fkey" FOREIGN KEY ("cambiadaPorId") REFERENCES "usuarios_app"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

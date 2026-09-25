-- CreateTable
CREATE TABLE "cambios_factor_empaque" (
    "id" TEXT NOT NULL,
    "productoCode" TEXT NOT NULL,
    "modalidadAnterior" "ModalidadVenta" NOT NULL,
    "piezasAnterior" INTEGER,
    "estabaConfirmado" BOOLEAN NOT NULL,
    "modalidadNueva" "ModalidadVenta" NOT NULL,
    "piezasNueva" INTEGER,
    "cambiadoPorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "cargasEnCurso" INTEGER NOT NULL,

    CONSTRAINT "cambios_factor_empaque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cambios_factor_empaque_productoCode_fecha_idx" ON "cambios_factor_empaque"("productoCode", "fecha");

-- CreateIndex
CREATE INDEX "cambios_factor_empaque_cambiadoPorId_idx" ON "cambios_factor_empaque"("cambiadoPorId");

-- AddForeignKey
ALTER TABLE "cambios_factor_empaque" ADD CONSTRAINT "cambios_factor_empaque_productoCode_fkey" FOREIGN KEY ("productoCode") REFERENCES "productos"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambios_factor_empaque" ADD CONSTRAINT "cambios_factor_empaque_cambiadoPorId_fkey" FOREIGN KEY ("cambiadoPorId") REFERENCES "usuarios_app"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

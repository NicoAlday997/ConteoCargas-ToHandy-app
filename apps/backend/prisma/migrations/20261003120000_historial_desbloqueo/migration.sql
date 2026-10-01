-- CreateTable
CREATE TABLE "historiales_desbloqueo" (
    "id" TEXT NOT NULL,
    "usuarioAppId" TEXT NOT NULL,
    "desbloqueadoPor" TEXT NOT NULL,
    "bloqueadoHasta" TIMESTAMP(3) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historiales_desbloqueo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historiales_desbloqueo_usuarioAppId_idx" ON "historiales_desbloqueo"("usuarioAppId");

-- AddForeignKey
ALTER TABLE "historiales_desbloqueo" ADD CONSTRAINT "historiales_desbloqueo_usuarioAppId_fkey" FOREIGN KEY ("usuarioAppId") REFERENCES "usuarios_app"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historiales_desbloqueo" ADD CONSTRAINT "historiales_desbloqueo_desbloqueadoPor_fkey" FOREIGN KEY ("desbloqueadoPor") REFERENCES "usuarios_app"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

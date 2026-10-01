-- CreateEnum
CREATE TYPE "OrigenSincronizacion" AS ENUM ('MANUAL', 'AUTOMATICA');

-- CreateTable
CREATE TABLE "registros_sincronizacion" (
    "id" TEXT NOT NULL,
    "origen" "OrigenSincronizacion" NOT NULL,
    "usuarioAppId" TEXT,
    "iniciadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadaEn" TIMESTAMP(3),
    "exito" BOOLEAN,

    CONSTRAINT "registros_sincronizacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registros_sincronizacion_iniciadaEn_idx" ON "registros_sincronizacion"("iniciadaEn");

-- AddForeignKey
ALTER TABLE "registros_sincronizacion" ADD CONSTRAINT "registros_sincronizacion_usuarioAppId_fkey" FOREIGN KEY ("usuarioAppId") REFERENCES "usuarios_app"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "colores_familia" (
    "familia" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "asignadoPorId" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colores_familia_pkey" PRIMARY KEY ("familia")
);

-- AddForeignKey
ALTER TABLE "colores_familia" ADD CONSTRAINT "colores_familia_asignadoPorId_fkey" FOREIGN KEY ("asignadoPorId") REFERENCES "usuarios_app"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "dias_no_laborables" (
    "fecha" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dias_no_laborables_pkey" PRIMARY KEY ("fecha")
);

-- AddForeignKey
ALTER TABLE "dias_no_laborables" ADD CONSTRAINT "dias_no_laborables_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios_app"("id") ON DELETE SET NULL ON UPDATE CASCADE;

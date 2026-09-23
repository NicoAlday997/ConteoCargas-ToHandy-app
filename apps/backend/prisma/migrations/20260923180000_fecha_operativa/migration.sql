-- Fecha operativa: el dia para el que sale el camion, distinto de fechaConteo.

-- AlterTable
-- Se agrega nullable para poder rellenar las filas existentes antes del NOT NULL.
ALTER TABLE "eventos_carga" ADD COLUMN     "fechaOperativa" TIMESTAMP(3);

-- Relleno de cargas existentes: el inicio del dia (America/Mexico_City) en que
-- se contaron, guardado en UTC como el resto de columnas DateTime de Prisma.
-- Es la mejor aproximacion disponible: antes no se registraba para que dia salia.
UPDATE "eventos_carga"
SET "fechaOperativa" =
  (date_trunc('day', (COALESCE("fechaConteo", "creadoEn") AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')
    AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'UTC';

ALTER TABLE "eventos_carga" ALTER COLUMN "fechaOperativa" SET NOT NULL;

-- CreateIndex
CREATE INDEX "eventos_carga_rutaId_fechaOperativa_idx" ON "eventos_carga"("rutaId", "fechaOperativa");

-- Una sola carga INICIAL por ruta y fecha operativa (las RECARGAS pueden ser
-- varias). Prisma 6 no soporta indices parciales en schema.prisma: se crea a
-- mano aqui y NO aparece en el esquema. Si una migracion futura generada por
-- `prisma migrate dev` incluye `DROP INDEX "eventos_carga_inicial_ruta_fecha_key"`,
-- hay que quitar esa linea antes de aplicarla.
-- Falla si ya hay duplicados (p. ej. cargas de prueba creadas a discrecion):
-- hay que depurarlos antes de migrar.
CREATE UNIQUE INDEX "eventos_carga_inicial_ruta_fecha_key"
  ON "eventos_carga"("rutaId", "fechaOperativa")
  WHERE "tipo" = 'INICIAL';

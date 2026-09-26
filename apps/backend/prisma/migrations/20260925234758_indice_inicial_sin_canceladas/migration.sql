-- Una sola carga INICIAL por ruta y fecha operativa, sin contar las CANCELADAS:
-- cancelar una carga inicial abierta por error debe dejar el dia libre para
-- abrir la correcta. Reemplaza el indice manual de la migracion
-- `20260923180000_fecha_operativa` (Prisma no soporta indices parciales en
-- schema.prisma; ver el comentario que quedo ahi).
--
-- Va en su propia migracion y no al final de `cancelar_carga`: Postgres exige
-- que el valor 'CANCELADA' del enum este confirmado (commit) antes de usarlo, y
-- Prisma aplica cada migracion en una sola transaccion.
DROP INDEX IF EXISTS "eventos_carga_inicial_ruta_fecha_key";
CREATE UNIQUE INDEX "eventos_carga_inicial_ruta_fecha_key"
  ON "eventos_carga"("rutaId", "fechaOperativa")
  WHERE "tipo" = 'INICIAL' AND "estado" <> 'CANCELADA';

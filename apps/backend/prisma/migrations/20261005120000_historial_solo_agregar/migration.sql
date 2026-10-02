-- DropForeignKey
ALTER TABLE "registros_sincronizacion" DROP CONSTRAINT "registros_sincronizacion_usuarioAppId_fkey";

-- DropForeignKey
ALTER TABLE "revisiones_supervisor" DROP CONSTRAINT "revisiones_supervisor_comparacionCargaId_fkey";

-- DropIndex
DROP INDEX "revisiones_supervisor_comparacionCargaId_productoCode_key";

-- AlterTable
ALTER TABLE "revisiones_supervisor" ADD COLUMN     "reemplazaAId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "revisiones_supervisor_reemplazaAId_key" ON "revisiones_supervisor"("reemplazaAId");

-- CreateIndex
CREATE INDEX "revisiones_supervisor_comparacionCargaId_productoCode_idx" ON "revisiones_supervisor"("comparacionCargaId", "productoCode");

-- AddForeignKey
ALTER TABLE "revisiones_supervisor" ADD CONSTRAINT "revisiones_supervisor_comparacionCargaId_fkey" FOREIGN KEY ("comparacionCargaId") REFERENCES "comparaciones_carga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisiones_supervisor" ADD CONSTRAINT "revisiones_supervisor_reemplazaAId_fkey" FOREIGN KEY ("reemplazaAId") REFERENCES "revisiones_supervisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_sincronizacion" ADD CONSTRAINT "registros_sincronizacion_usuarioAppId_fkey" FOREIGN KEY ("usuarioAppId") REFERENCES "usuarios_app"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===========================================================================
-- SQL MANUAL: TABLAS DE SOLO AGREGAR
-- ===========================================================================
-- Estas tablas registran que algo PASO. Una vez escrito, el renglon es
-- historia: no se corrige ni se borra. Si algo estuvo mal, se agrega un
-- renglon nuevo que lo diga. La aplicacion ya trabaja asi; estos triggers
-- hacen que la base lo garantice aunque alguien entre con psql, se equivoque
-- un caso de uso futuro o un script haga UPDATE/DELETE de mas.
--
--   historiales_restablecimiento_pin  quien restablecio un PIN, o por que
--   historiales_desbloqueo            quien quito un bloqueo a quien
--   cambios_fecha_operativa           cada cambio de fecha de una carga
--   cambios_factor_empaque            cada confirmacion/correccion de empaque
--   revisiones_supervisor             cada juicio del stepper; una correccion
--                                     es una revision nueva (`reemplazaAId`)
--   registros_sincronizacion          parcial: ver su funcion mas abajo
--
-- Un trigger por renglon no ve un TRUNCATE, asi que cada tabla lleva ademas
-- uno BEFORE TRUNCATE.
--
-- Las llaves foraneas hacia estas tablas son RESTRICT (nada las borra en
-- cascada) y sus ON UPDATE CASCADE solo se disparan si cambia el id de un
-- padre, cosa que nunca pasa; si pasara, el trigger lo rechaza.
--
-- ADVERTENCIA: Prisma no soporta triggers en schema.prisma, asi que NO existen
-- para Prisma. Si una migracion generada en el futuro incluye
-- `DROP TRIGGER ...` o `DROP FUNCTION rechazar_cambio_historial` /
-- `DROP FUNCTION registro_sincronizacion_solo_cierre`, BORRA esas lineas antes
-- de aplicarla: no los dejes borrar. Un `prisma migrate reset` borra todo el
-- esquema y los vuelve a crear porque viven aqui; un esquema levantado solo
-- con `db push` NO los tendra.
--
-- Si una migracion legitima algun dia necesita tocar estas tablas, la salida
-- de emergencia (desactivar, cambiar, reactivar, y anotarlo fuera del
-- sistema) esta en docs/07-despliegue.md, seccion 13.
--
-- La prueba contra Postgres real es `npm run test:db`
-- (src/shared/prisma/historial-solo-agregar.db-spec.ts).

CREATE FUNCTION rechazar_cambio_historial() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo agregar: % no permitido', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation',
          HINT = 'Una correccion es un renglon nuevo. Salida de emergencia: docs/07-despliegue.md seccion 13.';
END;
$$;

-- Sin DELETE nunca. Como unico UPDATE, cerrar la corrida: llenar
-- `terminadaEn` y `exito` una sola vez, cuando los dos siguen en nulo, sin
-- tocar ninguna otra columna. Este renglon es del que lee el candado de
-- sincronizacion (docs/04 §1.3): si se pudiera reescribir, se podria manipular
-- el candado; y borrar una corrida fallida esconderia el fallo.
CREATE FUNCTION registro_sincronizacion_solo_cierre() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."terminadaEn" IS NULL AND OLD."exito" IS NULL
     AND NEW."terminadaEn" IS NOT NULL AND NEW."exito" IS NOT NULL
     AND (NEW."id", NEW."origen", NEW."usuarioAppId", NEW."iniciadaEn")
         IS NOT DISTINCT FROM
         (OLD."id", OLD."origen", OLD."usuarioAppId", OLD."iniciadaEn")
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'registros_sincronizacion: % no permitido; solo se cierra una vez (terminadaEn y exito, cuando estan en nulo)', TG_OP
    USING ERRCODE = 'restrict_violation',
          HINT = 'Salida de emergencia: docs/07-despliegue.md seccion 13.';
END;
$$;

CREATE TRIGGER historiales_restablecimiento_pin_solo_agregar
  BEFORE UPDATE OR DELETE ON "historiales_restablecimiento_pin"
  FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_historial();
CREATE TRIGGER historiales_restablecimiento_pin_sin_truncate
  BEFORE TRUNCATE ON "historiales_restablecimiento_pin"
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_historial();

CREATE TRIGGER historiales_desbloqueo_solo_agregar
  BEFORE UPDATE OR DELETE ON "historiales_desbloqueo"
  FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_historial();
CREATE TRIGGER historiales_desbloqueo_sin_truncate
  BEFORE TRUNCATE ON "historiales_desbloqueo"
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_historial();

CREATE TRIGGER cambios_fecha_operativa_solo_agregar
  BEFORE UPDATE OR DELETE ON "cambios_fecha_operativa"
  FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_historial();
CREATE TRIGGER cambios_fecha_operativa_sin_truncate
  BEFORE TRUNCATE ON "cambios_fecha_operativa"
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_historial();

CREATE TRIGGER cambios_factor_empaque_solo_agregar
  BEFORE UPDATE OR DELETE ON "cambios_factor_empaque"
  FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_historial();
CREATE TRIGGER cambios_factor_empaque_sin_truncate
  BEFORE TRUNCATE ON "cambios_factor_empaque"
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_historial();

CREATE TRIGGER revisiones_supervisor_solo_agregar
  BEFORE UPDATE OR DELETE ON "revisiones_supervisor"
  FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_historial();
CREATE TRIGGER revisiones_supervisor_sin_truncate
  BEFORE TRUNCATE ON "revisiones_supervisor"
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_historial();

CREATE TRIGGER registros_sincronizacion_solo_cierre
  BEFORE UPDATE OR DELETE ON "registros_sincronizacion"
  FOR EACH ROW EXECUTE FUNCTION registro_sincronizacion_solo_cierre();
CREATE TRIGGER registros_sincronizacion_sin_truncate
  BEFORE TRUNCATE ON "registros_sincronizacion"
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_historial();

-- Una sola revision ORIGINAL (sin `reemplazaAId`) por producto de cada
-- comparacion: es la garantia que antes daba el `@@unique` de
-- (comparacionCargaId, productoCode), que se quito para poder agregar
-- correcciones. Con el `@unique` de `reemplazaAId` (nadie se reemplaza dos
-- veces) queda una cadena lineal por producto.
--
-- ADVERTENCIA: Prisma no soporta indices parciales en schema.prisma. Si una
-- migracion generada en el futuro incluye
-- `DROP INDEX "revisiones_supervisor_original_unica"`, BORRA esa linea.
CREATE UNIQUE INDEX "revisiones_supervisor_original_unica"
  ON "revisiones_supervisor"("comparacionCargaId", "productoCode")
  WHERE "reemplazaAId" IS NULL;

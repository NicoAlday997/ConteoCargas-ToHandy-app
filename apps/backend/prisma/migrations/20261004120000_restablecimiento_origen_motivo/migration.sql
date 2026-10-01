-- CreateEnum
CREATE TYPE "OrigenRestablecimiento" AS ENUM ('SUPERVISOR', 'LINEA_COMANDOS');

-- AlterTable
ALTER TABLE "historiales_restablecimiento_pin" ADD COLUMN     "motivo" TEXT,
ADD COLUMN     "origen" "OrigenRestablecimiento" NOT NULL DEFAULT 'SUPERVISOR',
ALTER COLUMN "restablecidoPor" DROP NOT NULL;

-- O sabemos quien, o sabemos por que; nunca ninguno de los dos.
--   SUPERVISOR: `restablecidoPor` obligatorio (el id sale del JWT).
--   LINEA_COMANDOS: `npm run reestablecer-pin` no tiene sesion, asi que
--   `restablecidoPor` va vacio (nadie puede atribuirselo a un supervisor) y
--   `motivo` es obligatorio, con al menos 10 caracteres sin contar espacios
--   de las orillas, igual que los demas motivos del sistema. Es la unica
--   traza que queda de esa intervencion.
-- El caso de uso `RestablecerPinUseCase` valida antes; estos CHECK son la
-- garantia real.
--
-- ADVERTENCIA: Prisma no soporta CHECK en schema.prisma, asi que estas
-- restricciones NO existen para Prisma. Si una migracion generada en el
-- futuro incluye `DROP CONSTRAINT "historiales_restablecimiento_pin_supervisor_con_autor"`
-- o `DROP CONSTRAINT "historiales_restablecimiento_pin_linea_comandos_con_motivo"`,
-- BORRA esa linea antes de aplicarla: no lo dejes borrar, no esta en el esquema.
ALTER TABLE "historiales_restablecimiento_pin"
  ADD CONSTRAINT "historiales_restablecimiento_pin_supervisor_con_autor"
  CHECK ("origen" <> 'SUPERVISOR' OR "restablecidoPor" IS NOT NULL);

ALTER TABLE "historiales_restablecimiento_pin"
  ADD CONSTRAINT "historiales_restablecimiento_pin_linea_comandos_con_motivo"
  CHECK (
    "origen" <> 'LINEA_COMANDOS'
    OR (
      "restablecidoPor" IS NULL
      -- IS NOT NULL explicito: con motivo nulo, char_length(...) da NULL y un
      -- CHECK que da NULL se considera cumplido.
      AND "motivo" IS NOT NULL
      AND char_length(btrim("motivo")) >= 10
    )
  );

/*
  Warnings:

  - The `usuarioHandyId` column on the `usuarios_app` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `usuarios_handy` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `usuarioHandyId` on the `eventos_carga` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `idHandy` on the `usuarios_handy` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `rolHandyId` to the `usuarios_handy` table without a default value. This is not possible if the table is not empty.
  - Made the column `rolHandyAuthority` on table `usuarios_handy` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "eventos_carga" DROP CONSTRAINT "eventos_carga_usuarioHandyId_fkey";

-- DropForeignKey
ALTER TABLE "usuarios_app" DROP CONSTRAINT "usuarios_app_usuarioHandyId_fkey";

-- AlterTable
ALTER TABLE "eventos_carga" DROP COLUMN "usuarioHandyId",
ADD COLUMN     "usuarioHandyId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "usuarios_app" DROP COLUMN "usuarioHandyId",
ADD COLUMN     "usuarioHandyId" INTEGER;

-- AlterTable
ALTER TABLE "usuarios_handy" DROP CONSTRAINT "usuarios_handy_pkey",
ADD COLUMN     "email" TEXT,
DROP COLUMN "idHandy",
ADD COLUMN     "idHandy" INTEGER NOT NULL,
DROP COLUMN "rolHandyId",
ADD COLUMN     "rolHandyId" INTEGER NOT NULL,
ALTER COLUMN "rolHandyAuthority" SET NOT NULL,
ADD CONSTRAINT "usuarios_handy_pkey" PRIMARY KEY ("idHandy");

-- CreateIndex
CREATE INDEX "eventos_carga_usuarioHandyId_idx" ON "eventos_carga"("usuarioHandyId");

-- CreateIndex
CREATE INDEX "usuarios_app_usuarioHandyId_idx" ON "usuarios_app"("usuarioHandyId");

-- AddForeignKey
ALTER TABLE "usuarios_app" ADD CONSTRAINT "usuarios_app_usuarioHandyId_fkey" FOREIGN KEY ("usuarioHandyId") REFERENCES "usuarios_handy"("idHandy") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_carga" ADD CONSTRAINT "eventos_carga_usuarioHandyId_fkey" FOREIGN KEY ("usuarioHandyId") REFERENCES "usuarios_handy"("idHandy") ON DELETE RESTRICT ON UPDATE CASCADE;

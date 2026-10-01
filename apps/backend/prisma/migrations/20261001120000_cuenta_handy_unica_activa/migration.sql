-- Una cuenta de Handy, un solo usuario ACTIVO. Cada cuenta de Handy es una
-- ruta: dos usuarios activos con la misma podrian abrir cargas de la misma
-- ruta. Los inactivos no cuentan: cuando un vendedor se va, su cuenta pasa a
-- quien llega y el viejo la conserva en su historial. Los casos de uso
-- (`CrearUsuarioUseCase`, `EditarUsuarioUseCase`) validan antes para dar un
-- mensaje que diga a quien; este indice es la garantia real.
--
-- ADVERTENCIA: Prisma no soporta indices parciales en schema.prisma, asi que
-- este indice NO existe para Prisma. Si una migracion generada en el futuro
-- incluye `DROP INDEX "usuarios_app_usuarioHandyId_activo_key"`, BORRA esa
-- linea antes de aplicarla: sin el indice, solo la pantalla impide que dos
-- usuarios activos compartan cuenta. El adaptador
-- `prisma-admin-usuario.repository.ts` reconoce este nombre.
--
-- Si falla al aplicarse con "could not create unique index", ya hay dos
-- usuarios activos con la misma cuenta: desactiva a uno y vuelve a correrla.
CREATE UNIQUE INDEX "usuarios_app_usuarioHandyId_activo_key"
  ON "usuarios_app"("usuarioHandyId")
  WHERE "activo" = true AND "usuarioHandyId" IS NOT NULL;

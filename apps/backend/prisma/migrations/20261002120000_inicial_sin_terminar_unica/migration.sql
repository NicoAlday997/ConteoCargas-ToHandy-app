-- Una ruta, una sola carga INICIAL sin terminar. El camion es uno: no puede
-- tener dos salidas colgadas. "Sin terminar" es cualquier estado que no sea
-- ENVIADA ni CANCELADA. Sin la fecha en el indice: antes, una inicial para
-- mañana en EN_ESPERA_CONTADOR dejaba abrir otra para hoy porque la fecha era
-- distinta. Las RECARGAS no entran: una ruta puede tener varias.
--
-- Convive con `eventos_carga_inicial_ruta_fecha_key` (ruta + fecha, sin las
-- CANCELADAS), que sigue impidiendo dos iniciales ENVIADAS el mismo dia. No
-- quites ninguno de los dos. `IniciarCargaUseCase` valida antes para decir
-- cual es la carga que estorba; este indice es la garantia real.
--
-- ADVERTENCIA: Prisma no soporta indices parciales en schema.prisma, asi que
-- este indice NO existe para Prisma. Si una migracion generada en el futuro
-- incluye `DROP INDEX "evento_carga_inicial_sin_terminar_unica"`, BORRA esa
-- linea antes de aplicarla: sin el indice, dos solicitudes simultaneas podrian
-- dejar dos salidas abiertas. Un `migrate reset` lo recrea porque vive aqui,
-- pero cualquier esquema levantado solo con `db push` no lo tendra. El
-- adaptador `prisma-carga.repository.ts` reconoce este nombre.
--
-- Si falla al aplicarse con "could not create unique index", alguna ruta ya
-- tiene dos iniciales sin terminar: termina o cancela una y vuelve a correrla.
CREATE UNIQUE INDEX "evento_carga_inicial_sin_terminar_unica"
  ON "eventos_carga"("rutaId")
  WHERE "tipo" = 'INICIAL' AND "estado" NOT IN ('ENVIADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "RolApp" AS ENUM ('VENDEDOR', 'CONTADOR', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "TipoCarga" AS ENUM ('INICIAL', 'RECARGA');

-- CreateEnum
CREATE TYPE "EstadoCarga" AS ENUM ('BORRADOR', 'EN_ESPERA_CONTADOR', 'BLOQUEADA_CORTE_PENDIENTE', 'EN_COMPARACION', 'CONFLICTOS_PENDIENTES', 'LISTA_PARA_ENVIAR', 'ENVIADA', 'ERROR_ENVIO', 'ENVIO_INCIERTO');

-- CreateEnum
CREATE TYPE "TipoSesion" AS ENUM ('VENDEDOR', 'CONTADOR', 'REFUERZO', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "EstadoSesion" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "UbicacionConteo" AS ENUM ('ALMACEN', 'CALLE');

-- CreateEnum
CREATE TYPE "ResultadoVerificacion" AS ENUM ('COINCIDE', 'DISCREPANCIA');

-- CreateEnum
CREATE TYPE "ResultadoRevision" AS ENUM ('CORRECTO', 'INCORRECTO');

-- CreateEnum
CREATE TYPE "UrgenciaAlerta" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoAlerta" AS ENUM ('PENDIENTE', 'RESUELTA', 'IGNORADA');

-- CreateEnum
CREATE TYPE "Plataforma" AS ENUM ('ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "rutas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rutas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_ruta_vendedor" (
    "id" TEXT NOT NULL,
    "rutaId" TEXT NOT NULL,
    "usuarioAppId" TEXT NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenteHasta" TIMESTAMP(3),

    CONSTRAINT "asignaciones_ruta_vendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_app" (
    "id" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "codigoInterno" TEXT,
    "pinHash" TEXT NOT NULL,
    "debeCambiarPin" BOOLEAN NOT NULL DEFAULT true,
    "fechaUltimoCambioPin" TIMESTAMP(3),
    "rolApp" "RolApp" NOT NULL,
    "usuarioHandyId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_app_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historiales_restablecimiento_pin" (
    "id" TEXT NOT NULL,
    "usuarioAppId" TEXT NOT NULL,
    "restablecidoPor" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historiales_restablecimiento_pin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_handy" (
    "idHandy" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rolHandyId" TEXT,
    "rolHandyAuthority" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaSincronizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_handy_pkey" PRIMARY KEY ("idHandy")
);

-- CreateTable
CREATE TABLE "productos" (
    "code" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioCentavos" INTEGER NOT NULL,
    "unidadCode" TEXT NOT NULL,
    "unidadDescripcion" TEXT NOT NULL,
    "familia" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdatedHandy" TIMESTAMP(3),
    "ultimaSincronizacionLocal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "frecuencias_producto_ruta" (
    "id" TEXT NOT NULL,
    "rutaId" TEXT NOT NULL,
    "productoCode" TEXT NOT NULL,
    "vecesUsadoUltimos30Dias" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "frecuencias_producto_ruta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_carga" (
    "id" TEXT NOT NULL,
    "rutaId" TEXT NOT NULL,
    "tipo" "TipoCarga" NOT NULL,
    "usuarioHandyId" TEXT NOT NULL,
    "estado" "EstadoCarga" NOT NULL DEFAULT 'BORRADOR',
    "fechaConteo" TIMESTAMP(3),
    "fechaBloqueoCortePendiente" TIMESTAMP(3),
    "fechaDesbloqueo" TIMESTAMP(3),
    "fechaProgramadaEnvio" TIMESTAMP(3),
    "fechaEnvioReal" TIMESTAMP(3),
    "idHandy" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventos_carga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_conteo" (
    "id" TEXT NOT NULL,
    "eventoCargaId" TEXT NOT NULL,
    "tipo" "TipoSesion" NOT NULL,
    "usuarioAppId" TEXT NOT NULL,
    "dispositivoId" TEXT,
    "ubicacion" "UbicacionConteo",
    "estado" "EstadoSesion" NOT NULL DEFAULT 'ABIERTA',
    "iniciadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadaEn" TIMESTAMP(3),

    CONSTRAINT "sesiones_conteo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conteos_item" (
    "id" TEXT NOT NULL,
    "sesionId" TEXT NOT NULL,
    "productoCode" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "conteos_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discrepancias_resueltas" (
    "id" TEXT NOT NULL,
    "eventoCargaId" TEXT NOT NULL,
    "productoCode" TEXT NOT NULL,
    "cantidadVendedorOriginal" INTEGER NOT NULL,
    "cantidadContadorOriginal" INTEGER NOT NULL,
    "cantidadFinal" INTEGER,
    "capturadaPor" TEXT,
    "fechaCaptura" TIMESTAMP(3),
    "confirmadaPor" TEXT,
    "fechaConfirmacion" TIMESTAMP(3),

    CONSTRAINT "discrepancias_resueltas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparaciones_carga" (
    "id" TEXT NOT NULL,
    "eventoCargaId" TEXT NOT NULL,
    "vendedorUsuarioAppId" TEXT NOT NULL,
    "contadorUsuarioAppId" TEXT NOT NULL,
    "totalProductos" INTEGER NOT NULL,
    "productosConDiscrepancia" INTEGER NOT NULL,
    "evidenciaExterna" TEXT,
    "verificadoSupervisor" BOOLEAN NOT NULL DEFAULT false,
    "resultadoVerificacion" "ResultadoVerificacion",
    "supervisorUsuarioAppId" TEXT,
    "fechaVerificacion" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparaciones_carga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisiones_supervisor" (
    "id" TEXT NOT NULL,
    "comparacionCargaId" TEXT NOT NULL,
    "productoCode" TEXT NOT NULL,
    "resultado" "ResultadoRevision" NOT NULL,
    "cantidadRealEncontrada" INTEGER,
    "fechaRevision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisiones_supervisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "urgencia" "UrgenciaAlerta" NOT NULL,
    "entidadRelacionada" TEXT,
    "mensaje" TEXT NOT NULL,
    "estado" "EstadoAlerta" NOT NULL DEFAULT 'PENDIENTE',
    "resueltaPor" TEXT,
    "fechaResolucion" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivos_push" (
    "id" TEXT NOT NULL,
    "usuarioAppId" TEXT NOT NULL,
    "fcmToken" TEXT NOT NULL,
    "plataforma" "Plataforma" NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispositivos_push_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rutas_codigo_key" ON "rutas"("codigo");

-- CreateIndex
CREATE INDEX "asignaciones_ruta_vendedor_rutaId_idx" ON "asignaciones_ruta_vendedor"("rutaId");

-- CreateIndex
CREATE INDEX "asignaciones_ruta_vendedor_usuarioAppId_idx" ON "asignaciones_ruta_vendedor"("usuarioAppId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_app_codigoInterno_key" ON "usuarios_app"("codigoInterno");

-- CreateIndex
CREATE INDEX "usuarios_app_usuarioHandyId_idx" ON "usuarios_app"("usuarioHandyId");

-- CreateIndex
CREATE INDEX "historiales_restablecimiento_pin_usuarioAppId_idx" ON "historiales_restablecimiento_pin"("usuarioAppId");

-- CreateIndex
CREATE UNIQUE INDEX "frecuencias_producto_ruta_rutaId_productoCode_key" ON "frecuencias_producto_ruta"("rutaId", "productoCode");

-- CreateIndex
CREATE INDEX "eventos_carga_rutaId_idx" ON "eventos_carga"("rutaId");

-- CreateIndex
CREATE INDEX "eventos_carga_usuarioHandyId_idx" ON "eventos_carga"("usuarioHandyId");

-- CreateIndex
CREATE INDEX "eventos_carga_estado_idx" ON "eventos_carga"("estado");

-- CreateIndex
CREATE INDEX "sesiones_conteo_eventoCargaId_idx" ON "sesiones_conteo"("eventoCargaId");

-- CreateIndex
CREATE INDEX "sesiones_conteo_usuarioAppId_idx" ON "sesiones_conteo"("usuarioAppId");

-- CreateIndex
CREATE UNIQUE INDEX "conteos_item_sesionId_productoCode_key" ON "conteos_item"("sesionId", "productoCode");

-- CreateIndex
CREATE UNIQUE INDEX "discrepancias_resueltas_eventoCargaId_productoCode_key" ON "discrepancias_resueltas"("eventoCargaId", "productoCode");

-- CreateIndex
CREATE UNIQUE INDEX "comparaciones_carga_eventoCargaId_key" ON "comparaciones_carga"("eventoCargaId");

-- CreateIndex
CREATE UNIQUE INDEX "revisiones_supervisor_comparacionCargaId_productoCode_key" ON "revisiones_supervisor"("comparacionCargaId", "productoCode");

-- CreateIndex
CREATE INDEX "alertas_estado_idx" ON "alertas"("estado");

-- CreateIndex
CREATE INDEX "alertas_urgencia_idx" ON "alertas"("urgencia");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_push_fcmToken_key" ON "dispositivos_push"("fcmToken");

-- CreateIndex
CREATE INDEX "dispositivos_push_usuarioAppId_idx" ON "dispositivos_push"("usuarioAppId");

-- AddForeignKey
ALTER TABLE "asignaciones_ruta_vendedor" ADD CONSTRAINT "asignaciones_ruta_vendedor_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "rutas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_ruta_vendedor" ADD CONSTRAINT "asignaciones_ruta_vendedor_usuarioAppId_fkey" FOREIGN KEY ("usuarioAppId") REFERENCES "usuarios_app"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_app" ADD CONSTRAINT "usuarios_app_usuarioHandyId_fkey" FOREIGN KEY ("usuarioHandyId") REFERENCES "usuarios_handy"("idHandy") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historiales_restablecimiento_pin" ADD CONSTRAINT "historiales_restablecimiento_pin_usuarioAppId_fkey" FOREIGN KEY ("usuarioAppId") REFERENCES "usuarios_app"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historiales_restablecimiento_pin" ADD CONSTRAINT "historiales_restablecimiento_pin_restablecidoPor_fkey" FOREIGN KEY ("restablecidoPor") REFERENCES "usuarios_app"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frecuencias_producto_ruta" ADD CONSTRAINT "frecuencias_producto_ruta_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "rutas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frecuencias_producto_ruta" ADD CONSTRAINT "frecuencias_producto_ruta_productoCode_fkey" FOREIGN KEY ("productoCode") REFERENCES "productos"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_carga" ADD CONSTRAINT "eventos_carga_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "rutas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_carga" ADD CONSTRAINT "eventos_carga_usuarioHandyId_fkey" FOREIGN KEY ("usuarioHandyId") REFERENCES "usuarios_handy"("idHandy") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_conteo" ADD CONSTRAINT "sesiones_conteo_eventoCargaId_fkey" FOREIGN KEY ("eventoCargaId") REFERENCES "eventos_carga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_conteo" ADD CONSTRAINT "sesiones_conteo_usuarioAppId_fkey" FOREIGN KEY ("usuarioAppId") REFERENCES "usuarios_app"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteos_item" ADD CONSTRAINT "conteos_item_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "sesiones_conteo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteos_item" ADD CONSTRAINT "conteos_item_productoCode_fkey" FOREIGN KEY ("productoCode") REFERENCES "productos"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrepancias_resueltas" ADD CONSTRAINT "discrepancias_resueltas_eventoCargaId_fkey" FOREIGN KEY ("eventoCargaId") REFERENCES "eventos_carga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrepancias_resueltas" ADD CONSTRAINT "discrepancias_resueltas_productoCode_fkey" FOREIGN KEY ("productoCode") REFERENCES "productos"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrepancias_resueltas" ADD CONSTRAINT "discrepancias_resueltas_capturadaPor_fkey" FOREIGN KEY ("capturadaPor") REFERENCES "usuarios_app"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrepancias_resueltas" ADD CONSTRAINT "discrepancias_resueltas_confirmadaPor_fkey" FOREIGN KEY ("confirmadaPor") REFERENCES "usuarios_app"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparaciones_carga" ADD CONSTRAINT "comparaciones_carga_eventoCargaId_fkey" FOREIGN KEY ("eventoCargaId") REFERENCES "eventos_carga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparaciones_carga" ADD CONSTRAINT "comparaciones_carga_vendedorUsuarioAppId_fkey" FOREIGN KEY ("vendedorUsuarioAppId") REFERENCES "usuarios_app"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparaciones_carga" ADD CONSTRAINT "comparaciones_carga_contadorUsuarioAppId_fkey" FOREIGN KEY ("contadorUsuarioAppId") REFERENCES "usuarios_app"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparaciones_carga" ADD CONSTRAINT "comparaciones_carga_supervisorUsuarioAppId_fkey" FOREIGN KEY ("supervisorUsuarioAppId") REFERENCES "usuarios_app"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisiones_supervisor" ADD CONSTRAINT "revisiones_supervisor_comparacionCargaId_fkey" FOREIGN KEY ("comparacionCargaId") REFERENCES "comparaciones_carga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisiones_supervisor" ADD CONSTRAINT "revisiones_supervisor_productoCode_fkey" FOREIGN KEY ("productoCode") REFERENCES "productos"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_resueltaPor_fkey" FOREIGN KEY ("resueltaPor") REFERENCES "usuarios_app"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_push" ADD CONSTRAINT "dispositivos_push_usuarioAppId_fkey" FOREIGN KEY ("usuarioAppId") REFERENCES "usuarios_app"("id") ON DELETE CASCADE ON UPDATE CASCADE;

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatearNombreFamilia } from '../conteo/formato-nombre';
import { router } from 'expo-router';

import { ErrorApi, ErrorRed } from '../api/cliente';
import { cerrarSesion } from '../api/sesion';
import { Etiqueta, Tarjeta } from '../componentes/base';
import { textoEmpaque, type EmpaqueConfirmado } from '../factores/modelo-factores';
import { ANCHO_MAXIMO_LISTA } from '../historial/ComponentesHistorial';
import { BORDES, CIFRAS, COLORES, ESPACIADO, ETIQUETA_DATO, FUENTE, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';

/** Piezas comunes de las pantallas de plantillas: filas de producto, casillas y avisos. */

export function sesionVencida() {
  void cerrarSesion().then(() => router.replace('/login'));
}

export interface AvisoError {
  titulo: string;
  detalle: string;
  tono: 'error' | 'atencion';
}

/** Qué decir de un error del servidor o de la red. `null` si fue sesión vencida (ya se atendió). */
export function avisoDeError(e: unknown, titulo: string): AvisoError | null {
  if (e instanceof ErrorApi && e.estado === 401) {
    sesionVencida();
    return null;
  }
  if (e instanceof ErrorRed) {
    return {
      titulo: 'Sin conexión',
      detalle: 'Las plantillas se guardan en el servidor: revisa tu señal y vuelve a intentarlo.',
      tono: 'atencion',
    };
  }
  return {
    titulo,
    detalle: e instanceof Error && e.message ? e.message : 'Intenta de nuevo en un momento.',
    tono: 'error',
  };
}

/** Del alto del título de familia; el toque se completa con hitSlop. */
const ALTO_BOTON_FAMILIA = ESPACIADO.xxl;
const TAMANO_CAJA = ESPACIADO.xl + ESPACIADO.xs;

/**
 * Nombre de la familia y cuántos trae. En modo selección, a la derecha, un
 * botón para marcar o desmarcar la familia entera.
 */
export function EncabezadoFamilia({
  titulo,
  detalle,
  accion,
}: {
  titulo: string;
  detalle: string;
  accion?: { texto: string; onPress: () => void; accessibilityLabel: string };
}) {
  return (
    <View style={estilos.encabezadoFamilia}>
      <View style={estilos.lineaFamilia} accessible accessibilityRole="header" accessibilityLabel={`${titulo}: ${detalle}`}>
        <Text style={estilos.textoFamilia} numberOfLines={2}>
          {formatearNombreFamilia(titulo)}
        </Text>
        <Text style={estilos.cantidadFamilia}>{detalle}</Text>
      </View>
      {accion && (
        <Pressable
          onPress={accion.onPress}
          accessibilityRole="button"
          accessibilityLabel={accion.accessibilityLabel}
          hitSlop={{ top: (TOQUE_MINIMO - ALTO_BOTON_FAMILIA) / 2, bottom: (TOQUE_MINIMO - ALTO_BOTON_FAMILIA) / 2 }}
          style={({ pressed }) => [estilos.botonFamilia, pressed && estilos.botonFamiliaPresionado]}
        >
          {({ pressed }) => (
            <Text style={[estilos.textoBotonFamilia, pressed && estilos.textoInvertido]} numberOfLines={1}>
              {accion.texto}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

export type ModoFila =
  | { tipo: 'lectura' }
  /** `tono`: rojo si marcar es para quitar, marca si es para agregar. */
  | { tipo: 'seleccion'; marcado: boolean; tono: 'marca' | 'error'; onAlternar: () => void }
  /** Ya está en la plantilla: se ve, pero no se puede marcar. */
  | { tipo: 'incluido' };

/**
 * Un producto: nombre, cómo se vende y si Handy lo desactivó. En selección,
 * toda la fila es la casilla (tocar el nombre también marca).
 */
export function FilaProducto({
  nombre,
  empaque,
  inactivo = false,
  modo,
}: {
  nombre: string;
  empaque: EmpaqueConfirmado | null;
  inactivo?: boolean;
  modo: ModoFila;
}) {
  const textoEmp = textoEmpaque(empaque);
  const datos = (
    <View style={estilos.cuerpoFila}>
      <Text style={[estilos.nombre, modo.tipo === 'incluido' && estilos.nombreIncluido]} numberOfLines={2}>
        {nombre}
      </Text>
      <View style={estilos.etiquetas}>
        {modo.tipo === 'incluido' ? (
          <Etiqueta texto="Ya está en la plantilla" tono="capturado" />
        ) : (
          <Etiqueta texto={textoEmp} tono={empaque ? 'referencia' : 'pendiente'} />
        )}
        {inactivo && <Etiqueta texto="Inactivo en Handy" tono="pendiente" relleno="contorno" />}
      </View>
    </View>
  );

  if (modo.tipo !== 'seleccion') {
    return (
      <Tarjeta
        compacta
        style={estilos.fila}
        accessible
        accessibilityLabel={[
          nombre,
          modo.tipo === 'incluido' ? 'Ya está en la plantilla' : textoEmp,
          inactivo ? 'Inactivo en Handy: no aparece al contar' : null,
        ]
          .filter(Boolean)
          .join('. ')}
      >
        {datos}
      </Tarjeta>
    );
  }

  const { marcado, tono, onAlternar } = modo;
  return (
    <Pressable
      onPress={onAlternar}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
      accessibilityLabel={[nombre, textoEmp, inactivo ? 'Inactivo en Handy' : null].filter(Boolean).join('. ')}
      style={({ pressed }) => [
        estilos.fila,
        estilos.filaSeleccion,
        marcado && (tono === 'error' ? estilos.filaMarcadaError : estilos.filaMarcadaMarca),
        pressed && estilos.filaPresionada,
      ]}
    >
      <View style={[estilos.caja, marcado && (tono === 'error' ? estilos.cajaError : estilos.cajaMarca)]}>
        {marcado && <View style={estilos.palomita} />}
      </View>
      {datos}
    </Pressable>
  );
}

/** Acciones fijas abajo, en blanco con línea de marca: siempre a la mano. */
export function BarraAcciones({ children }: { children: ReactNode }) {
  return (
    <View style={estilos.barra}>
      <View style={estilos.columnaBarra}>{children}</View>
    </View>
  );
}

export const estilosPlantillas = StyleSheet.create({
  filaBotones: {
    flexDirection: 'row',
    gap: RITMO.relacionado,
  },
  botonFila: {
    flex: 1,
  },
});

const estilos = StyleSheet.create({
  encabezadoFamilia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.interno,
    paddingTop: RITMO.grupo,
    paddingBottom: ESPACIADO.xs,
  },
  lineaFamilia: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: RITMO.relacionado,
  },
  textoFamilia: {
    flexShrink: 1,
    ...TIPOGRAFIA.familia,
    color: COLORES.texto,
  },
  cantidadFamilia: {
    ...ETIQUETA_DATO,
    ...CIFRAS,
  },
  botonFamilia: {
    height: ALTO_BOTON_FAMILIA,
    paddingHorizontal: ESPACIADO.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
    backgroundColor: COLORES.marcaTinte,
  },
  botonFamiliaPresionado: {
    backgroundColor: COLORES.marca,
  },
  textoBotonFamilia: {
    ...TIPOGRAFIA.etiqueta,
    fontFamily: FUENTE.negrita,
    color: COLORES.marcaHonda,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  fila: {
    marginTop: RITMO.relacionado,
  },
  // La fila seleccionable se ve como una tarjeta; el contorno aparece al marcarla.
  filaSeleccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.md,
    padding: RITMO.margen,
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.grande,
    borderWidth: BORDES.medio,
    borderColor: COLORES.superficie,
  },
  filaMarcadaError: {
    borderColor: COLORES.error,
    backgroundColor: COLORES.errorFondo,
  },
  filaMarcadaMarca: {
    borderColor: COLORES.marca,
    backgroundColor: COLORES.marcaTinte,
  },
  filaPresionada: {
    transform: [{ scale: 0.98 }],
  },
  cuerpoFila: {
    flex: 1,
    gap: RITMO.interno,
  },
  nombre: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.negrita,
    color: COLORES.texto,
  },
  nombreIncluido: {
    color: COLORES.textoSecundario,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: RITMO.interno,
  },
  caja: {
    width: TAMANO_CAJA,
    height: TAMANO_CAJA,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.medio,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.chico,
  },
  cajaError: {
    backgroundColor: COLORES.error,
    borderColor: COLORES.error,
  },
  cajaMarca: {
    backgroundColor: COLORES.marca,
    borderColor: COLORES.marca,
  },
  // Palomita: dos lados de un rectángulo, girados (igual que al rechazar productos).
  palomita: {
    width: ESPACIADO.sm,
    height: ESPACIADO.md + ESPACIADO.xs,
    marginTop: -ESPACIADO.xs / 2,
    borderRightWidth: BORDES.grueso,
    borderBottomWidth: BORDES.grueso,
    borderColor: COLORES.textoSobreColor,
    transform: [{ rotate: '45deg' }],
  },
  barra: {
    paddingHorizontal: RITMO.margen,
    paddingVertical: ESPACIADO.md,
    backgroundColor: COLORES.superficie,
    borderTopWidth: BORDES.grueso,
    borderTopColor: COLORES.marca,
  },
  columnaBarra: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.relacionado,
  },
});

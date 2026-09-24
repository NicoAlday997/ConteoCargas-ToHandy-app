import { StyleSheet, Text, View } from 'react-native';

import { BORDES, ESPACIADO, PESOS, RADIOS, TIPOGRAFIA, TONOS, type ColorTono } from '../../theme/tokens';

/**
 * Iconos dibujados con vistas, sin librerías: pocos, simples y del mismo trazo.
 * Solo acompañan a un estado vacío o a un error; nunca decoran un botón o una fila.
 * - lista: un historial o registro (aquí aparecerán las cargas).
 * - listo: nada pendiente (la cola está al día, todo resuelto).
 * - reloj: algo con vigencia (permisos).
 * - personas: usuarios.
 * - caja: productos de una carga.
 * - candado: sin acceso.
 * - alerta: algo falló.
 */
export type NombreIcono = 'lista' | 'listo' | 'reloj' | 'personas' | 'caja' | 'candado' | 'alerta';

const TAMANO = ESPACIADO.xxxl + ESPACIADO.sm;
const TRAZO = BORDES.grueso;
/** Centro del área interior de la esfera del reloj (sin el trazo). */
const CENTRO_ESFERA = (ESPACIADO.xxl - 2 * TRAZO) / 2;
const MANECILLA = ESPACIADO.sm;

interface Props {
  nombre: NombreIcono;
  tono?: ColorTono;
}

export function Icono({ nombre, tono = 'marca' }: Props) {
  const { solido, fondo } = TONOS[tono];
  return (
    <View
      style={[estilos.circulo, { backgroundColor: fondo }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Dibujo nombre={nombre} color={solido} />
    </View>
  );
}

function Dibujo({ nombre, color }: { nombre: NombreIcono; color: string }) {
  switch (nombre) {
    case 'lista':
      return (
        <View style={estilos.lista}>
          {[ESPACIADO.xl, ESPACIADO.xl, ESPACIADO.lg].map((ancho, i) => (
            <View key={i} style={estilos.renglon}>
              <View style={[estilos.punto, { backgroundColor: color }]} />
              <View style={[estilos.trazo, { width: ancho, backgroundColor: color }]} />
            </View>
          ))}
        </View>
      );
    case 'listo':
      return <View style={[estilos.palomita, { borderColor: color }]} />;
    case 'reloj':
      return (
        <View style={[estilos.esfera, { borderColor: color }]}>
          <View style={[estilos.manecillaLarga, { backgroundColor: color }]} />
          <View style={[estilos.manecillaCorta, { backgroundColor: color }]} />
        </View>
      );
    case 'personas':
      return (
        <View style={estilos.persona}>
          <View style={[estilos.cabeza, { backgroundColor: color }]} />
          <View style={[estilos.torso, { backgroundColor: color }]} />
        </View>
      );
    case 'caja':
      return (
        <View style={[estilos.caja, { borderColor: color }]}>
          <View style={[estilos.asa, { backgroundColor: color }]} />
        </View>
      );
    case 'candado':
      return (
        <View style={estilos.candado}>
          <View style={[estilos.arco, { borderColor: color }]} />
          <View style={[estilos.cuerpoCandado, { backgroundColor: color }]} />
        </View>
      );
    case 'alerta':
      return <Text style={[estilos.signo, { color }]}>!</Text>;
  }
}

const estilos = StyleSheet.create({
  circulo: {
    width: TAMANO,
    height: TAMANO,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
  },
  signo: {
    ...TIPOGRAFIA.display,
    fontWeight: PESOS.extraNegrita,
  },
  lista: {
    gap: ESPACIADO.xs,
  },
  renglon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.xs,
  },
  punto: {
    width: ESPACIADO.xs,
    height: ESPACIADO.xs,
    borderRadius: RADIOS.completo,
  },
  trazo: {
    height: ESPACIADO.xs,
    borderRadius: RADIOS.completo,
  },
  // Palomita: dos lados de un rectángulo, girados.
  palomita: {
    width: ESPACIADO.md,
    height: ESPACIADO.xl,
    marginTop: -ESPACIADO.xs,
    borderRightWidth: ESPACIADO.xs,
    borderBottomWidth: ESPACIADO.xs,
    transform: [{ rotate: '45deg' }],
  },
  esfera: {
    width: ESPACIADO.xxl,
    height: ESPACIADO.xxl,
    borderWidth: TRAZO,
    borderRadius: RADIOS.completo,
  },
  // Desde el centro hacia las 12 y hacia las 3.
  manecillaLarga: {
    position: 'absolute',
    left: CENTRO_ESFERA - TRAZO / 2,
    top: CENTRO_ESFERA - MANECILLA,
    width: TRAZO,
    height: MANECILLA + TRAZO / 2,
    borderRadius: RADIOS.completo,
  },
  manecillaCorta: {
    position: 'absolute',
    left: CENTRO_ESFERA - TRAZO / 2,
    top: CENTRO_ESFERA - TRAZO / 2,
    width: MANECILLA - ESPACIADO.xs + TRAZO,
    height: TRAZO,
    borderRadius: RADIOS.completo,
  },
  persona: {
    alignItems: 'center',
    gap: ESPACIADO.xs,
  },
  cabeza: {
    width: ESPACIADO.md,
    height: ESPACIADO.md,
    borderRadius: RADIOS.completo,
  },
  torso: {
    width: ESPACIADO.xl,
    height: ESPACIADO.md,
    borderTopLeftRadius: ESPACIADO.md,
    borderTopRightRadius: ESPACIADO.md,
  },
  caja: {
    width: ESPACIADO.xxl,
    height: ESPACIADO.xl,
    alignItems: 'center',
    borderWidth: TRAZO,
    borderRadius: RADIOS.chico,
  },
  asa: {
    width: ESPACIADO.md,
    height: TRAZO,
    marginTop: ESPACIADO.xs,
    borderRadius: RADIOS.completo,
  },
  candado: {
    alignItems: 'center',
  },
  arco: {
    width: ESPACIADO.lg,
    height: ESPACIADO.md,
    borderWidth: TRAZO,
    borderBottomWidth: 0,
    borderTopLeftRadius: ESPACIADO.sm,
    borderTopRightRadius: ESPACIADO.sm,
  },
  cuerpoCandado: {
    width: ESPACIADO.xl,
    height: ESPACIADO.lg,
    borderRadius: RADIOS.chico,
  },
});

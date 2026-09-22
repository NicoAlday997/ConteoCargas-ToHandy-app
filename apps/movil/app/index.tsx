import { StyleSheet, Text, View } from 'react-native';
import { COLORES, TIPOGRAFIA } from '../src/theme/tokens';

export default function PantallaInicio() {
  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo}>ConteoCargas</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES.fondo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    fontSize: TIPOGRAFIA.tamanos.xxl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
  },
});

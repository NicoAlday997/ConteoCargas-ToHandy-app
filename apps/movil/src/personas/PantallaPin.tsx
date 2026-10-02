import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarraAccion, Boton, Encabezado, Tarjeta } from '../componentes/base';
import {
  ANCHO_MAXIMO_LISTA,
  CIFRAS,
  COLORES,
  ESPACIADO,
  FUENTE,
  RITMO,
  TIPOGRAFIA,
} from '../theme/tokens';
import { textoPinUnaVez } from './modelo-personas';

/** Lo que llega del servidor tras un alta o un restablecimiento. */
export interface PinTemporal {
  nombre: string;
  pin: string;
  /** El título: "Alta lista" o "PIN restablecido". */
  motivo: 'alta' | 'restablecido';
}

/**
 * El PIN temporal, la única vez que existe en claro. El servidor solo guarda
 * su hash: si se pierde aquí, hay que restablecerlo.
 *
 * Por eso es una pantalla propia y no un aviso: no se cierra sola, no tiene
 * volver y el atrás del sistema no la saca (quien la monta pasa un `onCerrar`
 * vacío a su `PantallaModal` mientras se ve). Solo sale con "Ya se lo di",
 * que es el supervisor confirmando que lo entregó. El PIN va enorme para
 * dictarlo o enseñarlo de lejos, con un botón para copiarlo. La app no lo
 * guarda en ningún lado: al salir, se olvida.
 *
 * Es la misma pantalla para el alta y para el restablecimiento. Ocupa la
 * `PantallaModal` de donde salió (en vez de abrir otra encima): en iOS,
 * cerrar un modal y abrir otro a la vez puede dejar el segundo sin mostrarse.
 */
export function PantallaPin({
  datos,
  onListo,
}: {
  datos: PinTemporal;
  onListo: () => void;
}) {
  const { pin } = datos;
  // Cuál se copió: un PIN nuevo empieza sin copiar.
  const [copiadoDe, setCopiadoDe] = useState<string | null>(null);
  const copiado = copiadoDe === pin;

  const copiar = () => {
    void Clipboard.setStringAsync(pin).then((ok) =>
      setCopiadoDe(ok !== false ? pin : null),
    );
  };

  return (
    <SafeAreaView style={estilos.pantalla} edges={['left', 'right']}>
      <Encabezado
        variante="barra"
        titulo={datos.motivo === 'alta' ? 'Alta lista' : 'PIN restablecido'}
        subtitulo={datos.nombre}
      />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Tarjeta elevacion={2} style={estilos.tarjeta}>
          <Text style={estilos.rotulo}>PIN temporal</Text>
          <Text
            style={estilos.pin}
            selectable
            accessibilityLabel={`PIN temporal: ${pin.split('').join(' ')}`}
            maxFontSizeMultiplier={1.2}
          >
            {pin}
          </Text>
          <Boton
            texto={copiado ? 'Copiado' : 'Copiar PIN'}
            variante="secundario"
            onPress={copiar}
            accessibilityHint="Copia el PIN para pegarlo en un mensaje"
          />
        </Tarjeta>
        <Text style={estilos.aviso}>{textoPinUnaVez(datos.nombre)}</Text>
        <Text style={estilos.nota}>
          Si se pierde, tendrás que restablecerlo desde su ficha en Personas.
        </Text>
      </ScrollView>
      <BarraAccion>
        <Boton
          texto="Ya se lo di"
          onPress={onListo}
          style={estilos.boton}
          accessibilityHint="Cierra esta pantalla; el PIN ya no se vuelve a mostrar"
        />
      </BarraAccion>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  contenido: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO_LISTA,
    alignSelf: 'center',
    gap: RITMO.grupo,
    padding: RITMO.margen,
    paddingTop: RITMO.grupo,
  },
  tarjeta: {
    alignItems: 'center',
    gap: RITMO.relacionado,
    paddingVertical: RITMO.grupo,
  },
  rotulo: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.textoSecundario,
  },
  // Legible de lejos: más grande que cualquier cifra de la app, con aire entre dígitos.
  pin: {
    ...TIPOGRAFIA.numero,
    ...CIFRAS,
    fontSize: 72,
    lineHeight: 84,
    letterSpacing: ESPACIADO.md,
    // El espaciado también queda tras el último dígito: se compensa para centrar.
    paddingLeft: ESPACIADO.md,
    color: COLORES.texto,
  },
  aviso: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    color: COLORES.texto,
  },
  nota: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoSecundario,
  },
  boton: {
    flex: 1,
  },
});

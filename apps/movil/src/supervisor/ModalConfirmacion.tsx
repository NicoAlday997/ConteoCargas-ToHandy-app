import type { ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { BloqueError, Boton, Encabezado, type VarianteBoton } from '../componentes/base';
import { ANCHO_MODAL, COLORES, ESPACIADO, RADIOS, RITMO } from '../theme/tokens';

interface Props {
  visible: boolean;
  titulo: string;
  /** Qué va a pasar: se lee antes de confirmar. */
  children: ReactNode;
  textoConfirmar: string;
  textoCargando: string;
  /**
   * El botón que cierra sin hacer nada. «Cancelar» por omisión; cuando lo que
   * se confirma ES cancelar algo, otro texto evita dos botones «Cancelar».
   */
  textoCerrar?: string;
  variante?: VarianteBoton;
  cargando: boolean;
  /** Por qué falló el último intento; el modal sigue abierto para reintentar o cancelar. */
  error?: { titulo: string; detalle: string; tono?: 'error' | 'atencion' } | null;
  onConfirmar: () => void;
  onCerrar: () => void;
}

/**
 * Pregunta antes de una acción del supervisor que no se deshace desde aquí.
 * Mismo aspecto que el aviso de cerrar sesión: título, qué pasará y dos
 * botones del mismo ancho. Con `variante="peligro"` la acción destructiva
 * nunca es el botón dominante: el sólido es cerrar sin hacer nada.
 */
export function ModalConfirmacion({
  visible,
  titulo,
  children,
  textoConfirmar,
  textoCargando,
  textoCerrar = 'Cancelar',
  variante = 'primario',
  cargando,
  error,
  onConfirmar,
  onCerrar,
}: Props) {
  const cerrar = () => {
    if (!cargando) onCerrar();
  };
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={cerrar}>
      <View style={estilos.fondo}>
        <ScrollView contentContainerStyle={estilos.centrado} bounces={false}>
          <View style={estilos.modal}>
            <Encabezado titulo={titulo} variante="plano" />
            {children}
            {error && <BloqueError titulo={error.titulo} detalle={error.detalle} tono={error.tono ?? 'error'} />}
            {variante === 'peligro' ? (
              // Destructivo: la salida segura es el sólido y va primero; lo que
              // no se deshace queda de contorno, debajo.
              <View style={estilos.botonesApilados}>
                <Boton texto={textoCerrar} onPress={cerrar} deshabilitado={cargando} />
                <Boton
                  texto={textoConfirmar}
                  variante="peligro"
                  onPress={onConfirmar}
                  cargando={cargando}
                  textoCargando={textoCargando}
                />
              </View>
            ) : (
              <View style={estilos.botones}>
                <Boton texto={textoCerrar} variante="secundario" onPress={cerrar} deshabilitado={cargando} style={estilos.boton} />
                <Boton
                  texto={textoConfirmar}
                  variante={variante}
                  onPress={onConfirmar}
                  cargando={cargando}
                  textoCargando={textoCargando}
                  style={estilos.boton}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: COLORES.velo,
  },
  centrado: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: RITMO.margen,
  },
  modal: {
    width: '100%',
    maxWidth: ANCHO_MODAL,
    alignSelf: 'center',
    gap: RITMO.relacionado,
    padding: ESPACIADO.xl,
    backgroundColor: COLORES.superficie,
    borderRadius: RADIOS.grande,
  },
  botones: {
    flexDirection: 'row',
    gap: RITMO.relacionado,
    marginTop: ESPACIADO.sm,
  },
  boton: {
    flex: 1,
  },
  botonesApilados: {
    gap: RITMO.relacionado,
    marginTop: ESPACIADO.sm,
  },
});

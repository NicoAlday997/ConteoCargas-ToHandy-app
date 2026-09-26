import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { ErrorApi } from '../api/cliente';
import { CODIGO_NOMBRE_DUPLICADO } from '../api/plantillas';
import { BloqueError, Boton, CampoTexto, Encabezado } from '../componentes/base';
import { ANCHO_MODAL, COLORES, ESPACIADO, RADIOS, RITMO } from '../theme/tokens';
import { avisoDeError, estilosPlantillas } from './ComponentesPlantillas';
import { DESCRIPCION_MAXIMO, errorNombre, NOMBRE_MAXIMO } from './modelo-plantillas';

export interface DatosFormulario {
  nombre: string;
  descripcion: string | null;
}

interface Props {
  visible: boolean;
  titulo: string;
  textoGuardar: string;
  inicial: DatosFormulario;
  guardando: boolean;
  error: unknown;
  onGuardar: (datos: DatosFormulario) => void;
  onCerrar: () => void;
}

/** Nombre y descripción de una plantilla: para crearla o renombrarla. */
export function ModalDatosPlantilla(props: Props) {
  const cerrar = () => {
    if (!props.guardando) props.onCerrar();
  };
  return (
    <Modal visible={props.visible} transparent animationType="none" onRequestClose={cerrar}>
      <View style={estilos.fondo}>
        <ScrollView contentContainerStyle={estilos.centrado} bounces={false} keyboardShouldPersistTaps="handled">
          {props.visible && <Formulario {...props} onCerrar={cerrar} />}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Formulario({ titulo, textoGuardar, inicial, guardando, error, onGuardar, onCerrar }: Props) {
  const [nombre, setNombre] = useState(inicial.nombre);
  const [descripcion, setDescripcion] = useState(inicial.descripcion ?? '');
  const [intento, setIntento] = useState(false);

  const problemaNombre = errorNombre(nombre);
  const duplicado = error instanceof ErrorApi && error.cuerpo?.codigo === CODIGO_NOMBRE_DUPLICADO;
  const aviso = error && !duplicado ? avisoDeError(error, 'No se pudo guardar') : null;

  const guardar = () => {
    setIntento(true);
    if (problemaNombre) return;
    onGuardar({ nombre: nombre.trim(), descripcion: descripcion.trim() || null });
  };

  return (
    <View style={estilos.modal}>
      <Encabezado titulo={titulo} variante="plano" />
      <CampoTexto
        etiqueta="Nombre"
        valor={nombre}
        onCambiar={setNombre}
        ejemplo="Ej. Refrescos y aguas"
        maxLength={NOMBRE_MAXIMO}
        autoFocus={inicial.nombre === ''}
        error={
          intento && problemaNombre
            ? problemaNombre
            : duplicado
              ? 'Ya hay una plantilla con ese nombre. Usa otro para no confundirlas.'
              : null
        }
        ayuda="Es lo que se ve al asignarla a una ruta."
      />
      <CampoTexto
        etiqueta="Descripción (opcional)"
        valor={descripcion}
        onCambiar={setDescripcion}
        ejemplo="Ej. Rutas 1 a 5: refrescos, aguas, cigarros y abarrotes"
        multilinea
        maxLength={DESCRIPCION_MAXIMO}
      />
      {aviso && <BloqueError titulo={aviso.titulo} detalle={aviso.detalle} tono={aviso.tono} />}
      <View style={[estilosPlantillas.filaBotones, estilos.botones]}>
        <Boton texto="Cancelar" variante="secundario" onPress={onCerrar} deshabilitado={guardando} style={estilosPlantillas.botonFila} />
        <Boton
          texto={textoGuardar}
          onPress={guardar}
          cargando={guardando}
          textoCargando="Guardando…"
          style={estilosPlantillas.botonFila}
        />
      </View>
    </View>
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
    marginTop: ESPACIADO.sm,
  },
});

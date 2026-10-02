import type { ReactNode } from 'react';

import {
  AccionesHoja,
  BloqueError,
  Boton,
  Hoja,
  type VarianteBoton,
} from '../componentes/base';

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
  error?: {
    titulo: string;
    detalle: string;
    tono?: 'error' | 'atencion';
  } | null;
  /**
   * Una segunda salida que también hace algo, más modesta que confirmar
   * (p. ej. «Solo autorizar» junto a «Autorizar y enviar»). Va de contorno,
   * junto a cerrar; confirmar queda solo abajo, al alcance del pulgar.
   */
  alternativa?: { texto: string; onPress: () => void };
  /** Lleva un campo de texto: los botones van con el contenido (ver `Hoja`). */
  formulario?: boolean;
  /** Falta algo para poder confirmar (un motivo obligatorio): el botón se apaga. */
  confirmarDeshabilitado?: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
}

/**
 * Pregunta antes de una acción que no se deshace desde aquí. Una `Hoja`:
 * título, qué pasará y dos botones del mismo ancho. Con `variante="peligro"` la acción destructiva
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
  alternativa,
  formulario = false,
  confirmarDeshabilitado = false,
  onConfirmar,
  onCerrar,
}: Props) {
  const cerrar = () => {
    if (!cargando) onCerrar();
  };
  const confirmar = (
    <Boton
      texto={textoConfirmar}
      variante={variante}
      onPress={onConfirmar}
      deshabilitado={confirmarDeshabilitado}
      cargando={cargando}
      textoCargando={textoCargando}
      tacto={variante === 'peligro' ? 'aviso' : 'toque'}
    />
  );
  return (
    <Hoja
      visible={visible}
      onCerrar={cerrar}
      bloqueada={cargando}
      titulo={titulo}
      formulario={formulario}
      pie={
        variante === 'peligro' ? (
          // Destructivo: lo que no se deshace queda de contorno, arriba; la
          // salida segura es el sólido y va hasta abajo, la más cercana al pulgar.
          <AccionesHoja apiladas>
            {confirmar}
            <Boton
              texto={textoCerrar}
              onPress={cerrar}
              deshabilitado={cargando}
            />
          </AccionesHoja>
        ) : alternativa ? (
          <AccionesHoja apiladas>
            <AccionesHoja>
              <Boton
                texto={textoCerrar}
                variante="secundario"
                onPress={cerrar}
                deshabilitado={cargando}
              />
              <Boton
                texto={alternativa.texto}
                variante="secundario"
                onPress={alternativa.onPress}
                deshabilitado={cargando}
              />
            </AccionesHoja>
            {confirmar}
          </AccionesHoja>
        ) : (
          <AccionesHoja>
            <Boton
              texto={textoCerrar}
              variante="secundario"
              onPress={cerrar}
              deshabilitado={cargando}
            />
            {confirmar}
          </AccionesHoja>
        )
      }
    >
      {children}
      {error && (
        <BloqueError
          titulo={error.titulo}
          detalle={error.detalle}
          tono={error.tono ?? 'error'}
        />
      )}
    </Hoja>
  );
}

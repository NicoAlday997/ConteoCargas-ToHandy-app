import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ErrorApi, ErrorRed } from '../api/cliente';
import { useModificarCantidad } from '../api/hooks-supervisor';
import { BloqueError, Boton, CampoTexto, Encabezado, FilaDato, Tarjeta } from '../componentes/base';
import {
  admitePaquetes,
  admiteSueltas,
  primerCampo,
  seVendeCompleto,
  totalPiezas,
  type CampoCaptura,
  type CapturaProducto,
} from '../conteo/estado-conteo';
import { EtiquetaFactor, nombreCampo } from '../conteo/FilaProducto';
import { formatearPiezas } from '../conteo/formato-cantidad';
import { TecladoCantidad } from '../conteo/TecladoCantidad';
import { desglose } from '../discrepancias/estado-discrepancia';
import type { ProductoDetalle } from '../historial/modelo-historial';
import { cantidadEnUnidad } from '../historial/VistaCarga';
import { useLayout } from '../theme/breakpoints';
import { BORDES, CIFRAS, COLORES, ESPACIADO, PESOS, RADIOS, RITMO, ROTULO, TIPOGRAFIA, TOQUE_MINIMO } from '../theme/tokens';
import { motivoValido, MOTIVO_MINIMO } from './modelo-supervisor';

/** Igual que en el conteo: 9999 ya es un error de dedo. */
const MAX_DIGITOS = 4;
const ANCHO_TECLADO_LATERAL = 380;
const ANCHO_CONTENIDO = 560;

interface Edicion {
  campo: CampoCaptura;
  texto: string;
  /** El valor mostrado aún no se toca: la primera tecla lo reemplaza. */
  reemplazar: boolean;
}

function textoAValor(texto: string): number | null {
  return texto === '' ? null : Number(texto);
}

interface Props {
  eventoId: string;
  rutaNombre: string;
  /** `null` = cerrado. */
  producto: ProductoDetalle | null;
  onCerrar: () => void;
  /** Ya se registró: la carga salió de la cola del supervisor. */
  onModificada: (producto: ProductoDetalle, cantidad: string) => void;
  onSesionVencida: () => void;
}

/**
 * El supervisor propone una cantidad distinta para UN producto. Antes de
 * guardar deja claro lo que pasa después: la cantidad no queda aplicada con su
 * sola palabra; el vendedor o el contador la confirman con su PIN, y mientras
 * tanto la carga vuelve a diferencias por resolver y sale de su cola.
 */
export function ModalModificar({ producto, ...resto }: Props) {
  if (!producto) return null;
  // Por producto, un editor nuevo: se abre desde su cantidad actual, sin arrastrar lo de otro.
  return <Editor key={producto.code} producto={producto} {...resto} />;
}

function Editor({
  eventoId,
  rutaNombre,
  producto,
  onCerrar,
  onModificada,
  onSesionVencida,
}: Omit<Props, 'producto'> & { producto: ProductoDetalle }) {
  const { esTablet } = useLayout();
  const modificar = useModificarCantidad(eventoId);
  // Se corrige desde la cantidad actual, no se recaptura de cero.
  const [captura, setCaptura] = useState<CapturaProducto>(() => desglose(producto.cantidadFinal ?? 0, producto));
  const [edicion, setEdicion] = useState<Edicion | null>(() => {
    const campo = primerCampo(producto);
    const valor = desglose(producto.cantidadFinal ?? 0, producto)[campo];
    return { campo, texto: valor === null ? '' : String(valor), reemplazar: true };
  });
  const edicionRef = useRef<Edicion | null>(edicion);
  const [motivo, setMotivo] = useState('');
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [error, setError] = useState<{ titulo: string; detalle: string } | null>(null);
  const campoMotivo = useRef<TextInput>(null);

  const fijarEdicion = useCallback((nueva: Edicion | null) => {
    edicionRef.current = nueva;
    setEdicion(nueva);
  }, []);

  const capturaVisible = (): CapturaProducto =>
    edicion ? { ...captura, [edicion.campo]: textoAValor(edicion.texto) } : captura;

  const abrirCampo = (campo: CampoCaptura) => {
    const base = capturaVisible();
    setCaptura(base);
    campoMotivo.current?.blur();
    fijarEdicion({ campo, texto: base[campo] === null ? '' : String(base[campo]), reemplazar: true });
  };

  const cerrarTeclado = useCallback(() => {
    const actual = edicionRef.current;
    if (!actual) return;
    setCaptura((c) => ({ ...c, [actual.campo]: textoAValor(actual.texto) }));
    fijarEdicion(null);
  }, [fijarEdicion]);

  const alDigito = useCallback(
    (digito: string) => {
      const actual = edicionRef.current;
      if (!actual) return;
      let texto = actual.reemplazar ? digito : actual.texto + digito;
      if (texto.length > 1) texto = texto.replace(/^0+(?=\d)/, '');
      if (texto.length > MAX_DIGITOS) return;
      fijarEdicion({ ...actual, texto, reemplazar: false });
    },
    [fijarEdicion],
  );

  const alBorrar = useCallback(() => {
    const actual = edicionRef.current;
    if (!actual) return;
    fijarEdicion({ ...actual, texto: actual.reemplazar ? '' : actual.texto.slice(0, -1), reemplazar: false });
  }, [fijarEdicion]);

  const visible = capturaVisible();
  const nueva = totalPiezas(visible, producto);
  const actual = producto.cantidadFinal;
  const igual = nueva !== null && nueva === actual;
  const motivoOk = motivoValido(motivo);
  const puedeGuardar = nueva !== null && !igual && motivoOk;

  const alSiguiente = () => {
    const e = edicionRef.current;
    if (!e) return;
    if (e.campo === 'paquetes' && admiteSueltas(producto)) {
      setCaptura((c) => ({ ...c, paquetes: textoAValor(e.texto) }));
      fijarEdicion({ campo: 'sueltas', texto: visible.sueltas === null ? '' : String(visible.sueltas), reemplazar: true });
      return;
    }
    cerrarTeclado();
    campoMotivo.current?.focus();
  };

  const cerrar = () => {
    if (modificar.isPending) return;
    fijarEdicion(null);
    onCerrar();
  };

  const guardar = () => {
    setIntentoGuardar(true);
    if (!puedeGuardar || nueva === null) return;
    setError(null);
    modificar.mutate(
      { productoCode: producto.code, cantidadNueva: nueva, motivo: motivo.trim() },
      {
        onSuccess: () => {
          fijarEdicion(null);
          onModificada(producto, cantidadEnUnidad(nueva, producto));
        },
        onError: (e) => {
          if (e instanceof ErrorApi && e.estado === 401) {
            onSesionVencida();
            return;
          }
          if (e instanceof ErrorRed) {
            setError({ titulo: 'Sin conexión', detalle: 'La cantidad no se guardó. Inténtalo cuando haya señal.' });
          } else if (e instanceof ErrorApi && e.estado === 409) {
            setError({
              titulo: 'La carga ya no espera tu autorización',
              detalle:
                'Alguien la autorizó, rechazó productos o modificó otra cantidad hace un momento. Solo se puede modificar una cantidad por ronda. Cierra y revisa la lista.',
            });
          } else {
            setError({ titulo: 'No se pudo guardar', detalle: e.message || 'Intenta de nuevo en un momento.' });
          }
        },
      },
    );
  };

  const campos = (['paquetes', 'sueltas'] as const).filter((campo) =>
    campo === 'paquetes' ? admitePaquetes(producto) : admiteSueltas(producto),
  );

  const teclado = edicion ? (
    <TecladoCantidad
      producto={producto}
      campo={edicion.campo}
      texto={edicion.texto}
      reemplazar={edicion.reemplazar}
      captura={visible}
      etiquetaSiguiente={edicion.campo === 'paquetes' && admiteSueltas(producto) ? 'Sueltas ›' : 'Motivo ›'}
      lateral={esTablet}
      onDigito={alDigito}
      onBorrar={alBorrar}
      onSiguiente={alSiguiente}
      onListo={cerrarTeclado}
    />
  ) : null;

  let avisoCantidad: string | null = null;
  if (intentoGuardar && nueva === null) avisoCantidad = 'Captura la cantidad nueva.';
  else if (igual) avisoCantidad = 'Es la misma cantidad que ya tiene: no hay nada que modificar.';

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={cerrar}>
      <SafeAreaProvider>
        <SafeAreaView style={estilos.pantalla}>
          <Encabezado titulo="Modificar cantidad" subtitulo={rutaNombre} onVolver={cerrar} etiquetaVolver="Cancelar y volver" marca />
          <View style={[estilos.cuerpo, esTablet && estilos.cuerpoTablet]}>
            <ScrollView
              style={estilos.scroll}
              contentContainerStyle={estilos.contenido}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              <Tarjeta compacta>
                <View style={estilos.lineaProducto}>
                  <EtiquetaFactor producto={producto} />
                  <Text style={estilos.nombreProducto}>{producto.nombre}</Text>
                </View>
                <FilaDato etiqueta="Cantidad actual" valor={actual === null ? null : cantidadEnUnidad(actual, producto)} ausente="Sin resolver" />
              </Tarjeta>

              {/* Primero lo que pasa después: se lee antes de teclear nada. */}
              <Tarjeta tintada="discrepancia" elevacion={0} compacta style={estilos.aviso}>
                <Text style={estilos.tituloAviso} accessibilityRole="header">
                  Tu cambio no queda aplicado todavía
                </Text>
                <Text style={estilos.textoAviso}>
                  Nadie, ni el supervisor, cambia una cantidad sin el respaldo de dos personas. Tu cantidad queda como
                  propuesta hasta que <Text style={estilos.negrita}>el vendedor o el contador la confirmen con su PIN</Text>.
                </Text>
                <Text style={estilos.textoAviso}>
                  Al guardar, la carga <Text style={estilos.negrita}>sale de tu lista y vuelve a diferencias por resolver</Text>.
                  Regresará para tu autorización cuando la confirmen. Solo puedes modificar un producto por ronda.
                </Text>
              </Tarjeta>

              <View style={estilos.editor}>
                <Text style={estilos.rotulo}>Cantidad nueva</Text>
                <View style={estilos.campos}>
                  {campos.map((campo) => {
                    const activo = edicion?.campo === campo;
                    const valor = visible[campo];
                    return (
                      <Pressable
                        key={campo}
                        onPress={() => abrirCampo(campo)}
                        accessibilityRole="button"
                        accessibilityLabel={`${nombreCampo(producto, campo)}: ${valor ?? 'sin capturar'}`}
                        style={({ pressed }) => [estilos.campo, (activo || pressed) && estilos.campoActivo]}
                      >
                        {({ pressed }) => (
                          <>
                            <Text style={[estilos.etiquetaCampo, (activo || pressed) && estilos.textoInvertido]}>
                              {nombreCampo(producto, campo)}
                            </Text>
                            <Text style={[estilos.valorCampo, (activo || pressed) && estilos.textoInvertido]}>{valor ?? '—'}</Text>
                          </>
                        )}
                      </Pressable>
                    );
                  })}
                  {/* Lo completo ya está en su unidad: repetir "= 5 cajas" no aclara nada. */}
                  <Text style={estilos.total}>{nueva === null || seVendeCompleto(producto) ? '' : `= ${formatearPiezas(nueva)}`}</Text>
                </View>
                {avisoCantidad && <Text style={estilos.avisoCampo}>{avisoCantidad}</Text>}
              </View>

              <CampoTexto
                ref={campoMotivo}
                etiqueta="Motivo"
                valor={motivo}
                onCambiar={setMotivo}
                ejemplo="Ej. hay que cargar 2 cajas más para la ruta"
                multilinea
                maxLength={200}
                onFocus={cerrarTeclado}
                ayuda={`Mínimo ${MOTIVO_MINIMO} caracteres.`}
                error={intentoGuardar && !motivoOk ? `Escribe el motivo (mínimo ${MOTIVO_MINIMO} caracteres).` : null}
              />

              {error && <BloqueError titulo={error.titulo} detalle={error.detalle} />}

              <View style={estilos.botones}>
                <Boton texto="Cancelar" variante="secundario" onPress={cerrar} deshabilitado={modificar.isPending} style={estilos.boton} />
                <Boton
                  texto="Proponer cantidad"
                  onPress={guardar}
                  cargando={modificar.isPending}
                  textoCargando="Guardando…"
                  deshabilitado={igual}
                  accessibilityHint="Queda pendiente de que el vendedor o el contador la confirmen con su PIN"
                  style={estilos.boton}
                />
              </View>
            </ScrollView>
            {esTablet ? <View style={estilos.lateral}>{teclado}</View> : teclado}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondoPantalla,
  },
  cuerpo: {
    flex: 1,
  },
  cuerpoTablet: {
    flexDirection: 'row',
  },
  scroll: {
    flex: 1,
  },
  contenido: {
    width: '100%',
    maxWidth: ANCHO_CONTENIDO,
    alignSelf: 'center',
    gap: RITMO.grupo,
    padding: RITMO.margen,
    paddingBottom: ESPACIADO.xxxl,
  },
  lineaProducto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
  },
  nombreProducto: {
    flex: 1,
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  aviso: {
    gap: RITMO.relacionado,
  },
  tituloAviso: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.extraNegrita,
    color: COLORES.discrepanciaTexto,
  },
  textoAviso: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  negrita: {
    fontWeight: PESOS.negrita,
  },
  editor: {
    gap: ESPACIADO.xs,
  },
  rotulo: ROTULO,
  campos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.interno,
  },
  campo: {
    minWidth: ESPACIADO.xxxl * 2,
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.sm,
    backgroundColor: COLORES.fondo,
    borderWidth: BORDES.medio,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.medio,
  },
  // Lo que se está editando lleva la marca, relleno completo como en el conteo.
  campoActivo: {
    borderColor: COLORES.marca,
    backgroundColor: COLORES.marca,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  etiquetaCampo: {
    ...ROTULO,
    textAlign: 'right',
  },
  valorCampo: {
    ...TIPOGRAFIA.titulo,
    color: COLORES.texto,
    textAlign: 'right',
    ...CIFRAS,
  },
  total: {
    flexShrink: 1,
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.negrita,
    color: COLORES.marcaOscuro,
    ...CIFRAS,
  },
  avisoCampo: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.discrepanciaTexto,
  },
  botones: {
    flexDirection: 'row',
    gap: RITMO.relacionado,
  },
  boton: {
    flex: 1,
  },
  lateral: {
    width: ANCHO_TECLADO_LATERAL,
    backgroundColor: COLORES.fondoPantalla,
    borderLeftWidth: BORDES.grueso,
    borderLeftColor: COLORES.marca,
  },
});

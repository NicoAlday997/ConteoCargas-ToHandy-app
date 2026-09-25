import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ErrorApi, ErrorRed } from '../api/cliente';
import type { EstadoCargaApi } from '../api/historial';
import { useEnviarCarga } from '../api/hooks-supervisor';
import { BloqueError, FilaDato, Tarjeta } from '../componentes/base';
import { formatearCifra } from '../conteo/formato-cantidad';
import type { CargaDetalle } from '../historial/modelo-historial';
import { COLORES, PESOS, RITMO, TIPOGRAFIA } from '../theme/tokens';
import { codigosDeDetalle, nombresDeProductos } from './modelo-supervisor';
import { ModalConfirmacion } from './ModalConfirmacion';

/**
 * Envío a Handy desde la app (antes solo por Postman). La app nunca habla con
 * Handy: el backend es el único que tiene el token y el que decide qué pasó.
 * Aquí solo se traduce su respuesta a qué hacer.
 */

/** Estados en los que el envío (o su reintento) tiene sentido. */
export const ESTADOS_ENVIABLES: ReadonlySet<EstadoCargaApi> = new Set<EstadoCargaApi>([
  'LISTA_PARA_ENVIAR',
  'ENVIO_INCIERTO',
  'ERROR_ENVIO',
]);

/** Lo que respondió el último intento de esta pantalla. */
type Resultado =
  | { tipo: 'enviada'; idHandy: string | null; yaExistia: boolean; rechazados: string[] }
  | { tipo: 'inventario-total'; rechazados: string[] }
  | { tipo: 'incierto' }
  | { tipo: 'token' }
  | { tipo: 'sin-red' }
  | { tipo: 'otro'; mensaje: string };

function interpretarError(e: unknown, carga: CargaDetalle): Resultado {
  if (e instanceof ErrorRed) return { tipo: 'sin-red' };
  if (e instanceof ErrorApi && e.estado === 409 && e.cuerpo?.detalle) {
    return { tipo: 'inventario-total', rechazados: nombresDeProductos(codigosDeDetalle(e.cuerpo.detalle), carga) };
  }
  // Los dos 502 solo se distinguen por el texto; el estado de la carga, al
  // releerse, lo confirma (ENVIO_INCIERTO o ERROR_ENVIO) y manda sobre esto.
  if (e instanceof ErrorApi && e.estado === 502) {
    return /administrador/i.test(e.cuerpo?.mensaje ?? '') ? { tipo: 'token' } : { tipo: 'incierto' };
  }
  return { tipo: 'otro', mensaje: e instanceof Error && e.message ? e.message : 'No se pudo enviar la carga.' };
}

export function useEnvioHandy(eventoId: string, carga: CargaDetalle | null, onSesionVencida: () => void) {
  const enviar = useEnviarCarga(eventoId);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const confirmar = () => {
    if (!carga) return;
    enviar.mutate(undefined, {
      onSuccess: (r) =>
        setResultado({
          tipo: 'enviada',
          idHandy: r?.idHandy ?? null,
          yaExistia: r?.yaExistia === true,
          rechazados: nombresDeProductos(r?.productosRechazados ?? [], carga),
        }),
      onError: (e) => {
        if (e instanceof ErrorApi && e.estado === 401) {
          onSesionVencida();
          return;
        }
        setResultado(interpretarError(e, carga));
      },
      // Sea cual sea el desenlace, lo que sigue se lee en la pantalla, no en el modal.
      onSettled: () => setConfirmando(false),
    });
  };

  return {
    resultado,
    enviando: enviar.isPending,
    confirmando,
    pedirConfirmacion: () => setConfirmando(true),
    cancelar: () => setConfirmando(false),
    confirmar,
  };
}

export type EnvioHandy = ReturnType<typeof useEnvioHandy>;

/** Texto del botón según lo que pasó: reintentar no se ve igual que el primer envío. */
export function textoBotonEnvio(estado: EstadoCargaApi | null): string {
  return estado === 'LISTA_PARA_ENVIAR' ? 'Enviar a Handy' : 'Reintentar envío';
}

/**
 * Qué pasó con el envío. El estado de la carga manda (sobrevive a cerrar la
 * pantalla); la respuesta del último intento agrega lo que el estado no
 * guarda: el id de Handy y los productos rechazados.
 */
export function AvisoEnvio({ estado, envio }: { estado: EstadoCargaApi | null; envio: EnvioHandy }) {
  const { resultado } = envio;

  if (estado === 'ENVIADA') {
    const enviada = resultado?.tipo === 'enviada' ? resultado : null;
    return (
      <Tarjeta tintada="capturado" elevacion={0} compacta style={estilos.bloque}>
        <Text style={estilos.tituloExito} accessibilityRole="header">
          Enviada a Handy
        </Text>
        {enviada?.idHandy && <FilaDato etiqueta="Ruta en Handy" valor={`#${enviada.idHandy}`} />}
        {enviada?.yaExistia && (
          <Text style={estilos.texto}>
            La ruta ya se había creado en el intento anterior: se registró sin volver a enviarla, así que no quedó duplicada.
          </Text>
        )}
        {enviada && enviada.rechazados.length > 0 && (
          <BloqueError
            tono="atencion"
            titulo={
              enviada.rechazados.length === 1
                ? 'Handy no aceptó 1 producto por inventario insuficiente'
                : `Handy no aceptó ${enviada.rechazados.length} productos por inventario insuficiente`
            }
            detalle={`El resto de la carga sí se envió. Quedaron fuera: ${enviada.rechazados.join(', ')}. Revisa su inventario en Handy.`}
          />
        )}
      </Tarjeta>
    );
  }

  if (estado === 'ENVIO_INCIERTO') {
    return (
      <BloqueError
        tono="atencion"
        titulo="No se pudo confirmar el envío"
        detalle="Handy no respondió a tiempo: la ruta pudo haberse creado o no. Reintentar es seguro y no la duplica: antes de reenviar, el sistema pregunta a Handy si la ruta ya existe y, si existe, solo la registra."
        style={estilos.bloque}
      />
    );
  }

  if (estado === 'ERROR_ENVIO') {
    return (
      <BloqueError
        titulo="Handy rechazó la conexión"
        detalle="El token de integración con Handy no es válido o ya venció. No se arregla desde la app ni reintentando: avisa al administrador para que lo renueve en el servidor. Cuando lo haga, reintenta el envío."
        style={estilos.bloque}
      />
    );
  }

  if (estado !== 'LISTA_PARA_ENVIAR' || !resultado) return null;

  switch (resultado.tipo) {
    case 'inventario-total':
      return (
        <BloqueError
          titulo="Handy rechazó todos los productos por inventario"
          detalle={[
            'No se creó ninguna ruta y la carga sigue lista para enviar.',
            resultado.rechazados.length > 0 ? `Rechazados: ${resultado.rechazados.join(', ')}.` : null,
            'Cuando haya inventario en Handy, vuelve a enviarla.',
          ]
            .filter(Boolean)
            .join(' ')}
          style={estilos.bloque}
        />
      );
    case 'sin-red':
      return (
        <BloqueError
          tono="atencion"
          titulo="Sin conexión con el servidor"
          detalle="No se sabe si el envío alcanzó a salir. Reintentar es seguro: si ya se envió, el servidor lo detecta y no la duplica."
          style={estilos.bloque}
        />
      );
    case 'otro':
      return <BloqueError titulo="No se pudo enviar" detalle={resultado.mensaje} style={estilos.bloque} />;
    // 'incierto' y 'token' se muestran por el estado en cuanto se relee la carga.
    default:
      return null;
  }
}

/** Antes de enviar: qué va a llegar a Handy. Una vez ahí no se corrige desde la app. */
export function ModalEnviar({ carga, envio }: { carga: CargaDetalle; envio: EnvioHandy }) {
  const { evento, totalProductos, totalPiezas } = carga;
  const reintento = evento.estado !== 'LISTA_PARA_ENVIAR';
  const destino =
    evento.tipo === 'RECARGA'
      ? `Se agregará como recarga a la ruta abierta de ${evento.rutaNombre} en Handy`
      : `Se creará la ruta de ${evento.rutaNombre} en Handy`;

  return (
    <ModalConfirmacion
      visible={envio.confirmando}
      titulo={reintento ? '¿Reintentar el envío?' : '¿Enviar a Handy?'}
      textoConfirmar={reintento ? 'Reintentar' : 'Enviar'}
      textoCargando="Enviando…"
      cargando={envio.enviando}
      onConfirmar={envio.confirmar}
      onCerrar={envio.cancelar}
    >
      <Text style={estilos.texto}>
        {destino} con{' '}
        <Text style={estilos.negrita}>
          {totalProductos} {totalProductos === 1 ? 'producto' : 'productos'}
        </Text>{' '}
        ({formatearCifra(totalPiezas)} piezas).
      </Text>
      {evento.estado === 'ENVIO_INCIERTO' && (
        <Text style={estilos.texto}>Antes de reenviar se revisa si la ruta ya existe en Handy: no se duplica.</Text>
      )}
    </ModalConfirmacion>
  );
}

const estilos = StyleSheet.create({
  bloque: {
    marginTop: RITMO.relacionado,
    gap: RITMO.relacionado,
  },
  tituloExito: {
    ...TIPOGRAFIA.subtitulo,
    fontWeight: PESOS.negrita,
    color: COLORES.capturadoTexto,
  },
  texto: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  negrita: {
    fontWeight: PESOS.negrita,
  },
});

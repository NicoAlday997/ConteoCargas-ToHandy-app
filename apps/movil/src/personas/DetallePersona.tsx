import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ETIQUETAS_ROL } from '../api/auth';
import { ErrorApi, ErrorRed } from '../api/cliente';
import {
  useDesbloquearPersona,
  useEditarPersona,
  useRestablecerPin,
} from '../api/hooks-personas';
import { obtenerUsuarioSesion } from '../api/sesion';
import {
  AccionesHoja,
  Avatar,
  BloqueError,
  Boton,
  CampoTexto,
  Datos,
  Encabezado,
  Hoja,
  PantallaConFormulario,
  PantallaModal,
  Tarjeta,
  TituloSeccion,
  type Dato,
} from '../componentes/base';
import {
  ANCHO_MAXIMO_LISTA,
  COLORES,
  ESPACIADO,
  FUENTE,
  RITMO,
  TIPOGRAFIA,
} from '../theme/tokens';
import {
  PantallaHistorialAcceso,
  SeccionHistorialAcceso,
} from './HistorialAcceso';
import {
  bloqueoVigente,
  CONSEJO_DESACTIVAR,
  textoBloqueo,
  textoInicioBloqueo,
  type Persona,
} from './modelo-personas';
import { PantallaPin, type PinTemporal } from './PantallaPin';

const TAMANO_AVATAR = 64;

type Confirmacion = 'desactivar' | 'restablecer' | null;

/**
 * Ficha de una persona: cambiar su nombre, darla de baja o de alta otra vez,
 * restablecer su PIN y, si está bloqueada por intentos fallidos, quitarle el
 * bloqueo. Abajo, su historial de acceso (solo lectura). El rol y la cuenta
 * de Handy no se cambian aquí.
 *
 * Los rechazos del servidor (no puedes desactivarte a ti mismo, no puedes
 * dejar el sistema sin supervisor…) se muestran tal cual: ya vienen escritos
 * para quien los lee.
 */
export function DetallePersona({
  persona,
  cuentaHandy,
  ahora,
  onCerrar,
}: {
  persona: Persona | null;
  /** Nombre de la cuenta de Handy vinculada (solo vendedores). */
  cuentaHandy: string | null;
  /** La hora que avanza sola en la lista: el bloqueo se ve bajar y vencer. */
  ahora: number;
  onCerrar: () => void;
}) {
  const [pin, setPin] = useState<PinTemporal | null>(null);
  const [verAccesos, setVerAccesos] = useState(false);
  // El nombre a medio editar vive aquí y no en la Ficha: la Ficha se desmonta
  // al abrir "Ver todo" (o el PIN) y, al volver, no debe perderse lo escrito.
  // Va atado a la persona para que no se cuele en la ficha de otra.
  const [borrador, setBorrador] = useState<{
    personaId: string;
    nombre: string;
  } | null>(null);
  const terminar = () => {
    setPin(null);
    setVerAccesos(false);
    setBorrador(null);
    onCerrar();
  };
  return (
    // Con el PIN en pantalla, el atrás del sistema no hace nada; con el
    // historial completo, regresa a la ficha.
    <PantallaModal
      visible={persona !== null}
      onCerrar={
        pin ? () => {} : verAccesos ? () => setVerAccesos(false) : terminar
      }
    >
      {persona &&
        (pin ? (
          <PantallaPin datos={pin} onListo={() => setPin(null)} />
        ) : verAccesos ? (
          <PantallaHistorialAcceso
            persona={persona}
            ahora={ahora}
            onVolver={() => setVerAccesos(false)}
          />
        ) : (
          <Ficha
            key={persona.id}
            persona={persona}
            cuentaHandy={cuentaHandy}
            ahora={ahora}
            nombre={
              borrador?.personaId === persona.id
                ? borrador.nombre
                : persona.nombre
            }
            onCambiarNombre={(nombre) =>
              setBorrador({ personaId: persona.id, nombre })
            }
            onCerrar={terminar}
            onPin={setPin}
            onVerAccesos={() => setVerAccesos(true)}
          />
        ))}
    </PantallaModal>
  );
}

/** El id de quien tiene la sesión: su propio bloqueo no lo puede quitar. */
function useMiId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true;
    void obtenerUsuarioSesion().then((sesion) => {
      if (vigente) setId(sesion?.id ?? null);
    });
    return () => {
      vigente = false;
    };
  }, []);
  return id;
}

function Ficha({
  persona,
  cuentaHandy,
  ahora,
  nombre,
  onCambiarNombre,
  onCerrar,
  onPin,
  onVerAccesos,
}: {
  persona: Persona;
  cuentaHandy: string | null;
  ahora: number;
  /** Lo que hay en el campo de nombre (el borrador, si alguien lo está editando). */
  nombre: string;
  onCambiarNombre: (nombre: string) => void;
  onCerrar: () => void;
  onPin: (pin: PinTemporal) => void;
  onVerAccesos: () => void;
}) {
  const editar = useEditarPersona();
  const restablecer = useRestablecerPin();
  const desbloquear = useDesbloquearPersona();
  const miId = useMiId();
  const [confirmar, setConfirmar] = useState<Confirmacion>(null);
  const bloqueo = bloqueoVigente(persona, ahora);
  const esYo = miId !== null && miId === persona.id;

  const nombreNuevo = nombre.trim();
  const cambioNombre = nombreNuevo.length > 0 && nombreNuevo !== persona.nombre;

  const guardarNombre = () => {
    restablecer.reset();
    desbloquear.reset();
    editar.mutate({ id: persona.id, datos: { nombreCompleto: nombreNuevo } });
  };

  const cambiarActivo = (activo: boolean) => {
    restablecer.reset();
    desbloquear.reset();
    editar.mutate(
      { id: persona.id, datos: { activo } },
      { onSettled: () => setConfirmar(null) },
    );
  };

  const restablecerPin = () => {
    editar.reset();
    desbloquear.reset();
    restablecer.mutate(persona.id, {
      onSuccess: (respuesta) => {
        setConfirmar(null);
        if (respuesta?.pinTemporal)
          onPin({
            nombre: persona.nombre,
            pin: respuesta.pinTemporal,
            motivo: 'restablecido',
          });
      },
      onError: () => setConfirmar(null),
    });
  };

  const quitarBloqueo = () => {
    editar.reset();
    restablecer.reset();
    desbloquear.mutate(persona.id);
  };

  // Si el bloqueo venció justo antes del toque, el resultado es el mismo: ya puede entrar.
  const yaNoEstaba =
    desbloquear.error instanceof ErrorApi && desbloquear.error.estado === 409;
  const desbloqueado = desbloquear.isSuccess || yaNoEstaba;

  const fallo =
    editar.error ??
    restablecer.error ??
    (yaNoEstaba ? null : desbloquear.error);
  const textoFallo = fallo
    ? fallo instanceof ErrorRed
      ? 'Sin conexión: no se guardó nada. Revisa la señal y vuelve a intentarlo.'
      : fallo.message
    : restablecer.isSuccess && !restablecer.data?.pinTemporal
      ? 'El servidor no devolvió el PIN nuevo. Vuelve a restablecerlo.'
      : null;

  const datos: Dato[] = [
    { rotulo: 'Rol', valor: ETIQUETAS_ROL[persona.rol] },
    { rotulo: 'Estado', valor: persona.activo ? 'Activo' : 'Inactivo' },
  ];
  if (persona.rol === 'VENDEDOR')
    datos.push({
      rotulo: 'Cuenta de Handy',
      valor: cuentaHandy,
      ausente: 'Sin cuenta',
    });
  if (persona.activo && persona.pinPendiente)
    datos.push({ rotulo: 'PIN', valor: 'Temporal: aún no pone el suyo' });
  if (bloqueo) {
    datos.push({ rotulo: 'Acceso', valor: textoBloqueo(bloqueo, ahora) });
    datos.push({
      rotulo: 'Se bloqueó',
      valor: textoInicioBloqueo(bloqueo, ahora),
    });
  }

  return (
    <SafeAreaView style={estilos.pantalla} edges={['left', 'right', 'bottom']}>
      <Encabezado
        variante="barra"
        titulo={persona.nombre}
        subtitulo={ETIQUETAS_ROL[persona.rol]}
        onVolver={onCerrar}
      />
      <PantallaConFormulario estiloContenido={estilos.contenido}>
        <Tarjeta style={estilos.identidad}>
          <Avatar
            nombre={persona.nombre}
            fotoUrl={persona.fotoUrl}
            tamano={TAMANO_AVATAR}
          />
          <View style={estilos.datos}>
            <Datos datos={datos} />
          </View>
        </Tarjeta>

        {textoFallo && <BloqueError titulo="No se pudo" detalle={textoFallo} />}

        <View style={estilos.bloque}>
          <TituloSeccion texto="Nombre" nivel="grupo" />
          <CampoTexto
            etiqueta="Nombre completo"
            valor={nombre}
            onCambiar={onCambiarNombre}
            maxLength={120}
            ayuda="Para corregirlo. Si llega otra persona, no le cambies el nombre a esta: da de alta una nueva."
            error={
              nombre.trim().length === 0 ? 'Escribe su nombre completo.' : null
            }
          />
          <Boton
            texto="Guardar nombre"
            variante="secundario"
            onPress={guardarNombre}
            deshabilitado={!cambioNombre || editar.isPending}
            cargando={
              editar.isPending &&
              editar.variables?.datos.nombreCompleto !== undefined
            }
            textoCargando="Guardando…"
          />
        </View>

        {/* Solo mientras está bloqueado: un botón que no hace nada no se muestra. */}
        {bloqueo && (
          <View style={estilos.bloque}>
            <TituloSeccion
              texto="Bloqueo"
              nivel="grupo"
              detalle="Se equivocó de PIN 5 veces seguidas."
            />
            {esYo ? (
              <Text style={estilos.nota}>
                No puedes quitarte tu propio bloqueo: lo tiene que hacer otro
                supervisor. Si no hay ninguno, sigue el procedimiento de
                recuperación de acceso.
              </Text>
            ) : (
              <>
                <Text style={estilos.nota}>
                  Si recuerda su PIN, quítale el bloqueo y que vuelva a
                  intentar. Si no lo recuerda, mejor restablécelo: eso también
                  quita el bloqueo.
                </Text>
                <Boton
                  texto="Quitar bloqueo"
                  onPress={quitarBloqueo}
                  deshabilitado={editar.isPending || restablecer.isPending}
                  cargando={desbloquear.isPending}
                  textoCargando="Quitando…"
                />
              </>
            )}
          </View>
        )}
        {!bloqueo && desbloqueado && (
          <Tarjeta tintada="capturado" elevacion={0} compacta>
            <Text style={estilos.listo}>
              Listo: ya puede entrar con su PIN.
            </Text>
          </Tarjeta>
        )}

        <View style={estilos.bloque}>
          <TituloSeccion
            texto="PIN"
            nivel="grupo"
            detalle="Si lo olvidó. También le quita el bloqueo por intentos fallidos."
          />
          <Boton
            texto="Restablecer PIN"
            variante="secundario"
            onPress={() => setConfirmar('restablecer')}
            deshabilitado={!persona.activo || editar.isPending}
          />
          {!persona.activo && (
            <Text style={estilos.nota}>
              Está inactivo: actívalo primero para darle un PIN.
            </Text>
          )}
        </View>

        <View style={estilos.bloque}>
          <TituloSeccion
            texto={persona.activo ? 'Dar de baja' : 'Volver a activar'}
            nivel="grupo"
          />
          {persona.activo ? (
            <>
              {/* El error más fácil de cometer y el más caro de deshacer: se dice antes de que pase. */}
              <Tarjeta tintada="discrepancia" elevacion={0} compacta>
                <Text style={estilos.consejo}>{CONSEJO_DESACTIVAR}</Text>
              </Tarjeta>
              <Boton
                texto="Desactivar"
                variante="peligro"
                onPress={() => setConfirmar('desactivar')}
                deshabilitado={editar.isPending}
              />
            </>
          ) : (
            <>
              <Text style={estilos.nota}>
                No puede entrar a la app. Su historial de cargas se conserva.
              </Text>
              <Boton
                texto="Activar"
                variante="secundario"
                onPress={() => cambiarActivo(true)}
                cargando={
                  editar.isPending && editar.variables?.datos.activo === true
                }
                textoCargando="Activando…"
              />
            </>
          )}
        </View>

        <SeccionHistorialAcceso
          personaId={persona.id}
          ahora={ahora}
          onVerTodo={onVerAccesos}
        />
      </PantallaConFormulario>

      <Hoja
        visible={confirmar === 'desactivar'}
        onCerrar={() => setConfirmar(null)}
        bloqueada={editar.isPending}
        titulo={`¿Desactivar a ${persona.nombre}?`}
        detalle="Ya no va a poder entrar a la app. Su historial de cargas se conserva, firmado con su nombre."
        pie={
          <AccionesHoja apiladas>
            <Boton
              texto="Desactivar"
              variante="peligro"
              onPress={() => cambiarActivo(false)}
              cargando={editar.isPending}
              textoCargando="Desactivando…"
            />
            <Boton
              texto="Cancelar"
              variante="secundario"
              onPress={() => setConfirmar(null)}
              deshabilitado={editar.isPending}
            />
          </AccionesHoja>
        }
      />

      <Hoja
        visible={confirmar === 'restablecer'}
        onCerrar={() => setConfirmar(null)}
        bloqueada={restablecer.isPending}
        titulo={`¿Restablecer el PIN de ${persona.nombre}?`}
        detalle="Su PIN actual deja de servir. Te vamos a mostrar uno temporal para que se lo des; al entrar, la app le pedirá que ponga el suyo."
        pie={
          <AccionesHoja>
            <Boton
              texto="Cancelar"
              variante="secundario"
              onPress={() => setConfirmar(null)}
              deshabilitado={restablecer.isPending}
            />
            <Boton
              texto="Restablecer"
              onPress={restablecerPin}
              cargando={restablecer.isPending}
              textoCargando="Un momento…"
            />
          </AccionesHoja>
        }
      />
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
    paddingBottom: ESPACIADO.xxxl,
  },
  identidad: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: RITMO.relacionado,
  },
  datos: {
    flex: 1,
  },
  bloque: {
    gap: RITMO.relacionado,
  },
  consejo: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    color: COLORES.discrepanciaTexto,
  },
  nota: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoSecundario,
  },
  listo: {
    ...TIPOGRAFIA.cuerpo,
    fontFamily: FUENTE.semiNegrita,
    color: COLORES.capturadoTexto,
  },
});

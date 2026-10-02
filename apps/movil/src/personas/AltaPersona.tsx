import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ETIQUETAS_ROL, type RolApp } from '../api/auth';
import { ErrorRed } from '../api/cliente';
import { useCrearPersona, useCuentasHandy } from '../api/hooks-personas';
import {
  Avatar,
  BarraAccion,
  BloqueError,
  Boton,
  CampoTexto,
  Encabezado,
  PantallaConFormulario,
  PantallaModal,
  Pulsable,
  TituloSeccion,
} from '../componentes/base';
import {
  ANCHO_MAXIMO_LISTA,
  BORDES,
  COLORES,
  ESPACIADO,
  FUENTE,
  RADIOS,
  RITMO,
  TIPOGRAFIA,
  TOQUE_MINIMO,
} from '../theme/tokens';
import {
  ayudaRol,
  cuentasLibres,
  cuerpoAlta,
  SIN_CUENTAS_LIBRES,
  validarAlta,
  type CuentaLibre,
} from './modelo-personas';
import { PantallaPin, type PinTemporal } from './PantallaPin';

const ROLES: readonly { rol: RolApp; descripcion: string }[] = [
  { rol: 'VENDEDOR', descripcion: 'Cuenta la carga de su ruta.' },
  { rol: 'CONTADOR', descripcion: 'Verifica lo que contó el vendedor.' },
  {
    rol: 'SUPERVISOR',
    descripcion: 'Autoriza las cargas y administra la app.',
  },
];

const TAMANO_AVATAR = 40;

/**
 * Alta de una persona: nombre, rol y, SOLO si es vendedor, su cuenta de Handy.
 *
 * La regla la valida el servidor (un vendedor siempre lleva cuenta; contador y
 * supervisor nunca), pero aquí ni siquiera se puede llenar mal: el selector
 * de cuentas aparece al elegir Vendedor y desaparece con cualquier otro rol,
 * y la cuenta elegida no viaja si el rol ya no es vendedor (`cuerpoAlta`).
 *
 * Las cuentas salen de los vendedores sincronizados desde Handy; las que ya
 * ocupa otro usuario activo no se ofrecen.
 *
 * Al guardar, el servidor devuelve el PIN temporal en claro: el formulario
 * cede su lugar a `PantallaPin`, de la que solo se sale con "Ya se lo di".
 */
export function AltaPersona({
  visible,
  onCerrar,
}: {
  visible: boolean;
  onCerrar: () => void;
}) {
  const [pin, setPin] = useState<PinTemporal | null>(null);
  const terminar = () => {
    setPin(null);
    onCerrar();
  };
  return (
    // Con el PIN en pantalla, el atrás del sistema no hace nada.
    <PantallaModal visible={visible} onCerrar={pin ? () => {} : terminar}>
      {/* Montado solo mientras está abierto: cada alta empieza en blanco. */}
      {visible &&
        (pin ? (
          <PantallaPin datos={pin} onListo={terminar} />
        ) : (
          <Formulario onCerrar={terminar} onCreada={setPin} />
        ))}
    </PantallaModal>
  );
}

function Formulario({
  onCerrar,
  onCreada,
}: {
  onCerrar: () => void;
  onCreada: (pin: PinTemporal) => void;
}) {
  const crear = useCrearPersona();
  const cuentas = useCuentasHandy(true);
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<RolApp | null>(null);
  const [cuentaId, setCuentaId] = useState<number | null>(null);
  const [intento, setIntento] = useState(false);

  const libres = cuentasLibres(cuentas.data ?? null);
  const errores = validarAlta({ nombre, rol, cuentaId });
  const valido = !errores.nombre && !errores.rol && !errores.cuenta;

  const elegirRol = (nuevo: RolApp) => {
    setRol(nuevo);
    // La cuenta es solo del vendedor: al cambiar de rol se olvida.
    if (nuevo !== 'VENDEDOR') setCuentaId(null);
  };

  const guardar = () => {
    setIntento(true);
    if (!valido || rol === null) return;
    const cuerpo = cuerpoAlta({ nombre, rol, cuentaId });
    crear.mutate(cuerpo, {
      onSuccess: (respuesta) => {
        const pin = respuesta?.pinTemporal;
        // Sin PIN en la respuesta no hay nada que entregar: que lo restablezca desde su ficha.
        if (!pin) return;
        onCreada({
          nombre: respuesta?.usuario?.nombreCompleto ?? cuerpo.nombreCompleto,
          pin,
          motivo: 'alta',
        });
      },
    });
  };

  const errorGuardar = crear.error
    ? crear.error instanceof ErrorRed
      ? 'Sin conexión: no se dio de alta. Revisa la señal y vuelve a intentarlo.'
      : crear.error.message
    : crear.isSuccess && !crear.data?.pinTemporal
      ? 'Se dio de alta, pero el servidor no devolvió el PIN. Restablécelo desde su ficha en Personas.'
      : null;

  return (
    <SafeAreaView style={estilos.pantalla} edges={['left', 'right']}>
      <Encabezado
        variante="barra"
        titulo="Dar de alta"
        onVolver={onCerrar}
        etiquetaVolver="Cancelar y volver"
      />
      <PantallaConFormulario
        estiloContenido={estilos.contenido}
        pie={
          <BarraAccion
            nota={
              intento && !valido ? 'Falta completar lo marcado arriba.' : null
            }
          >
            <Boton
              texto="Cancelar"
              variante="secundario"
              onPress={onCerrar}
              deshabilitado={crear.isPending}
              style={estilos.boton}
            />
            <Boton
              texto="Dar de alta"
              onPress={guardar}
              cargando={crear.isPending}
              textoCargando="Guardando…"
              style={estilos.boton}
            />
          </BarraAccion>
        }
      >
        <CampoTexto
          etiqueta="Nombre completo"
          valor={nombre}
          onCambiar={setNombre}
          ejemplo="Ej. Juan Pérez López"
          maxLength={120}
          ayuda="Así aparece al entrar y en el historial de cargas."
          error={intento ? errores.nombre : null}
        />

        <View style={estilos.bloque}>
          <TituloSeccion texto="Qué hace en la app" nivel="grupo" />
          <View style={estilos.opciones} accessibilityRole="radiogroup">
            {ROLES.map((r) => (
              <OpcionRol
                key={r.rol}
                rol={r.rol}
                descripcion={r.descripcion}
                seleccionado={rol === r.rol}
                onPress={() => elegirRol(r.rol)}
              />
            ))}
          </View>
          {intento && errores.rol ? (
            <Text style={estilos.error}>{errores.rol}</Text>
          ) : null}
          {rol && (
            <Text style={estilos.ayudaRol} accessibilityLiveRegion="polite">
              {ayudaRol(rol)}
            </Text>
          )}
        </View>

        {rol === 'VENDEDOR' && (
          <View style={estilos.bloque}>
            <TituloSeccion texto="Cuenta de Handy" nivel="grupo" />
            {cuentas.isPending ? (
              <Text style={estilos.ayudaRol}>Cargando cuentas de Handy…</Text>
            ) : cuentas.isError && !cuentas.data ? (
              <BloqueError
                titulo="No se pudieron cargar las cuentas de Handy"
                detalle={
                  cuentas.error instanceof ErrorRed
                    ? 'Revisa la señal.'
                    : cuentas.error instanceof Error
                      ? cuentas.error.message
                      : null
                }
                onReintentar={() => void cuentas.refetch()}
                reintentando={cuentas.isFetching}
              />
            ) : libres.length === 0 ? (
              <BloqueError tono="atencion" titulo={SIN_CUENTAS_LIBRES} />
            ) : (
              <View style={estilos.opciones} accessibilityRole="radiogroup">
                {libres.map((c) => (
                  <OpcionCuenta
                    key={c.idHandy}
                    cuenta={c}
                    seleccionada={cuentaId === c.idHandy}
                    onPress={() => setCuentaId(c.idHandy)}
                  />
                ))}
              </View>
            )}
            {intento && errores.cuenta && libres.length > 0 ? (
              <Text style={estilos.error}>{errores.cuenta}</Text>
            ) : null}
          </View>
        )}

        {errorGuardar && (
          <BloqueError titulo="No se dio de alta" detalle={errorGuardar} />
        )}
      </PantallaConFormulario>
    </SafeAreaView>
  );
}

function OpcionRol({
  rol,
  descripcion,
  seleccionado,
  onPress,
}: {
  rol: RolApp;
  descripcion: string;
  seleccionado: boolean;
  onPress: () => void;
}) {
  return (
    <Pulsable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: seleccionado }}
      accessibilityLabel={`${ETIQUETAS_ROL[rol]}. ${descripcion}`}
      style={({ pressed }) => [
        estilos.opcion,
        seleccionado && estilos.opcionSeleccionada,
        pressed && estilos.opcionPresionada,
      ]}
    >
      {({ pressed }) => (
        <>
          <Text
            style={[estilos.tituloOpcion, pressed && estilos.textoInvertido]}
          >
            {ETIQUETAS_ROL[rol]}
          </Text>
          <Text
            style={[
              estilos.descripcionOpcion,
              pressed && estilos.textoInvertido,
            ]}
          >
            {descripcion}
          </Text>
        </>
      )}
    </Pulsable>
  );
}

function OpcionCuenta({
  cuenta,
  seleccionada,
  onPress,
}: {
  cuenta: CuentaLibre;
  seleccionada: boolean;
  onPress: () => void;
}) {
  return (
    <Pulsable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: seleccionada }}
      accessibilityLabel={`Cuenta de Handy ${cuenta.nombre}`}
      style={({ pressed }) => [
        estilos.opcion,
        estilos.opcionCuenta,
        seleccionada && estilos.opcionSeleccionada,
        pressed && estilos.opcionPresionada,
      ]}
    >
      {({ pressed }) => (
        <>
          <Avatar
            nombre={cuenta.nombre}
            fotoUrl={cuenta.fotoUrl}
            tamano={TAMANO_AVATAR}
          />
          <Text
            style={[estilos.tituloCuenta, pressed && estilos.textoInvertido]}
            numberOfLines={2}
          >
            {cuenta.nombre}
          </Text>
        </>
      )}
    </Pulsable>
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
  bloque: {
    gap: RITMO.relacionado,
  },
  opciones: {
    gap: ESPACIADO.sm,
  },
  // Las mismas tarjetas de opción que el empaque de un producto (factores).
  opcion: {
    minHeight: TOQUE_MINIMO,
    gap: ESPACIADO.xs,
    padding: RITMO.margen,
    backgroundColor: COLORES.superficie,
    borderWidth: BORDES.medio,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.medio,
  },
  opcionCuenta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
    paddingVertical: ESPACIADO.sm,
  },
  opcionSeleccionada: {
    borderColor: COLORES.accion,
    backgroundColor: COLORES.marcaTinte,
  },
  // Inversión completa al presionar: se nota aun con poca luz.
  opcionPresionada: {
    borderColor: COLORES.accion,
    backgroundColor: COLORES.accion,
  },
  tituloOpcion: {
    ...TIPOGRAFIA.subtitulo,
    fontFamily: FUENTE.extraNegrita,
    color: COLORES.texto,
  },
  descripcionOpcion: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoSecundario,
  },
  tituloCuenta: {
    ...TIPOGRAFIA.subtitulo,
    flex: 1,
    color: COLORES.texto,
  },
  textoInvertido: {
    color: COLORES.textoSobreColor,
  },
  ayudaRol: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },
  error: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.error,
  },
  boton: {
    flex: 1,
  },
});

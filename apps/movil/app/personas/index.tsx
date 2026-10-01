import { useEffect, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ETIQUETAS_ROL } from '../../src/api/auth';
import { ErrorApi, ErrorRed } from '../../src/api/cliente';
import { useCuentasHandy, usePersonas } from '../../src/api/hooks-personas';
import {
  Avatar,
  BloqueError,
  Boton,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  NotaEncabezado,
  Pulsable,
  Seccion,
  TarjetaEsqueleto,
} from '../../src/componentes/base';
import { ANCHO_MAXIMO_LISTA, BarraSuperior, volver } from '../../src/historial/ComponentesHistorial';
import { AltaPersona } from '../../src/personas/AltaPersona';
import { DetallePersona } from '../../src/personas/DetallePersona';
import { agruparPersonas, detalleGrupo, normalizarPersonas, type Persona } from '../../src/personas/modelo-personas';
import { sesionVencida } from '../../src/plantillas/ComponentesPlantillas';
import { useEsSupervisor } from '../../src/supervisor/useEsSupervisor';
import { COLORES, ELEVACION, ESPACIADO, OPACIDAD, RADIOS, RITMO, TIPOGRAFIA, TOQUE_MINIMO } from '../../src/theme/tokens';

/**
 * Personas (solo Supervisor): quién usa la app. Dar de alta a alguien nuevo,
 * corregir su nombre, darlo de baja o de alta otra vez y restablecer su PIN.
 *
 * Agrupadas por rol; dentro de cada grupo, los inactivos al final y apagados.
 * Nadie se borra: un inactivo conserva su historial de cargas.
 */

const TITULO = 'Personas';
const TAMANO_AVATAR = 44;

export default function PantallaPersonas() {
  const esSupervisor = useEsSupervisor();

  if (esSupervisor === undefined) {
    return (
      <Pantalla>
        <EsqueletoLista />
      </Pantalla>
    );
  }

  if (!esSupervisor) {
    return (
      <Pantalla>
        <EstadoVacio
          icono="candado"
          titulo="Solo para supervisores"
          detalle="Las altas, bajas y PIN de las personas los maneja un supervisor."
          accion={{ texto: 'Volver', onPress: volver }}
        />
      </Pantalla>
    );
  }

  return <Lista />;
}

function Pantalla({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={estilos.pantalla} edges={['left', 'right', 'bottom']}>
      <BarraSuperior titulo={TITULO} marca={false}>
        <NotaEncabezado>Quién usa la app y con qué rol.</NotaEncabezado>
      </BarraSuperior>
      {children}
    </SafeAreaView>
  );
}

function EsqueletoLista() {
  return (
    <Esqueleto etiqueta="Cargando personas" style={estilos.contenido}>
      <TarjetaEsqueleto lineas={['60%', '45%', '70%', '50%']} />
    </Esqueleto>
  );
}

function Lista() {
  const consulta = usePersonas(true);
  // Las cuentas de Handy dan la foto de cada vendedor; si fallan, quedan las iniciales.
  const cuentas = useCuentasHandy(true);
  const [creando, setCreando] = useState(false);
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const vencida = [consulta.error, cuentas.error].some((e) => e instanceof ErrorApi && e.estado === 401);
  useEffect(() => {
    if (vencida) sesionVencida();
  }, [vencida]);

  const refrescar = () => {
    setRefrescando(true);
    void Promise.all([consulta.refetch(), cuentas.refetch()]).finally(() => setRefrescando(false));
  };

  if (consulta.isPending) {
    return (
      <Pantalla>
        <EsqueletoLista />
      </Pantalla>
    );
  }

  if (consulta.isError && !consulta.data) {
    const sinRed = consulta.error instanceof ErrorRed;
    return (
      <Pantalla>
        <View style={estilos.contenido}>
          <BloqueError
            titulo={sinRed ? 'Sin conexión' : 'No se pudo cargar la lista de personas'}
            detalle={
              sinRed
                ? 'Para ver a las personas necesitas señal: revísala.'
                : (consulta.error instanceof Error && consulta.error.message) || null
            }
            tono={sinRed ? 'atencion' : 'error'}
            onReintentar={() => void consulta.refetch()}
            reintentando={consulta.isFetching}
            secundaria={{ texto: 'Volver', onPress: volver }}
          />
        </View>
      </Pantalla>
    );
  }

  const personas = normalizarPersonas(consulta.data ?? null, cuentas.data ?? null);
  const grupos = agruparPersonas(personas);
  // Se busca en la lista viva: tras guardar, la ficha muestra lo que quedó en el servidor.
  const abierta = personas.find((p) => p.id === abiertaId) ?? null;
  const cuentaAbierta =
    abierta?.usuarioHandyId != null
      ? (cuentas.data?.find((c) => c.idHandy === abierta.usuarioHandyId)?.nombre ?? null)
      : null;

  return (
    <Pantalla>
      <ScrollView contentContainerStyle={estilos.contenido} refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}>
        <Boton texto="Dar de alta a alguien" onPress={() => setCreando(true)} accessibilityHint="Nombre, rol y, si es vendedor, su cuenta de Handy" />
        {grupos.length === 0 ? (
          <EstadoVacio icono="personas" titulo="Todavía no hay nadie" detalle="Da de alta a la primera persona." enLinea />
        ) : (
          grupos.map((g) => (
            <Seccion key={g.rol} texto={g.titulo} detalle={detalleGrupo(g.personas)}>
              <View style={estilos.tarjeta}>
                {g.personas.map((p) => (
                  <RenglonPersona key={p.id} persona={p} onPress={() => setAbiertaId(p.id)} />
                ))}
              </View>
            </Seccion>
          ))
        )}
      </ScrollView>
      <AltaPersona visible={creando} onCerrar={() => setCreando(false)} />
      <DetallePersona persona={abierta} cuentaHandy={cuentaAbierta} onCerrar={() => setAbiertaId(null)} />
    </Pantalla>
  );
}

function RenglonPersona({ persona, onPress }: { persona: Persona; onPress: () => void }) {
  const rol = ETIQUETAS_ROL[persona.rol];
  const pinPendiente = persona.activo && persona.pinPendiente;
  return (
    <Pulsable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[persona.nombre, rol, persona.activo ? 'activo' : 'inactivo', pinPendiente ? 'aún no cambia su PIN temporal' : null]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint="Abrir su ficha"
      style={({ pressed }) => [estilos.renglon, pressed && estilos.renglonPresionado]}
    >
      {/* Apagado, pero se sigue leyendo: el inactivo se consulta, no se usa. */}
      <View style={[estilos.cuerpoRenglon, !persona.activo && estilos.apagado]}>
        <Avatar nombre={persona.nombre} fotoUrl={persona.fotoUrl} tamano={TAMANO_AVATAR} />
        <View style={estilos.textosRenglon}>
          <Text style={estilos.nombre} numberOfLines={1}>
            {persona.nombre}
          </Text>
          <Text style={estilos.detalle}>{pinPendiente ? `${rol} · Aún no pone su PIN` : rol}</Text>
        </View>
      </View>
      {persona.activo ? <Etiqueta texto="Activo" tono="capturado" /> : <Etiqueta texto="Inactivo" tono="referencia" />}
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
  tarjeta: {
    ...ELEVACION[1],
    borderRadius: RADIOS.grande,
    paddingVertical: ESPACIADO.xs,
  },
  renglon: {
    minHeight: TOQUE_MINIMO + ESPACIADO.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
    paddingHorizontal: RITMO.margen,
    paddingVertical: ESPACIADO.sm,
  },
  renglonPresionado: {
    backgroundColor: COLORES.superficieHonda,
  },
  cuerpoRenglon: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
  },
  apagado: {
    opacity: OPACIDAD.deshabilitado,
  },
  textosRenglon: {
    flex: 1,
  },
  nombre: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  detalle: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoTerciario,
  },
});

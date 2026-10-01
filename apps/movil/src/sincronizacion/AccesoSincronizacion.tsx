import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import type { RolApp } from '../api/auth';
import { ErrorApi, ErrorRed } from '../api/cliente';
import { useUsuarios } from '../api/hooks-auth';
import { clavesSincronizacion, useEstadoSincronizacion, useSincronizarConHandy } from '../api/hooks-sincronizacion';
import { AccionesHoja, BloqueError, Boton, FilaMenu, Hoja } from '../componentes/base';
import { COLORES, RITMO, TIPOGRAFIA } from '../theme/tokens';
import {
  falloSincronizacion,
  quienConfirma,
  remateSinPermiso,
  resumirSincronizacion,
  textoSinConfirmar,
  textoUltimaSincronizacion,
} from './modelo-sincronizacion';

function falloDe(error: unknown) {
  if (error instanceof ErrorRed) return falloSincronizacion({ sinRed: true });
  if (error instanceof ErrorApi) {
    return falloSincronizacion({
      sinRed: false,
      estado: error.estado,
      codigo: error.cuerpo?.codigo,
      mensaje: error.message,
    });
  }
  return falloSincronizacion({ sinRed: false });
}

/**
 * Fila del inicio, para los tres roles, que trae de Handy el catálogo y los
 * vendedores. Dice cuándo fue la última vez (en color de aviso si pasaron más
 * de 3 días o nunca se hizo) y, al terminar, abre una hoja con lo que cambió
 * en palabras. Mismo componente y mismo diseño para todos; lo que cambia es
 * el remate:
 *
 * - Supervisor: si quedaron productos sin empaque confirmado, lo lleva de la
 *   mano a confirmarlos ("Confirmar ahora"): traer productos nuevos casi
 *   siempre deja ese pendiente, y es suyo.
 * - Vendedor y contador: si llegaron productos nuevos, se les dice que todavía
 *   no los pueden contar y QUIÉN tiene que hacer algo, sin botón. Razón:
 *   sincronizar no les desbloquea nada (confirmar el empaque y armar la
 *   plantilla son del supervisor), así que el valor del botón para ellos es
 *   SABER que el producto ya existe y a quién avisarle. Un mensaje que no diga
 *   eso convierte el botón en una palanca muerta; uno que los mande a una
 *   pantalla que no pueden usar, en un callejón.
 *
 * Si alguien sincronizó hace menos de 2 minutos el servidor responde 429 sin
 * tocar Handy (candado global, docs/04 §1.3): se dice sin alarma, no es un
 * error.
 *
 * Va dentro de un `GrupoMenu`. El servidor la corre sola a las 5:00; esta fila
 * es para forzarla (productos nuevos, una foto, un vendedor dado de alta).
 */
export function AccesoSincronizacion({ rol }: { rol: RolApp | null }) {
  const estado = useEstadoSincronizacion(true);
  const sincronizar = useSincronizarConHandy();
  const clienteConsultas = useQueryClient();
  const [hojaAbierta, setHojaAbierta] = useState(false);
  // TanStack limpia `error` al reintentar: mientras corre, la hoja sigue diciendo qué falló.
  const [ultimoFallo, setUltimoFallo] = useState<unknown>(null);

  const ultima = estado.data ? textoUltimaSincronizacion(estado.data.ultimaSincronizacion, new Date()) : null;

  const correr = () => {
    sincronizar.mutate(undefined, {
      onSuccess: () => setUltimoFallo(null),
      onError: (error) => {
        setUltimoFallo(error);
        // Alguien más acaba de sincronizar: su "Última vez" ya es la nuestra.
        if (error instanceof ErrorApi && error.estado === 429) {
          void clienteConsultas.invalidateQueries({ queryKey: clavesSincronizacion.estado });
        }
      },
      onSettled: () => setHojaAbierta(true),
    });
  };
  const cerrar = () => {
    if (sincronizar.isPending) return;
    setHojaAbierta(false);
  };
  const confirmarAhora = () => {
    setHojaAbierta(false);
    router.push('/factores');
  };

  return (
    <>
      <FilaMenu
        tarea="sincronizar"
        texto="Sincronizar con Handy"
        detalle={ultima?.texto}
        detalleAviso={ultima?.vieja}
        cargando={sincronizar.isPending}
        textoCargando="Sincronizando…"
        accessibilityHint="Trae de Handy los productos y vendedores nuevos o cambiados. Puede tardar unos segundos."
        onPress={correr}
      />
      <Hoja
        visible={hojaAbierta}
        onCerrar={cerrar}
        bloqueada={sincronizar.isPending}
        titulo={ultimoFallo || sincronizar.isPending ? undefined : resumirSincronizacion(sincronizar.data).titulo}
        pie={
          <AccionesHoja>
            <Boton texto="Listo" variante="secundario" deshabilitado={sincronizar.isPending} onPress={cerrar} />
          </AccionesHoja>
        }
      >
        {hojaAbierta && (
          <Contenido rol={rol} sincronizar={sincronizar} fallo={ultimoFallo} onReintentar={correr} onConfirmarAhora={confirmarAhora} />
        )}
      </Hoja>
    </>
  );
}

function Contenido({
  rol,
  sincronizar,
  fallo: error,
  onReintentar,
  onConfirmarAhora,
}: {
  rol: RolApp | null;
  sincronizar: ReturnType<typeof useSincronizarConHandy>;
  fallo: unknown;
  onReintentar: () => void;
  onConfirmarAhora: () => void;
}) {
  const esSupervisor = rol === 'SUPERVISOR';
  // A quién avisarle sale de la lista de usuarios activos (la misma del login).
  const usuarios = useUsuarios();
  const supervisor = quienConfirma(
    (usuarios.data ?? []).filter((u) => u.rolApp === 'SUPERVISOR').map((u) => u.nombreCompleto ?? ''),
  );

  // Reintentando desde la hoja: el mismo bloque del fallo, con su indicador.
  if (error) {
    const fallo = falloDe(error);
    if (fallo.informativo) return <Text style={estilos.renglon}>{fallo.detalle}</Text>;
    return (
      <BloqueError
        titulo={fallo.titulo}
        detalle={fallo.detalle}
        onReintentar={fallo.reintentable ? onReintentar : undefined}
        reintentando={sincronizar.isPending}
      />
    );
  }

  const resumen = resumirSincronizacion(sincronizar.data);
  const remate = esSupervisor ? null : remateSinPermiso(rol, sincronizar.data?.productos?.nuevos ?? 0, supervisor);
  return (
    <View style={estilos.contenido}>
      {resumen.renglones.length > 0 ? (
        <View style={estilos.renglones}>
          {resumen.renglones.map((renglon) => (
            <Text key={renglon} style={estilos.renglon}>
              · {renglon}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={estilos.renglon}>No había nada nuevo en Handy.</Text>
      )}
      {resumen.errorVendedores && (
        <BloqueError tono="atencion" titulo="Los vendedores no se actualizaron" detalle={resumen.errorVendedores} />
      )}
      {/* Información, no una tarea suya: sin botón. */}
      {remate && <BloqueError tono="atencion" titulo={remate} />}
      {esSupervisor && resumen.sinConfirmarEmpaque > 0 && (
        <BloqueError
          tono="atencion"
          titulo={textoSinConfirmar(resumen.sinConfirmarEmpaque)}
          onReintentar={onConfirmarAhora}
          textoReintentar="Confirmar ahora"
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenido: {
    gap: RITMO.relacionado,
  },
  renglones: {
    gap: RITMO.interno,
  },
  renglon: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
});

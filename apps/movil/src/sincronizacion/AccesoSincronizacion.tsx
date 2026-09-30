import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ErrorApi, ErrorRed } from '../api/cliente';
import { useEstadoSincronizacion, useSincronizarConHandy } from '../api/hooks-sincronizacion';
import { AccionesHoja, BloqueError, Boton, FilaMenu, Hoja } from '../componentes/base';
import { COLORES, RITMO, TIPOGRAFIA } from '../theme/tokens';
import {
  falloSincronizacion,
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
 * Fila del panel del supervisor para traer de Handy el catálogo y los
 * vendedores. Dice cuándo fue la última vez (en color de aviso si pasaron más
 * de 3 días o nunca se hizo) y, al terminar, abre una hoja con lo que cambió
 * en palabras. Si quedaron productos sin empaque confirmado, lleva de la mano
 * a confirmarlos: traer productos nuevos casi siempre deja ese pendiente.
 *
 * Va dentro de un `GrupoMenu`. El servidor la corre sola a las 5:00; esta fila
 * es para forzarla (productos nuevos, una foto, un vendedor dado de alta).
 */
export function AccesoSincronizacion() {
  const estado = useEstadoSincronizacion(true);
  const sincronizar = useSincronizarConHandy();
  const [hojaAbierta, setHojaAbierta] = useState(false);
  // TanStack limpia `error` al reintentar: mientras corre, la hoja sigue diciendo qué falló.
  const [ultimoFallo, setUltimoFallo] = useState<unknown>(null);

  const ultima = estado.data ? textoUltimaSincronizacion(estado.data.ultimaSincronizacion, new Date()) : null;

  const correr = () => {
    sincronizar.mutate(undefined, {
      onSuccess: () => setUltimoFallo(null),
      onError: (error) => setUltimoFallo(error),
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
        {hojaAbierta && <Contenido sincronizar={sincronizar} fallo={ultimoFallo} onReintentar={correr} onConfirmarAhora={confirmarAhora} />}
      </Hoja>
    </>
  );
}

function Contenido({
  sincronizar,
  fallo: error,
  onReintentar,
  onConfirmarAhora,
}: {
  sincronizar: ReturnType<typeof useSincronizarConHandy>;
  fallo: unknown;
  onReintentar: () => void;
  onConfirmarAhora: () => void;
}) {
  // Reintentando desde la hoja: el mismo bloque del fallo, con su indicador.
  if (error) {
    const fallo = falloDe(error);
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
      {resumen.sinConfirmarEmpaque > 0 && (
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

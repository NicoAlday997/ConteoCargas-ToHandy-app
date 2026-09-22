import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';

import { ETIQUETAS_ROL } from '../src/api/auth';
import { cerrarSesion, obtenerUsuarioSesion, type UsuarioSesion } from '../src/api/sesion';
import { obtenerToken } from '../src/api/token';
import { COLORES, ESPACIADO, RADIOS, TIPOGRAFIA, TOQUE_MINIMO } from '../src/theme/tokens';

type EstadoSesion =
  | { tipo: 'verificando' }
  | { tipo: 'sin-sesion' }
  | { tipo: 'activa'; usuario: UsuarioSesion | null };

export default function PantallaInicio() {
  const [estado, setEstado] = useState<EstadoSesion>({ tipo: 'verificando' });

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const [token, usuario] = await Promise.all([obtenerToken(), obtenerUsuarioSesion()]);
      // Un PIN temporal sin cambiar no da acceso a la app (docs/06 §3.1).
      if (!token || usuario?.debeCambiarPin) {
        await cerrarSesion();
        if (vigente) setEstado({ tipo: 'sin-sesion' });
        return;
      }
      if (vigente) setEstado({ tipo: 'activa', usuario });
    })();
    return () => {
      vigente = false;
    };
  }, []);

  if (estado.tipo === 'verificando') {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator size="large" color={COLORES.texto} />
      </View>
    );
  }

  if (estado.tipo === 'sin-sesion') {
    return <Redirect href="/login" />;
  }

  const { usuario } = estado;
  const salir = () => {
    void cerrarSesion().then(() => router.replace('/login'));
  };

  // Pantalla temporal hasta que existan los inicios por rol (docs/06 §3.2-3.3).
  return (
    <SafeAreaView style={estilos.pantalla}>
      <View style={estilos.centrado}>
        <Text style={estilos.saludo}>Sesión iniciada</Text>
        <Text style={estilos.nombre}>{usuario?.nombreCompleto ?? 'Usuario'}</Text>
        {usuario?.rolApp && <Text style={estilos.rol}>{ETIQUETAS_ROL[usuario.rolApp]}</Text>}
        <Pressable
          onPress={salir}
          accessibilityRole="button"
          style={({ pressed }) => [estilos.boton, pressed && estilos.botonPresionado]}
        >
          <Text style={estilos.textoBoton}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  centrado: {
    flex: 1,
    backgroundColor: COLORES.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ESPACIADO.lg,
    gap: ESPACIADO.sm,
  },
  saludo: {
    fontSize: TIPOGRAFIA.tamanos.base,
    color: COLORES.textoSecundario,
  },
  nombre: {
    fontSize: TIPOGRAFIA.tamanos.xxl,
    fontWeight: TIPOGRAFIA.pesos.negrita,
    color: COLORES.texto,
    textAlign: 'center',
  },
  rol: {
    fontSize: TIPOGRAFIA.tamanos.base,
    fontWeight: TIPOGRAFIA.pesos.medio,
    color: COLORES.textoSecundario,
  },
  boton: {
    minHeight: TOQUE_MINIMO,
    minWidth: 220,
    marginTop: ESPACIADO.xl,
    paddingHorizontal: ESPACIADO.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORES.texto,
    borderRadius: RADIOS.md,
  },
  botonPresionado: {
    backgroundColor: COLORES.superficie,
  },
  textoBoton: {
    fontSize: TIPOGRAFIA.tamanos.lg,
    fontWeight: TIPOGRAFIA.pesos.semiNegrita,
    color: COLORES.texto,
  },
});

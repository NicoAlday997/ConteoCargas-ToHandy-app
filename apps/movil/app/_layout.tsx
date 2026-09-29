import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';

import { FUENTE } from '../src/theme/tokens';

// El catálogo de productos cambia poco: cuidar los datos móviles del contador.
const STALE_TIME_CATALOGO_MS = 1000 * 60 * 5;

// La splash no se oculta hasta tener las fuentes: nada se dibuja con la
// fuente del sistema para saltar después a Manrope.
void SplashScreen.preventAutoHideAsync();

export default function LayoutRaiz() {
  // Las claves son los nombres de FUENTE: la tipografía se cambia solo allí.
  const [fuentesListas, errorFuentes] = useFonts({
    [FUENTE.regular]: Manrope_400Regular,
    [FUENTE.medio]: Manrope_500Medium,
    [FUENTE.semiNegrita]: Manrope_600SemiBold,
    [FUENTE.negrita]: Manrope_700Bold,
    [FUENTE.extraNegrita]: Manrope_800ExtraBold,
  });
  // Si fallan, se sigue con la del sistema: mejor eso que una splash eterna.
  const listo = fuentesListas || errorFuentes !== null;

  const [clienteConsultas] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME_CATALOGO_MS,
          },
        },
      }),
  );

  useEffect(() => {
    if (listo) void SplashScreen.hideAsync();
  }, [listo]);

  if (!listo) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={clienteConsultas}>
          {/* Sin encabezado nativo: mostraba el nombre del archivo y cada pantalla trae el suyo. */}
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

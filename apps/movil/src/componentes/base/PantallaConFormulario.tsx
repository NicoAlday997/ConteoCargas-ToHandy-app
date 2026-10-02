import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ESPACIADO } from '../../theme/tokens';

/**
 * Cómo se aparta del teclado todo lo que tiene un campo (esta pantalla y la
 * `Hoja`): con relleno abajo del alto que tapa el teclado, en las dos
 * plataformas.
 *
 * En Android no basta con que la ventana se encoja (`softwareKeyboardLayoutMode:
 * "resize"`): la app apunta a SDK 36 y React Native 0.86 dibuja de borde a
 * borde, y de borde a borde Android 15+ ya no encoge la ventana al abrir el
 * teclado; solo informa cuánto tapa. El relleno se calcula con lo que de verdad
 * se encima, así que donde la ventana sí se encoge (Android 14 o anterior)
 * sale en cero y no se suma dos veces.
 */
export const COMPORTAMIENTO_TECLADO = 'padding' as const;

/** Aire entre el campo enfocado y el borde de lo visible (el teclado o el borde de arriba). */
const MARGEN_FOCO = ESPACIADO.xl;
/** Con el teclado abierto, debajo del último control: nunca queda pegado al teclado. */
const RELLENO_TECLADO = ESPACIADO.xl;
/** Si el teclado ya estaba abierto (se pasó de un campo a otro) no llega `keyboardDidShow`. */
const ESPERA_SIN_EVENTO_MS = 350;

type Medible = Pick<View, 'measureLayout' | 'measureInWindow'>;

/** Lo usa `CampoTexto`: al recibir el foco, pide que lo desplacen a la vista. */
const ContextoFormulario = createContext<((campo: Medible) => void) | null>(
  null,
);

export function useMostrarCampo() {
  return useContext(ContextoFormulario);
}

/** Si el teclado está abierto: con él abierto se agrega `RELLENO_TECLADO`. */
function useTecladoVisible() {
  const [visible, setVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const mostrar = Keyboard.addListener('keyboardDidShow', () =>
      setVisible(true),
    );
    const ocultar = Keyboard.addListener('keyboardDidHide', () =>
      setVisible(false),
    );
    return () => {
      mostrar.remove();
      ocultar.remove();
    };
  }, []);
  return visible;
}

/**
 * Cuánto hay arriba de esta vista en la pantalla (el encabezado, el área
 * segura): `KeyboardAvoidingView` compara su borde de abajo con el teclado
 * usando su posición dentro del padre, no en la pantalla, y este desfase es lo
 * que le falta. Se mide en vez de fijar la altura del encabezado, que cambia
 * con el tamaño de letra y con las notas que lleva.
 */
function useDesfaseEnPantalla() {
  const marco = useRef<View>(null);
  const [desfase, setDesfase] = useState(0);
  const medir = useCallback(() => {
    marco.current?.measureInWindow((_x, y) => {
      if (Number.isFinite(y)) setDesfase(Math.max(0, y));
    });
  }, []);
  return { marco, desfase, medir };
}

/**
 * Dónde empieza el teclado en la pantalla (`screenY`, lo mismo que compara
 * `KeyboardAvoidingView`); `null` con el teclado cerrado. Junto con el desfase
 * de arriba da cuánto tapa el teclado de una vista: su borde de abajo en la
 * pantalla menos este tope.
 */
function useTopeTeclado() {
  const [tope, setTope] = useState<number | null>(null);
  useEffect(() => {
    const mostrar = Keyboard.addListener(
      'keyboardDidShow',
      (e: KeyboardEvent) => setTope(e.endCoordinates.screenY),
    );
    const ocultar = Keyboard.addListener('keyboardDidHide', () =>
      setTope(null),
    );
    return () => {
      mostrar.remove();
      ocultar.remove();
    };
  }, []);
  return tope;
}

/**
 * Lo que recibe `CampoTexto` al enfocarse: espera a que el teclado llegue (y
 * a que el relleno ya se haya aplicado) y entonces llama a `llevarALaVista`.
 * Si el teclado ya estaba abierto (de un campo a otro) no hay evento, y basta
 * un momento.
 */
function useMostrarCampoTrasTeclado(llevarALaVista: (campo: Medible) => void) {
  return useCallback(
    (campo: Medible) => {
      let hecho = false;
      let sub: { remove: () => void } | null = null;
      let reserva: ReturnType<typeof setTimeout> | null = null;
      const medirAhora = () => {
        if (hecho) return;
        hecho = true;
        sub?.remove();
        if (reserva !== null) clearTimeout(reserva);
        // Un cuadro más: el relleno del teclado se aplica en el mismo evento.
        requestAnimationFrame(() => llevarALaVista(campo));
      };
      sub = Keyboard.addListener('keyboardDidShow', medirAhora);
      reserva = setTimeout(
        medirAhora,
        Keyboard.isVisible() ? 0 : ESPERA_SIN_EVENTO_MS,
      );
    },
    [llevarALaVista],
  );
}

interface Props {
  children: ReactNode;
  /**
   * Los botones del formulario. Van al final del contenido, dentro de lo que
   * se desplaza: con el contenido corto quedan abajo como siempre, y con el
   * teclado abierto suben con el contenido en vez de montarse sobre el campo.
   */
  pie?: ReactNode;
  /**
   * Apartarse del teclado aquí mismo. `false` cuando quien la contiene ya lo
   * hace (la `Hoja` sube entera).
   */
  evitarTeclado?: boolean;
  /** El marco: tamaño y lugar (flex, alto máximo). */
  style?: StyleProp<ViewStyle>;
  /** Alrededor del contenido, sin el pie: márgenes, separación, ancho máximo. */
  estiloContenido?: StyleProp<ViewStyle>;
  /** Alrededor del pie. */
  estiloPie?: StyleProp<ViewStyle>;
  /** Desactiva el rebote de iOS (la hoja no rebota). */
  sinRebote?: boolean;
}

/**
 * Toda pantalla u hoja con un campo de texto y botones. Resuelve el teclado
 * una vez para todas:
 * - Se aparta del teclado (`COMPORTAMIENTO_TECLADO`), medido desde donde está.
 * - Campo y botones en la misma vista desplazable: nada fijo abajo que el
 *   teclado empuje sobre el campo.
 * - Deslizar no cierra el teclado, y el primer toque en un botón con el
 *   teclado abierto llega al botón (no se lo come el cierre del teclado).
 * - El campo que recibe el foco se desplaza a la vista (lo pide `CampoTexto`).
 */
export function PantallaConFormulario({
  children,
  pie,
  evitarTeclado = true,
  style,
  estiloContenido,
  estiloPie,
  sinRebote = false,
}: Props) {
  const desplazable = useRef<ScrollView>(null);
  const contenido = useRef<View>(null);
  const posicion = useRef(0);
  const altoVisible = useRef(0);
  const tecladoVisible = useTecladoVisible();
  const { marco, desfase, medir } = useDesfaseEnPantalla();

  const llevarALaVista = useCallback((campo: Medible) => {
    const lienzo = contenido.current;
    if (!lienzo) return;
    campo.measureLayout(
      lienzo,
      (_x, y, _ancho, alto) => {
        const arriba = Math.max(0, y - MARGEN_FOCO);
        const abajo = y + alto + MARGEN_FOCO;
        const desde = posicion.current;
        const hasta = desde + altoVisible.current;
        // Si no cabe completo, manda que se vea el principio (donde está el cursor al entrar).
        if (abajo > hasta)
          desplazable.current?.scrollTo({
            y: Math.min(arriba, abajo - altoVisible.current),
            animated: true,
          });
        else if (arriba < desde)
          desplazable.current?.scrollTo({ y: arriba, animated: true });
      },
      () => {},
    );
  }, []);

  // Se mide cuando el teclado ya llegó y la vista ya se encogió.
  const mostrarCampo = useMostrarCampoTrasTeclado(llevarALaVista);

  const alDesplazar = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    posicion.current = e.nativeEvent.contentOffset.y;
  };
  const alMedir = (e: LayoutChangeEvent) => {
    altoVisible.current = e.nativeEvent.layout.height;
  };

  const vista = (
    <ScrollView
      ref={desplazable}
      style={evitarTeclado ? estilos.llenar : style}
      contentContainerStyle={estilos.lienzo}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
      // Sin `automaticallyAdjustKeyboardInsets`: iOS calcula ese margen con el
      // marco de antes de que el relleno de arriba encoja la vista, y el teclado
      // se descontaría dos veces (un hueco del alto del teclado al final).
      automaticallyAdjustKeyboardInsets={false}
      bounces={!sinRebote}
      onScroll={alDesplazar}
      scrollEventThrottle={32}
      onLayout={alMedir}
    >
      <View
        ref={contenido}
        style={[estilos.columna, tecladoVisible && estilos.conTeclado]}
      >
        <View style={estiloContenido}>{children}</View>
        {pie ? <View style={[estilos.pie, estiloPie]}>{pie}</View> : null}
      </View>
    </ScrollView>
  );

  return (
    <ContextoFormulario.Provider value={mostrarCampo}>
      {evitarTeclado ? (
        <View ref={marco} style={[estilos.llenar, style]} onLayout={medir}>
          <KeyboardAvoidingView
            style={estilos.llenar}
            behavior={COMPORTAMIENTO_TECLADO}
            keyboardVerticalOffset={desfase}
          >
            {vista}
          </KeyboardAvoidingView>
        </View>
      ) : (
        vista
      )}
    </ContextoFormulario.Provider>
  );
}

/**
 * Lo mismo que `PantallaConFormulario`, para una lista larga (FlatList o
 * SectionList) con campos dentro y una barra de acciones fija abajo que NO
 * debe moverse. En vez de encoger la vista, la lista crece su relleno de abajo
 * en lo que el teclado le tapa mientras está abierto (así hasta el último
 * renglón se alcanza sin tocar la barra), y el campo que recibe el foco se
 * desplaza arriba del teclado. Misma medición que la pantalla: el desfase en
 * pantalla y el tope del teclado, como `KeyboardAvoidingView`.
 *
 * Uso: `propsMarco` en una `View` con `flex: 1` que envuelve la lista,
 * `propsLista` y `rellenoInferior` en la lista, y `Proveedor` alrededor para
 * que `CampoTexto` pida que lo muestren.
 */
export function useListaConFormulario(desplazarA: (y: number) => void) {
  const { marco, desfase, medir } = useDesfaseEnPantalla();
  const [alto, setAlto] = useState(0);
  const tope = useTopeTeclado();
  const posicion = useRef(0);
  // El campo se mide fuera del render: lee lo último por referencia.
  const medidas = useRef({ desfase, alto, tope });
  useEffect(() => {
    medidas.current = { desfase, alto, tope };
  }, [desfase, alto, tope]);

  const tapado = tope === null ? 0 : Math.max(0, desfase + alto - tope);

  const llevarALaVista = useCallback(
    (campo: Medible) => {
      campo.measureInWindow((_x, y, _ancho, altoCampo) => {
        if (!Number.isFinite(y)) return;
        const m = medidas.current;
        const bordeLista = m.desfase + m.alto;
        const visibleArriba = m.desfase + MARGEN_FOCO;
        const visibleAbajo =
          Math.min(bordeLista, m.tope ?? bordeLista) - MARGEN_FOCO;
        const abajo = y + altoCampo;
        // Si no cabe completo, manda que se vea el principio (donde está el cursor al entrar).
        if (abajo > visibleAbajo)
          desplazarA(
            posicion.current +
              Math.min(abajo - visibleAbajo, y - visibleArriba),
          );
        else if (y < visibleArriba)
          desplazarA(Math.max(0, posicion.current - (visibleArriba - y)));
      });
    },
    [desplazarA],
  );
  const mostrarCampo = useMostrarCampoTrasTeclado(llevarALaVista);

  return {
    Proveedor: ContextoFormulario.Provider,
    mostrarCampo,
    /** Súmalo al `paddingBottom` del contenido de la lista. */
    rellenoInferior: tapado > 0 ? tapado + RELLENO_TECLADO : 0,
    propsMarco: {
      ref: marco,
      onLayout: (e: LayoutChangeEvent) => {
        setAlto(e.nativeEvent.layout.height);
        medir();
      },
    },
    propsLista: {
      onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        posicion.current = e.nativeEvent.contentOffset.y;
      },
      scrollEventThrottle: 32,
      keyboardShouldPersistTaps: 'handled' as const,
      keyboardDismissMode: 'none' as const,
      // El relleno ya descuenta el teclado: iOS no debe sumarlo otra vez.
      automaticallyAdjustKeyboardInsets: false,
    },
  };
}

const estilos = StyleSheet.create({
  llenar: {
    flex: 1,
  },
  // Con el contenido corto, el lienzo llena la vista y el pie baja hasta el fondo.
  lienzo: {
    flexGrow: 1,
  },
  columna: {
    flexGrow: 1,
  },
  conTeclado: {
    paddingBottom: RELLENO_TECLADO,
  },
  pie: {
    marginTop: 'auto',
  },
});

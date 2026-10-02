import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { EstadoCargaApi } from '../api/historial';
import { ErrorRed } from '../api/cliente';
import { useOpcionesFiltroHistorial } from '../api/hooks-historial';
import {
  AccionesHoja,
  BloqueError,
  BloqueEsqueleto,
  Boton,
  Chevron,
  Esqueleto,
  Hoja,
  Palomita,
  Pulsable,
} from '../componentes/base';
import {
  DIAS_CABECERA,
  mesDe,
  moverMes,
  semanasDelMes,
  tituloMes,
  type Mes,
} from '../calendario/modelo-calendario';
import { diaNegocio, formatearDia } from '../conteo/fecha-operativa';
import {
  BORDES,
  CIFRAS,
  COLORES,
  ESCALA_PRESIONADO,
  ESPACIADO,
  FUENTE,
  OPACIDAD,
  RADIOS,
  RITMO,
  SOMBRAS,
  TIPOGRAFIA,
  TOQUE_MINIMO,
} from '../theme/tokens';
import {
  atajosFechas,
  cerrarRango,
  cuantosFiltros,
  dentroDeRango,
  diaMinimo,
  etiquetaEstado,
  etiquetaRuta,
  etiquetaVendedor,
  quitarFiltro,
  textoFechas,
  textoTotal,
  tocarDia,
  FILTROS_VACIOS,
  type ClaveFiltro,
  type FiltrosHistorial,
  type Rango,
} from './filtros-historial';
import { ESTADOS_CARGA } from './modelo-historial';

/**
 * Fila de filtros del historial: chips en una línea que se desliza, no un
 * formulario. Un chip sin valor dice qué filtra ("Ruta"); con valor, lo dice
 * ("Ruta 3") en azul y trae su × para quitarlo de un toque. Debajo, cuántas
 * cargas hay con lo puesto.
 *
 * Vendedor y ruta solo para contador y supervisor: el vendedor solo ve lo suyo.
 */

/** Visualmente ligeros; el área de toque llega al mínimo de la app con `hitSlop`. */
const ALTO_CHIP = 40;
const HOLGURA_CHIP = (TOQUE_MINIMO - ALTO_CHIP) / 2;

const ESTADOS = Object.keys(ESTADOS_CARGA) as EstadoCargaApi[];

export function BarraFiltros({
  rol,
  filtros,
  onCambiar,
  total,
}: {
  rol: string | null;
  filtros: FiltrosHistorial;
  onCambiar: (filtros: FiltrosHistorial) => void;
  /** `null` mientras llega la primera página. */
  total: number | null;
}) {
  const [abierta, setAbierta] = useState<ClaveFiltro | null>(null);
  const porPersona = rol === 'CONTADOR' || rol === 'SUPERVISOR';
  const puestos = cuantosFiltros(filtros);
  const cerrar = () => setAbierta(null);
  const aplicar = (nuevos: FiltrosHistorial) => {
    onCambiar(nuevos);
    setAbierta(null);
  };

  const chips: {
    clave: ClaveFiltro;
    rotulo: string;
    valor: string | null;
  }[] = [
    ...(porPersona
      ? [
          {
            clave: 'vendedor' as const,
            rotulo: 'Vendedor',
            valor: filtros.vendedor ? etiquetaVendedor(filtros.vendedor) : null,
          },
          {
            clave: 'ruta' as const,
            rotulo: 'Ruta',
            valor: filtros.ruta ? etiquetaRuta(filtros.ruta) : null,
          },
        ]
      : []),
    {
      clave: 'fechas',
      rotulo: 'Fechas',
      valor: textoFechas(filtros.desde, filtros.hasta),
    },
    {
      clave: 'estado',
      rotulo: 'Estado',
      valor: filtros.estado ? etiquetaEstado(filtros.estado) : null,
    },
  ];

  return (
    <View style={estilos.barra}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.chips}
        keyboardShouldPersistTaps="handled"
      >
        {chips.map((c) => (
          <Chip
            key={c.clave}
            rotulo={c.rotulo}
            valor={c.valor}
            onAbrir={() => setAbierta(c.clave)}
            onQuitar={() => onCambiar(quitarFiltro(filtros, c.clave))}
          />
        ))}
      </ScrollView>
      <View style={estilos.resumen}>
        <Text
          style={estilos.total}
          accessibilityLiveRegion="polite"
          accessibilityRole="text"
        >
          {total === null
            ? ' '
            : puestos > 0
              ? `${textoTotal(total)} con ${puestos === 1 ? 'este filtro' : 'estos filtros'}`
              : textoTotal(total)}
        </Text>
        {puestos > 1 && (
          <Pulsable
            onPress={() => onCambiar(FILTROS_VACIOS)}
            hitSlop={HOLGURA_CHIP}
            accessibilityRole="button"
            accessibilityLabel="Quitar todos los filtros"
            style={({ pressed }) => [
              estilos.limpiar,
              pressed && estilos.limpiarPresionado,
            ]}
          >
            <Text style={estilos.textoLimpiar}>Quitar todos</Text>
          </Pulsable>
        )}
      </View>

      {porPersona && (
        <HojaPersonas
          abierta={abierta}
          filtros={filtros}
          onCerrar={cerrar}
          onAplicar={aplicar}
        />
      )}
      <HojaFechas
        // Se monta de nuevo al abrir: cada vez arranca con lo que está aplicado.
        key={abierta === 'fechas' ? 'abierta' : 'cerrada'}
        visible={abierta === 'fechas'}
        rol={rol}
        filtros={filtros}
        onCerrar={cerrar}
        onAplicar={aplicar}
      />
      <Hoja
        visible={abierta === 'estado'}
        onCerrar={cerrar}
        cerrarAlTocarFondo
        titulo="Estado de la carga"
      >
        <ListaOpciones
          opciones={ESTADOS.map((e) => ({ id: e, texto: etiquetaEstado(e) }))}
          elegida={filtros.estado}
          onElegir={(id) =>
            aplicar({ ...filtros, estado: id as EstadoCargaApi })
          }
        />
      </Hoja>
    </View>
  );
}

function Chip({
  rotulo,
  valor,
  onAbrir,
  onQuitar,
}: {
  rotulo: string;
  valor: string | null;
  onAbrir: () => void;
  onQuitar: () => void;
}) {
  const puesto = valor !== null;
  return (
    <View style={[estilos.chip, puesto && estilos.chipPuesto]}>
      <Pulsable
        onPress={onAbrir}
        tacto="seleccion"
        hitSlop={{ top: HOLGURA_CHIP, bottom: HOLGURA_CHIP }}
        accessibilityRole="button"
        accessibilityLabel={
          puesto
            ? `${rotulo}: ${valor}. Cambiar`
            : `Filtrar por ${rotulo.toLowerCase()}`
        }
        style={({ pressed }) => [
          estilos.cuerpoChip,
          puesto && estilos.cuerpoChipPuesto,
          pressed && estilos.chipPresionado,
        ]}
      >
        <Text
          style={[estilos.textoChip, puesto && estilos.textoChipPuesto]}
          numberOfLines={1}
        >
          {valor ?? rotulo}
        </Text>
        {!puesto && <FlechaAbajo />}
      </Pulsable>
      {puesto && (
        <Pulsable
          onPress={onQuitar}
          hitSlop={{
            top: HOLGURA_CHIP,
            bottom: HOLGURA_CHIP,
            right: ESPACIADO.xs,
          }}
          accessibilityRole="button"
          accessibilityLabel={`Quitar filtro de ${rotulo.toLowerCase()}`}
          style={({ pressed }) => [
            estilos.quitarChip,
            pressed && estilos.chipPresionado,
          ]}
        >
          <Equis />
        </Pulsable>
      )}
    </View>
  );
}

function FlechaAbajo() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9l6 6 6-6"
        stroke={COLORES.textoSecundario}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Equis() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 7l10 10M17 7L7 17"
        stroke={COLORES.textoSobreColor}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Vendedor y ruta
// ---------------------------------------------------------------------------

function HojaPersonas({
  abierta,
  filtros,
  onCerrar,
  onAplicar,
}: {
  abierta: ClaveFiltro | null;
  filtros: FiltrosHistorial;
  onCerrar: () => void;
  onAplicar: (filtros: FiltrosHistorial) => void;
}) {
  const visible = abierta === 'vendedor' || abierta === 'ruta';
  // Se pide al abrir la primera vez; luego queda en caché unos minutos.
  const opciones = useOpcionesFiltroHistorial(visible);
  const esVendedor = abierta === 'vendedor';

  let contenido;
  if (opciones.isPending) {
    contenido = (
      <Esqueleto etiqueta="Cargando opciones" style={estilos.opciones}>
        {[0, 1, 2, 3].map((i) => (
          <BloqueEsqueleto key={i} alto={TOQUE_MINIMO} />
        ))}
      </Esqueleto>
    );
  } else if (opciones.isError) {
    const sinRed = opciones.error instanceof ErrorRed;
    contenido = (
      <BloqueError
        titulo={sinRed ? 'Sin conexión' : 'No se pudo cargar la lista'}
        detalle={
          sinRed
            ? 'Para ver la lista necesitas señal: revísala y vuelve a intentarlo.'
            : 'Intenta de nuevo en un momento.'
        }
        tono={sinRed ? 'atencion' : 'error'}
        onReintentar={() => void opciones.refetch()}
        reintentando={opciones.isFetching}
      />
    );
  } else if (esVendedor) {
    const { vendedores } = opciones.data;
    contenido = (
      <ListaOpciones
        opciones={vendedores.map((v) => ({
          id: v.id,
          texto: v.nombre,
          nota: v.activo ? null : 'inactivo',
        }))}
        elegida={filtros.vendedor?.id ?? null}
        vacio="Todavía no hay vendedores."
        onElegir={(id) =>
          onAplicar({
            ...filtros,
            vendedor: vendedores.find((v) => v.id === id) ?? null,
          })
        }
      />
    );
  } else {
    const { rutas } = opciones.data;
    contenido = (
      <ListaOpciones
        opciones={rutas.map((r) => ({
          id: r.id,
          texto: r.nombre,
          nota: r.activa ? null : 'inactiva',
        }))}
        elegida={filtros.ruta?.id ?? null}
        vacio="Todavía no hay rutas."
        onElegir={(id) =>
          onAplicar({
            ...filtros,
            ruta: rutas.find((r) => r.id === id) ?? null,
          })
        }
      />
    );
  }

  return (
    <Hoja
      visible={visible}
      onCerrar={onCerrar}
      cerrarAlTocarFondo
      titulo={esVendedor ? 'Cargas de qué vendedor' : 'Cargas de qué ruta'}
      detalle={esVendedor ? 'También están quienes ya no trabajan aquí.' : null}
    >
      {contenido}
    </Hoja>
  );
}

interface Opcion {
  id: string;
  texto: string;
  /** "inactivo": se distingue, no se esconde. */
  nota?: string | null;
}

/** Elegir uno de una lista: tocar lo elige y cierra. El elegido lleva palomita. */
function ListaOpciones({
  opciones,
  elegida,
  vacio,
  onElegir,
}: {
  opciones: Opcion[];
  elegida: string | null;
  vacio?: string;
  onElegir: (id: string) => void;
}) {
  if (opciones.length === 0)
    return <Text style={estilos.textoVacio}>{vacio}</Text>;
  return (
    <View style={estilos.opciones}>
      {opciones.map((o) => {
        const esElegida = o.id === elegida;
        return (
          <Pulsable
            key={o.id}
            onPress={() => onElegir(o.id)}
            tacto="seleccion"
            accessibilityRole="button"
            accessibilityLabel={`${o.texto}${o.nota ? `, ${o.nota}` : ''}`}
            accessibilityState={{ selected: esElegida }}
            style={({ pressed }) => [
              estilos.opcion,
              esElegida && estilos.opcionElegida,
              pressed && estilos.opcionPresionada,
            ]}
          >
            <Text style={estilos.textoOpcion} numberOfLines={2}>
              {o.texto}
              {o.nota && <Text style={estilos.notaOpcion}> · {o.nota}</Text>}
            </Text>
            {esElegida && <Palomita color={COLORES.accion} />}
          </Pulsable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

function HojaFechas({
  visible,
  rol,
  filtros,
  onCerrar,
  onAplicar,
}: {
  visible: boolean;
  rol: string | null;
  filtros: FiltrosHistorial;
  onCerrar: () => void;
  onAplicar: (filtros: FiltrosHistorial) => void;
}) {
  const hoy = diaNegocio(new Date());
  const minimo = diaMinimo(rol, hoy);
  const [rango, setRango] = useState<Rango>({
    desde: filtros.desde,
    hasta: filtros.hasta,
  });
  const [mes, setMes] = useState<Mes>(() =>
    mesDe(filtros.hasta ?? filtros.desde ?? hoy),
  );
  const ultimoMes = moverMes(mesDe(hoy), 1);
  const primerMes = minimo ? mesDe(minimo) : null;
  const igual = (a: Mes, b: Mes) => a.anio === b.anio && a.mes === b.mes;
  const hayFechas = filtros.desde !== null || filtros.hasta !== null;

  const aplicar = (r: Rango) => {
    const cerrado = cerrarRango(r);
    onAplicar({ ...filtros, desde: cerrado.desde, hasta: cerrado.hasta });
  };

  const resumen =
    rango.desde && !rango.hasta
      ? `Desde ${formatearDia(rango.desde)}. Toca el último día, o aplica solo este.`
      : rango.desde && rango.hasta
        ? textoFechas(rango.desde, rango.hasta)
        : 'Toca el primer día y luego el último.';

  return (
    <Hoja
      visible={visible}
      onCerrar={onCerrar}
      titulo="Fechas de salida"
      pie={
        <AccionesHoja>
          <Boton
            texto={hayFechas ? 'Quitar fechas' : 'Cancelar'}
            variante="secundario"
            onPress={() =>
              hayFechas
                ? onAplicar({ ...filtros, desde: null, hasta: null })
                : onCerrar()
            }
          />
          <Boton
            texto="Aplicar"
            deshabilitado={rango.desde === null}
            onPress={() => aplicar(rango)}
          />
        </AccionesHoja>
      }
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.chips}
      >
        {atajosFechas(rol, hoy).map((a) => (
          <Pulsable
            key={a.etiqueta}
            onPress={() => aplicar({ desde: a.desde, hasta: a.hasta })}
            tacto="seleccion"
            hitSlop={{ top: HOLGURA_CHIP, bottom: HOLGURA_CHIP }}
            accessibilityRole="button"
            style={({ pressed }) => [
              estilos.chip,
              estilos.cuerpoChip,
              pressed && estilos.chipPresionado,
            ]}
          >
            <Text style={estilos.textoChip}>{a.etiqueta}</Text>
          </Pulsable>
        ))}
      </ScrollView>

      <View style={estilos.cabeceraMes}>
        <BotonMes
          direccion="izquierda"
          etiqueta="Mes anterior"
          deshabilitado={primerMes !== null && igual(mes, primerMes)}
          onPress={() => setMes(moverMes(mes, -1))}
        />
        <Text style={estilos.tituloMes}>{tituloMes(mes)}</Text>
        <BotonMes
          direccion="derecha"
          etiqueta="Mes siguiente"
          deshabilitado={igual(mes, ultimoMes)}
          onPress={() => setMes(moverMes(mes, 1))}
        />
      </View>
      <View style={estilos.semana}>
        {DIAS_CABECERA.map((d, i) => (
          <Text key={i} style={estilos.cabeceraDia}>
            {d}
          </Text>
        ))}
      </View>
      <View style={estilos.mes}>
        {semanasDelMes(mes).map((semana, i) => (
          <View key={i} style={estilos.semana}>
            {semana.map((celda, j) => {
              if (!celda) return <View key={j} style={estilos.celda} />;
              const inhabil = minimo !== null && celda.dia < minimo;
              const extremo =
                celda.dia === rango.desde || celda.dia === rango.hasta;
              const enRango = dentroDeRango(rango, celda.dia);
              const esHoy = celda.dia === hoy;
              return (
                <Pulsable
                  key={j}
                  onPress={() => setRango(tocarDia(rango, celda.dia))}
                  disabled={inhabil}
                  tacto="seleccion"
                  accessibilityRole="button"
                  accessibilityLabel={`${formatearDia(celda.dia)}${esHoy ? ', hoy' : ''}`}
                  accessibilityState={{ disabled: inhabil, selected: enRango }}
                  style={({ pressed }) => [
                    estilos.celda,
                    esHoy && estilos.celdaHoy,
                    enRango && estilos.celdaEnRango,
                    pressed && estilos.celdaPresionada,
                    extremo && estilos.celdaExtremo,
                    inhabil && estilos.celdaInhabil,
                  ]}
                >
                  <Text
                    style={[
                      estilos.numeroDia,
                      extremo && estilos.numeroExtremo,
                    ]}
                  >
                    {celda.numero}
                  </Text>
                </Pulsable>
              );
            })}
          </View>
        ))}
      </View>
      <Text style={estilos.resumenFechas}>{resumen}</Text>
      {minimo && (
        <Text style={estilos.notaFechas}>
          Puedes ver las cargas de las últimas 2 semanas.
        </Text>
      )}
    </Hoja>
  );
}

function BotonMes({
  direccion,
  etiqueta,
  deshabilitado = false,
  onPress,
}: {
  direccion: 'izquierda' | 'derecha';
  etiqueta: string;
  deshabilitado?: boolean;
  onPress: () => void;
}) {
  return (
    <Pulsable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      style={({ pressed }) => [
        estilos.botonMes,
        pressed && estilos.limpiarPresionado,
        deshabilitado && estilos.celdaInhabil,
      ]}
    >
      <Chevron
        direccion={direccion}
        color={COLORES.texto}
        tamano={ESPACIADO.xxl}
      />
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  barra: {
    gap: ESPACIADO.xs,
    paddingTop: ESPACIADO.md,
  },
  chips: {
    gap: ESPACIADO.sm,
    paddingHorizontal: RITMO.margen,
  },
  chip: {
    height: ALTO_CHIP,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIOS.completo,
    borderWidth: BORDES.fino,
    borderColor: COLORES.contornoTarjeta,
    backgroundColor: COLORES.superficie,
    overflow: 'hidden',
  },
  // Puesto: el único color en la fila; se ve de un golpe qué filtra.
  chipPuesto: {
    borderColor: COLORES.accion,
    backgroundColor: COLORES.accion,
  },
  cuerpoChip: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIADO.xs,
    paddingLeft: ESPACIADO.lg,
    paddingRight: ESPACIADO.md,
  },
  cuerpoChipPuesto: {
    paddingRight: ESPACIADO.xs,
    maxWidth: 240,
  },
  chipPresionado: {
    opacity: 0.8,
    transform: [{ scale: ESCALA_PRESIONADO }],
  },
  textoChip: {
    ...TIPOGRAFIA.etiqueta,
    flexShrink: 1,
    color: COLORES.texto,
  },
  textoChipPuesto: {
    color: COLORES.textoSobreColor,
  },
  quitarChip: {
    height: '100%',
    justifyContent: 'center',
    paddingLeft: ESPACIADO.xs,
    paddingRight: ESPACIADO.md,
  },
  resumen: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: RITMO.relacionado,
    paddingHorizontal: RITMO.margen,
  },
  total: {
    ...TIPOGRAFIA.micro,
    ...CIFRAS,
    flexShrink: 1,
    color: COLORES.textoSecundario,
  },
  limpiar: {
    paddingHorizontal: ESPACIADO.sm,
    paddingVertical: ESPACIADO.xs,
    borderRadius: RADIOS.chico,
  },
  limpiarPresionado: {
    backgroundColor: COLORES.marcaTinte,
  },
  textoLimpiar: {
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.accionHonda,
  },
  opciones: {
    gap: ESPACIADO.sm,
  },
  opcion: {
    minHeight: TOQUE_MINIMO,
    flexDirection: 'row',
    alignItems: 'center',
    gap: RITMO.relacionado,
    paddingHorizontal: ESPACIADO.lg,
    paddingVertical: ESPACIADO.sm,
    borderRadius: RADIOS.medio,
    borderWidth: BORDES.medio,
    borderColor: 'transparent',
    backgroundColor: COLORES.fondo,
  },
  opcionElegida: {
    borderColor: COLORES.accion,
    backgroundColor: COLORES.marcaTinte,
  },
  opcionPresionada: {
    backgroundColor: COLORES.marcaTinte,
    transform: [{ scale: ESCALA_PRESIONADO }],
  },
  textoOpcion: {
    flex: 1,
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  notaOpcion: {
    fontFamily: FUENTE.medio,
    color: COLORES.textoSecundario,
  },
  textoVacio: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.textoSecundario,
  },
  cabeceraMes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tituloMes: {
    ...TIPOGRAFIA.subtitulo,
    color: COLORES.texto,
  },
  botonMes: {
    width: TOQUE_MINIMO,
    height: TOQUE_MINIMO,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
    backgroundColor: COLORES.azulSuave,
  },
  mes: {
    gap: ESPACIADO.xs,
  },
  semana: {
    flexDirection: 'row',
    gap: ESPACIADO.xs,
  },
  cabeceraDia: {
    flex: 1,
    textAlign: 'center',
    ...TIPOGRAFIA.etiqueta,
    color: COLORES.textoSecundario,
  },
  celda: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIOS.completo,
    borderWidth: BORDES.medio,
    borderColor: 'transparent',
  },
  celdaHoy: {
    borderColor: COLORES.accion,
  },
  celdaEnRango: {
    backgroundColor: COLORES.marcaTinte,
  },
  celdaPresionada: {
    backgroundColor: COLORES.marcaTinte,
    transform: [{ scale: ESCALA_PRESIONADO }],
  },
  celdaExtremo: {
    backgroundColor: COLORES.accion,
    borderColor: COLORES.accion,
    boxShadow: SOMBRAS.accion,
  },
  celdaInhabil: {
    opacity: OPACIDAD.bloqueado,
  },
  numeroDia: {
    ...TIPOGRAFIA.subtitulo,
    ...CIFRAS,
    color: COLORES.texto,
  },
  numeroExtremo: {
    color: COLORES.textoSobreColor,
  },
  resumenFechas: {
    ...TIPOGRAFIA.cuerpo,
    color: COLORES.texto,
  },
  notaFechas: {
    ...TIPOGRAFIA.micro,
    color: COLORES.textoSecundario,
  },
});

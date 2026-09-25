import {
  agruparPorFamilia,
  claveNombre,
  normalizarCodigos,
  puedeDesactivar,
} from './politica-plantillas';

describe('puedeDesactivar', () => {
  it('rechaza PLANTILLA_EN_USO si hay rutas vigentes con la plantilla', () => {
    expect(puedeDesactivar(1)).toEqual({
      permitido: false,
      motivo: 'PLANTILLA_EN_USO',
    });
    expect(puedeDesactivar(5)).toEqual({
      permitido: false,
      motivo: 'PLANTILLA_EN_USO',
    });
  });

  it('permite desactivar una plantilla sin rutas vigentes', () => {
    expect(puedeDesactivar(0)).toEqual({ permitido: true });
  });
});

describe('normalizarCodigos', () => {
  it('recorta, descarta vacios y repetidos y conserva el orden', () => {
    expect(
      normalizarCodigos([' A1 ', 'B2', '', '  ', 'A1', 'C3', 'B2']),
    ).toEqual(['A1', 'B2', 'C3']);
  });

  it('sin codigos, lista vacia', () => {
    expect(normalizarCodigos([])).toEqual([]);
  });
});

describe('claveNombre', () => {
  it('ignora mayusculas, acentos y espacios repetidos', () => {
    expect(claveNombre('  Dulces  y ABARROTES ')).toBe(
      claveNombre('dulces y abarrotes'),
    );
    expect(claveNombre('Refrescos Jalapeño')).toBe(
      claveNombre('REFRESCOS JALAPENO'),
    );
  });

  it('nombres distintos siguen siendo distintos', () => {
    expect(claveNombre('Refrescos')).not.toBe(claveNombre('Refrescos 2'));
  });
});

describe('agruparPorFamilia', () => {
  const p = (code: string, nombre: string, familia: string | null) => ({
    code,
    nombre,
    familia,
  });

  it('familias en orden alfabetico, sin familia al final y nombres con orden numerico', () => {
    const grupos = agruparPorFamilia([
      p('1', 'BIG COLA 10L', 'REFRESCOS'),
      p('2', 'CHICLE', null),
      p('3', 'BIG COLA 2L', 'REFRESCOS'),
      p('4', 'AGUA 1 LT', 'AGUAS'),
    ]);

    expect(
      grupos.map((g) => [g.familia, g.productos.map((x) => x.nombre)]),
    ).toEqual([
      ['AGUAS', ['AGUA 1 LT']],
      ['REFRESCOS', ['BIG COLA 2L', 'BIG COLA 10L']],
      [null, ['CHICLE']],
    ]);
  });

  it('no modifica la lista recibida', () => {
    const productos = [p('2', 'B', 'X'), p('1', 'A', 'X')];
    agruparPorFamilia(productos);
    expect(productos.map((x) => x.code)).toEqual(['2', '1']);
  });
});

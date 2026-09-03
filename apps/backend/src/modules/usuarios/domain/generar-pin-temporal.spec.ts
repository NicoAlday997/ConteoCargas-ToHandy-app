import { generarPinTemporal, LONGITUD_PIN_TEMPORAL } from './generar-pin-temporal';

describe('generarPinTemporal', () => {
  it('siempre devuelve exactamente 4 digitos numericos', () => {
    for (let i = 0; i < 1000; i++) {
      const pin = generarPinTemporal();
      expect(pin).toMatch(/^\d{4}$/);
      expect(pin).toHaveLength(LONGITUD_PIN_TEMPORAL);
    }
  });

  it('no siempre devuelve el mismo valor', () => {
    const generados = new Set<string>();
    for (let i = 0; i < 200; i++) {
      generados.add(generarPinTemporal());
    }
    // Con 200 extracciones sobre un espacio de 10 000 valores, obtener un unico
    // resultado seria practicamente imposible: si pasa, la aleatoriedad esta rota.
    expect(generados.size).toBeGreaterThan(1);
  });
});

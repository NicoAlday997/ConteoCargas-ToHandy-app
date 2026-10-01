import {
  CRON_SINCRONIZACION_DIARIA,
  SincronizacionDiaria,
  sincronizacionAutomaticaEncendida,
} from './sincronizacion-diaria';

// No esta en el indice publico de @nestjs/schedule; es la llave que usa @Cron.
const SCHEDULE_CRON_OPTIONS = 'SCHEDULE_CRON_OPTIONS';

describe('SincronizacionDiaria', () => {
  // El servidor de Render corre en UTC: si el @Cron dependiera de la hora del
  // servidor, la sincronizacion correria a las 23:00 de la noche anterior.
  it('el @Cron de las 5:00 declara America/Mexico_City en sus opciones', () => {
    const opciones = Reflect.getMetadata(
      SCHEDULE_CRON_OPTIONS,
      SincronizacionDiaria.prototype.correr,
    ) as { cronTime: string; timeZone?: string };

    expect(opciones.cronTime).toBe('0 5 * * *');
    expect(opciones.cronTime).toBe(CRON_SINCRONIZACION_DIARIA);
    expect(opciones.timeZone).toBe('America/Mexico_City');
  });
});

describe('sincronizacionAutomaticaEncendida', () => {
  it('encendida si no se configura', () => {
    expect(sincronizacionAutomaticaEncendida(undefined)).toBe(true);
  });

  it.each(['false', '0', 'no', 'OFF '])('apagada con %p', (valor) => {
    expect(sincronizacionAutomaticaEncendida(valor)).toBe(false);
  });
});

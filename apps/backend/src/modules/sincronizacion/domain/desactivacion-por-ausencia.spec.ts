import { decidirDesactivacion } from './desactivacion-por-ausencia';

describe('decidirDesactivacion', () => {
  it('sin faltantes no hay nada que retener', () => {
    expect(
      decidirDesactivacion({
        recibidos: 0,
        totalReportado: 0,
        activos: 0,
        faltantes: 0,
      }),
    ).toEqual({ tipo: 'APLICAR' });
  });

  it('desactiva unos pocos faltantes de un recorrido completo', () => {
    expect(
      decidirDesactivacion({
        recibidos: 102,
        totalReportado: 102,
        activos: 104,
        faltantes: 2,
      }),
    ).toEqual({ tipo: 'APLICAR' });
  });

  it('retiene si Handy no devolvio ningun registro', () => {
    expect(
      decidirDesactivacion({
        recibidos: 0,
        totalReportado: 0,
        activos: 104,
        faltantes: 104,
      }),
    ).toEqual({ tipo: 'RETENER', motivo: 'SIN_REGISTROS' });
  });

  it('retiene si llegaron menos registros de los que Handy dijo tener', () => {
    expect(
      decidirDesactivacion({
        recibidos: 100,
        totalReportado: 104,
        activos: 104,
        faltantes: 4,
      }),
    ).toEqual({ tipo: 'RETENER', motivo: 'PAGINACION_INCOMPLETA' });
  });

  it('retiene si desactivaria mas del 30 % de lo activo', () => {
    expect(
      decidirDesactivacion({
        recibidos: 70,
        totalReportado: 70,
        activos: 100,
        faltantes: 31,
      }),
    ).toEqual({ tipo: 'RETENER', motivo: 'DEMASIADOS_FALTANTES' });
  });

  it('el 30 % exacto todavia se aplica', () => {
    expect(
      decidirDesactivacion({
        recibidos: 70,
        totalReportado: 70,
        activos: 100,
        faltantes: 30,
      }),
    ).toEqual({ tipo: 'APLICAR' });
  });
});

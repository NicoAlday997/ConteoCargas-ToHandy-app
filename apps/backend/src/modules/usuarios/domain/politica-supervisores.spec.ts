import { RolApp } from '@prisma/client';

import {
  puedeCambiarRol,
  puedeDesactivar,
  type UsuarioObjetivoPolitica,
} from './politica-supervisores';

function supervisor(
  parcial: Partial<UsuarioObjetivoPolitica> = {},
): UsuarioObjetivoPolitica {
  return { id: 'sup-1', rolApp: RolApp.SUPERVISOR, activo: true, ...parcial };
}

function vendedor(
  parcial: Partial<UsuarioObjetivoPolitica> = {},
): UsuarioObjetivoPolitica {
  return { id: 'ven-1', rolApp: RolApp.VENDEDOR, activo: true, ...parcial };
}

describe('puedeDesactivar', () => {
  it('rechaza AUTODESACTIVACION_PROHIBIDA si actorId es el mismo objetivo', () => {
    const objetivo = vendedor({ id: 'u-1' });

    const r = puedeDesactivar('u-1', objetivo, 5);

    expect(r).toEqual({ permitido: false, motivo: 'AUTODESACTIVACION_PROHIBIDA' });
  });

  it('la autodesactivacion se rechaza incluso siendo el unico supervisor', () => {
    const objetivo = supervisor({ id: 'sup-1' });

    const r = puedeDesactivar('sup-1', objetivo, 1);

    expect(r).toEqual({ permitido: false, motivo: 'AUTODESACTIVACION_PROHIBIDA' });
  });

  it('rechaza ULTIMO_SUPERVISOR al desactivar al unico supervisor activo', () => {
    const objetivo = supervisor();

    const r = puedeDesactivar('otro-admin', objetivo, 1);

    expect(r).toEqual({ permitido: false, motivo: 'ULTIMO_SUPERVISOR' });
  });

  it('permite desactivar a un supervisor cuando hay dos activos', () => {
    const objetivo = supervisor();

    const r = puedeDesactivar('otro-admin', objetivo, 2);

    expect(r).toEqual({ permitido: true });
  });

  it('permite desactivar a un vendedor siempre, sin importar el conteo de supervisores', () => {
    const objetivo = vendedor();

    const r = puedeDesactivar('otro-admin', objetivo, 1);

    expect(r).toEqual({ permitido: true });
  });

  it('permite desactivar a un supervisor ya inactivo (no cuenta como el "activo" a proteger)', () => {
    const objetivo = supervisor({ activo: false });

    const r = puedeDesactivar('otro-admin', objetivo, 1);

    expect(r).toEqual({ permitido: true });
  });
});

describe('puedeCambiarRol', () => {
  it('rechaza AUTOCAMBIO_ROL_PROHIBIDO si actorId es el mismo objetivo', () => {
    const objetivo = vendedor({ id: 'u-1' });

    const r = puedeCambiarRol('u-1', objetivo, RolApp.CONTADOR, 5);

    expect(r).toEqual({ permitido: false, motivo: 'AUTOCAMBIO_ROL_PROHIBIDO' });
  });

  it('rechaza ULTIMO_SUPERVISOR al cambiar de supervisor a vendedor cuando es el unico', () => {
    const objetivo = supervisor();

    const r = puedeCambiarRol('otro-admin', objetivo, RolApp.VENDEDOR, 1);

    expect(r).toEqual({ permitido: false, motivo: 'ULTIMO_SUPERVISOR' });
  });

  it('permite cambiar el rol del unico supervisor si el destino sigue siendo SUPERVISOR', () => {
    const objetivo = supervisor();

    const r = puedeCambiarRol('otro-admin', objetivo, RolApp.SUPERVISOR, 1);

    expect(r).toEqual({ permitido: true });
  });

  it('permite sacar a un supervisor de su rol cuando hay otro supervisor activo', () => {
    const objetivo = supervisor();

    const r = puedeCambiarRol('otro-admin', objetivo, RolApp.CONTADOR, 2);

    expect(r).toEqual({ permitido: true });
  });

  it('permite cambiar el rol de un vendedor sin restriccion', () => {
    const objetivo = vendedor();

    const r = puedeCambiarRol('otro-admin', objetivo, RolApp.SUPERVISOR, 1);

    expect(r).toEqual({ permitido: true });
  });
});

import { RolApp } from '@prisma/client';

import type { UsuarioAdmin } from './admin-usuario.repository';
import { vistaUsuarioAdmin } from './vista-usuario-admin';

const AHORA = new Date('2026-10-01T06:00:00-06:00');

function usuario(bloqueadoHasta: Date | null): UsuarioAdmin {
  return {
    id: 'u-1',
    nombreCompleto: 'Ana Vendedora',
    rolApp: RolApp.VENDEDOR,
    usuarioHandyId: 42,
    activo: true,
    debeCambiarPin: false,
    fechaUltimoCambioPin: null,
    bloqueadoHasta,
    creadoEn: AHORA,
    actualizadoEn: AHORA,
  };
}

describe('vistaUsuarioAdmin', () => {
  it('cambia bloqueadoHasta crudo por el bloqueo vigente', () => {
    const vista = vistaUsuarioAdmin(
      usuario(new Date('2026-10-01T06:12:00-06:00')),
      AHORA,
    );

    expect(vista).not.toHaveProperty('bloqueadoHasta');
    expect(vista.bloqueo).toEqual({
      desde: new Date('2026-10-01T05:57:00-06:00'),
      hasta: new Date('2026-10-01T06:12:00-06:00'),
    });
  });

  it('un bloqueo vencido sale como null', () => {
    const vista = vistaUsuarioAdmin(
      usuario(new Date('2026-10-01T05:00:00-06:00')),
      AHORA,
    );

    expect(vista.bloqueo).toBeNull();
  });
});

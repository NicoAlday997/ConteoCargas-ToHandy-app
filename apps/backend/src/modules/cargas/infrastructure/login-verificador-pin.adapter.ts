import { Injectable } from '@nestjs/common';

import { LoginUseCase } from '../../auth/application/login.use-case';
import {
  VerificadorPin,
  type ResultadoVerificacionPin,
} from '../application/verificador-pin.port';

/**
 * Adaptador de `VerificadorPin` sobre el caso de uso de login del modulo auth:
 * mismo hash, misma politica de intentos y el mismo bloqueo temporal (RF-03).
 * Reutilizarlo evita una segunda implementacion de la verificacion de PIN que
 * pudiera quedar mas laxa que el login.
 */
@Injectable()
export class LoginVerificadorPinAdapter extends VerificadorPin {
  constructor(private readonly login: LoginUseCase) {
    super();
  }

  async verificar(
    usuarioAppId: string,
    pin: string,
    ahora: Date,
  ): Promise<ResultadoVerificacionPin> {
    const resultado = await this.login.ejecutar(usuarioAppId, pin, ahora);
    if (resultado.exito) {
      return { valido: true };
    }
    switch (resultado.motivo) {
      case 'PIN_INCORRECTO':
        return {
          valido: false,
          motivo: 'PIN_INCORRECTO',
          intentosRestantes: resultado.intentosRestantes,
        };
      case 'BLOQUEADO':
      case 'BLOQUEO_ACTIVADO':
        return {
          valido: false,
          motivo: 'BLOQUEADO',
          bloqueadoHasta: resultado.bloqueadoHasta,
        };
      case 'PIN_MAL_FORMADO':
        return {
          valido: false,
          motivo: 'PIN_INCORRECTO',
          intentosRestantes: null,
        };
      case 'INACTIVO':
      // El JWT es de un usuario que ya no existe: se trata como desactivado.
      case 'CREDENCIALES_INVALIDAS':
        return { valido: false, motivo: 'INACTIVO' };
    }
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import type {
  JwtPayload,
  UsuarioAutenticado,
} from '../../../shared/auth/jwt.strategy';
import { UsuarioActual } from '../../../shared/auth/usuario-actual.decorator';
import { CambiarPinUseCase } from '../application/cambiar-pin.use-case';
import { LoginUseCase } from '../application/login.use-case';
import { UsuarioRepository } from '../application/usuario.repository';
import {
  CambiarPinSchema,
  LoginSchema,
  type CambiarPinDto,
  type LoginDto,
} from './auth.dto';
import { ZodValidationPipe } from './zod-validation.pipe';

/**
 * Mensaje generico para fallos sin datos que informar: usuario inexistente o
 * PIN mal formado en login, y cualquier fallo de credenciales en cambiar-pin.
 */
const MENSAJE_CREDENCIALES = 'Usuario o PIN incorrectos';

/**
 * Codigos estables del cuerpo 401 de login. Los define la interfaz, no son el
 * `motivo` interno del caso de uso: la app decide que mostrar a partir de ellos.
 */
type CodigoErrorLogin =
  | 'PIN_INCORRECTO'
  | 'USUARIO_BLOQUEADO'
  | 'USUARIO_INACTIVO'
  | 'CREDENCIALES_INVALIDAS';

function errorLogin(
  codigo: CodigoErrorLogin,
  mensaje: string,
  extra: { intentosRestantes?: number; bloqueadoHasta?: Date } = {},
): UnauthorizedException {
  return new UnauthorizedException({
    statusCode: HttpStatus.UNAUTHORIZED,
    codigo,
    mensaje,
    intentosRestantes: extra.intentosRestantes ?? null,
    bloqueadoHasta: extra.bloqueadoHasta?.toISOString() ?? null,
  });
}

function mensajeIntentosRestantes(intentos: number): string {
  const cuantos =
    intentos === 1 ? 'Te queda 1 intento' : `Te quedan ${intentos} intentos`;
  return `PIN incorrecto. ${cuantos} antes del bloqueo temporal.`;
}

function mensajeBloqueo(bloqueadoHasta: Date, ahora: Date): string {
  // Redondeo hacia arriba: nunca prometer que falta menos de lo real.
  const minutos = Math.max(
    1,
    Math.ceil((bloqueadoHasta.getTime() - ahora.getTime()) / 60_000),
  );
  const cuanto = minutos === 1 ? '1 minuto' : `${minutos} minutos`;
  return (
    `Usuario bloqueado por intentos fallidos. Se desbloquea en ${cuanto}. ` +
    'Si necesitas entrar antes, pide a tu supervisor que restablezca tu PIN.'
  );
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly cambiarPinUseCase: CambiarPinUseCase,
    private readonly usuarioRepository: UsuarioRepository,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Lista de usuarios activos para la seleccion visual de la pantalla de login
   * (RF-01). Publico: no expone PIN ni datos sensibles (el repositorio hace un
   * select explicito de id, nombre y rol).
   */
  @Get('usuarios')
  async listarUsuarios() {
    return this.usuarioRepository.listarActivosParaSeleccion();
  }

  /** Autenticacion por PIN (RF-02). Publico. */
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto) {
    const ahora = new Date();
    const resultado = await this.loginUseCase.ejecutar(
      dto.usuarioAppId,
      dto.pin,
      ahora,
    );

    if (!resultado.exito) {
      // Nunca se propaga `resultado.motivo` crudo al cliente.
      switch (resultado.motivo) {
        case 'PIN_INCORRECTO':
          throw errorLogin(
            'PIN_INCORRECTO',
            mensajeIntentosRestantes(resultado.intentosRestantes),
            { intentosRestantes: resultado.intentosRestantes },
          );
        case 'BLOQUEADO':
        case 'BLOQUEO_ACTIVADO':
          throw errorLogin(
            'USUARIO_BLOQUEADO',
            mensajeBloqueo(resultado.bloqueadoHasta, ahora),
            { intentosRestantes: 0, bloqueadoHasta: resultado.bloqueadoHasta },
          );
        case 'INACTIVO':
          throw errorLogin(
            'USUARIO_INACTIVO',
            'Este usuario esta desactivado. Pide a tu supervisor que lo reactive.',
          );
        case 'CREDENCIALES_INVALIDAS':
        case 'PIN_MAL_FORMADO':
          throw errorLogin('CREDENCIALES_INVALIDAS', MENSAJE_CREDENCIALES);
      }
    }

    const payload: JwtPayload = {
      sub: resultado.usuarioAppId,
      rolApp: resultado.rolApp,
      usuarioHandyId: resultado.usuarioHandyId,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      debeCambiarPin: resultado.debeCambiarPin,
      usuario: {
        id: resultado.usuarioAppId,
        nombreCompleto: resultado.nombreCompleto,
        rolApp: resultado.rolApp,
      },
    };
  }

  /**
   * Cambio de PIN (RF-08). Requiere JWT: `JwtAuthGuard` valida el token y el
   * `usuarioAppId` sale del `request.user` via `UsuarioActual`, nunca del body.
   */
  @Post('cambiar-pin')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async cambiarPin(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(CambiarPinSchema)) dto: CambiarPinDto,
  ) {
    const resultado = await this.cambiarPinUseCase.ejecutar(
      usuario.usuarioAppId,
      dto.pinActual,
      dto.pinNuevo,
    );

    if (!resultado.exito) {
      switch (resultado.motivo) {
        case 'PIN_ACTUAL_INCORRECTO':
        case 'USUARIO_NO_ENCONTRADO':
          // Mismo mensaje generico: no se revela cual de los dos fallo.
          throw new UnauthorizedException({
            statusCode: HttpStatus.UNAUTHORIZED,
            mensaje: MENSAJE_CREDENCIALES,
          });
        case 'PIN_NUEVO_MAL_FORMADO':
          throw new BadRequestException({
            statusCode: HttpStatus.BAD_REQUEST,
            mensaje: 'El PIN nuevo debe tener exactamente 4 digitos numericos',
          });
        case 'PIN_NUEVO_IGUAL_AL_ACTUAL':
          throw new BadRequestException({
            statusCode: HttpStatus.BAD_REQUEST,
            mensaje: 'El PIN nuevo debe ser distinto al actual',
          });
      }
    }

    return { debeCambiarPin: false };
  }
}

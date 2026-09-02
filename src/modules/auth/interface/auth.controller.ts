import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
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
 * Mensaje unico para todo fallo de credenciales. Login responde exactamente lo
 * mismo ante "usuario inexistente", "PIN incorrecto" o "PIN mal formado" para no
 * revelar que identificadores existen.
 */
const MENSAJE_CREDENCIALES = 'Usuario o PIN incorrectos';

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
    const resultado = await this.loginUseCase.ejecutar(
      dto.usuarioAppId,
      dto.pin,
      new Date(),
    );

    if (!resultado.exito) {
      // Nunca se propaga `resultado.motivo` crudo al cliente.
      switch (resultado.motivo) {
        case 'BLOQUEADO':
          throw new HttpException(
            {
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
              mensaje:
                'Se supero el numero de intentos permitidos. Intenta de nuevo mas tarde.',
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        case 'CREDENCIALES_INVALIDAS':
        case 'PIN_MAL_FORMADO':
          // Mismo mensaje para ambos: no se revela si el usuario existe ni si
          // el PIN venia mal formado.
          throw new UnauthorizedException({
            statusCode: HttpStatus.UNAUTHORIZED,
            mensaje: MENSAJE_CREDENCIALES,
          });
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
   * Cambio de PIN (RF-08). Requiere JWT: `JwtAuthGuard` valida el token y
   * repone `request.user`; el `usuarioAppId` sale de ahi via `@UsuarioActual`,
   * nunca del body.
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

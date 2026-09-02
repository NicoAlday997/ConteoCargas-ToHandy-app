/**
 * Puerto de hasheo. El dominio no debe conocer argon2 ni bcrypt.
 * Ver requisito no funcional de seguridad en docs/01.
 */
export abstract class HasherPort {
  abstract hash(valorPlano: string): Promise<string>;
  abstract verificar(hash: string, valorPlano: string): Promise<boolean>;
}

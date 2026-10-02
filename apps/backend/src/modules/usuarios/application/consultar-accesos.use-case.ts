import {
  AdminUsuarioRepository,
  type MovimientoAcceso,
  type PaginaAccesos,
} from './admin-usuario.repository';

const PAGE_POR_DEFECTO = 1;
const TAMANO_PAGINA_POR_DEFECTO = 20;
const TAMANO_PAGINA_MAXIMO = 100;

export type ResultadoConsultarAccesos =
  | { exito: true; pagina: PaginaAccesos }
  | { exito: false; motivo: 'USUARIO_NO_ENCONTRADO' };

/**
 * Historial de acceso de una persona (RF-10): restablecimientos de PIN y
 * desbloqueos manuales juntos, del mas reciente al mas antiguo. Una auditoria
 * que no se puede consultar no sirve; esta es su unica lectura.
 *
 * Solo lectura, para siempre: no existe ni existira un caso de uso que edite
 * o borre un renglon. Si algo hubiera que corregir, se agrega un renglon
 * nuevo que lo explique.
 *
 * Normaliza `page`/`pageSize` igual que el historial de cargas: valores
 * invalidos usan el defecto y `pageSize` se acota a 100.
 */
export class ConsultarAccesosUseCase {
  constructor(private readonly usuarios: AdminUsuarioRepository) {}

  async ejecutar(
    usuarioAppId: string,
    entrada: { page?: number; pageSize?: number },
  ): Promise<ResultadoConsultarAccesos> {
    const usuario = await this.usuarios.buscarPorId(usuarioAppId);
    if (usuario === null) {
      return { exito: false, motivo: 'USUARIO_NO_ENCONTRADO' };
    }

    const page =
      entrada.page !== undefined && entrada.page > 0
        ? entrada.page
        : PAGE_POR_DEFECTO;
    const pageSize =
      entrada.pageSize !== undefined && entrada.pageSize > 0
        ? Math.min(entrada.pageSize, TAMANO_PAGINA_MAXIMO)
        : TAMANO_PAGINA_POR_DEFECTO;

    const pagina = await this.usuarios.listarAccesos(
      usuarioAppId,
      page,
      pageSize,
    );
    return { exito: true, pagina };
  }
}

/**
 * Forma JSON de un renglon (docs/04 §1.2). Plana a proposito: todos los
 * campos estan siempre, con `null` donde no aplican, para que la app no tenga
 * que adivinar por la presencia de una llave.
 */
export function vistaMovimientoAcceso(m: MovimientoAcceso) {
  return {
    id: m.id,
    tipo: m.tipo,
    fecha: m.fecha.toISOString(),
    origen: m.tipo === 'PIN_RESTABLECIDO' ? m.origen : 'SUPERVISOR',
    autor:
      m.tipo === 'PIN_RESTABLECIDO' && m.origen === 'LINEA_COMANDOS'
        ? null
        : m.autor,
    motivo:
      m.tipo === 'PIN_RESTABLECIDO' && m.origen === 'LINEA_COMANDOS'
        ? m.motivo
        : null,
    bloqueadoHasta:
      m.tipo === 'BLOQUEO_QUITADO' ? m.bloqueadoHasta.toISOString() : null,
  };
}

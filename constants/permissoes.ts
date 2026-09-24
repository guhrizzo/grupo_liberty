/**
 * Regra de acesso às abas do dashboard — fonte única usada pelas páginas,
 * pelas server actions, pelo menu lateral e pelo modal de permissões.
 *
 * Quem tem acesso a uma aba pode fazer o CRUD dela. O acesso vem de:
 *   1. admin → sempre;
 *   2. flag `permissions[aba]` no perfil, quando definida (o admin libera
 *      ou bloqueia a aba explicitamente);
 *   3. senão, os cargos padrão da aba (PAGE_DEFAULT_ROLES).
 *
 * Sem `server-only`: também roda em client components.
 */

export type PermissionKey =
  | 'veiculos'
  | 'consulta_fipe'
  | 'propostas'
  | 'anuncios'
  | 'contratos'
  | 'financeiro'
  | 'cobrancas'
  | 'juridico'
  | 'manutencao'
  | 'usuarios'
  | 'analytics'

export type UserPermissions = Partial<Record<PermissionKey, boolean>>

export const PAGE_DEFAULT_ROLES: Record<PermissionKey, readonly string[]> = {
  veiculos: ['admin', 'vendedor', 'advogado', 'suporte'],
  consulta_fipe: ['admin', 'vendedor', 'advogado', 'suporte'],
  propostas: ['admin', 'vendedor'],
  anuncios: ['admin', 'vendedor'],
  contratos: ['admin', 'advogado', 'vendedor'],
  financeiro: ['admin', 'vendedor', 'advogado'],
  cobrancas: ['admin', 'vendedor'],
  juridico: ['admin', 'advogado'],
  manutencao: ['admin', 'vendedor', 'suporte'],
  usuarios: ['admin'],
  analytics: ['admin'],
}

export function temAcessoPagina(
  role: string | null | undefined,
  permissions: UserPermissions | null | undefined,
  key: PermissionKey,
): boolean {
  if (!role) return false
  if (role === 'admin') return true

  const flag = permissions?.[key]
  if (flag !== undefined) return flag === true

  return PAGE_DEFAULT_ROLES[key].includes(role)
}

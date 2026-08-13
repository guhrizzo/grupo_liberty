import 'server-only'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'

export interface SessionUser {
  uid: string
  email: string | null
  name: string | null
  role: string | null
  permissions: UserPermissions
}

export interface UserPermissions {
  veiculos?: boolean
  consulta_fipe?: boolean
  propostas?: boolean
  contratos?: boolean
  financeiro?: boolean
  cobrancas?: boolean
  juridico?: boolean
  manutencao?: boolean
  usuarios?: boolean
}

export const ROLES_VALIDOS = ['vendedor', 'advogado', 'suporte', 'admin'] as const
export type RoleValido = (typeof ROLES_VALIDOS)[number]

/**
 * Retorna o usuário autenticado (decoded claims + perfil).
 * Retorna null se não houver sessão válida.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) return null

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true)
    const profileDoc = await adminDb.collection('profiles').doc(decoded.uid).get()
    const profile = profileDoc.data() as { role?: string; permissions?: UserPermissions } | undefined
    const name =
      ((decoded as unknown) as { name?: string; displayName?: string }).name ||
      ((decoded as unknown) as { name?: string; displayName?: string }).displayName ||
      null

    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name,
      role: profile?.role ?? null,
      permissions: profile?.permissions ?? {},
    }
  } catch {
    return null
  }
}

/**
 * Garante que o usuário pode acessar o módulo jurídico
 * (admin ou advogado).
 */
export async function assertJuridicoAccess(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')
  if (user.role !== 'admin' && user.role !== 'advogado') {
    throw new Error('Acesso negado. Apenas administradores ou advogados podem acessar o jurídico.')
  }
  return user
}

/**
 * Garante permissão para criar/baixar contratos.
 * Admin sempre pode. Demais roles precisam da flag
 * `permissions.contratos = true` no perfil.
 */
export async function assertPodeGerarContratos(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')

  const isAdmin = user.role === 'admin'
  const hasFlag = user.permissions?.contratos === true

  if (!isAdmin && !hasFlag) {
    throw new Error('Acesso negado. Você não tem permissão para gerenciar contratos.')
  }

  return user
}

/**
 * Versão síncrona do gate de contratos — recebe o usuário já
 * carregado e devolve apenas o booleano. Útil para o server
 * decidir se renderiza blocos condicionais sem refazer query.
 */
export function canManageContratos(user: SessionUser | null | undefined): boolean {
  if (!user) return false
  return user.role === 'admin' || user.permissions?.contratos === true
}

/**
 * Garante permissão para baixar o PDF de uma proposta.
 * Permitido para admin e vendedor.
 */
export async function assertPodeGerarPropostaPDF(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')

  if (user.role !== 'admin' && user.role !== 'vendedor') {
    throw new Error('Acesso negado. Apenas administradores e vendedores podem baixar PDFs de propostas.')
  }

  return user
}

/**
 * Garante permissão para criar/editar/excluir veículos.
 * Admin sempre pode. Demais roles precisam da flag
 * `permissions.veiculos = true` no perfil (liberada pelo admin).
 */
export async function assertPodeGerenciarVeiculos(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')

  const isAdmin = user.role === 'admin'
  const hasFlag = user.permissions?.veiculos === true

  if (!isAdmin && !hasFlag) {
    throw new Error('Acesso negado. Você não tem permissão para gerenciar veículos.')
  }

  return user
}

/**
 * Versão síncrona do gate de veículos — recebe o usuário já
 * carregado e devolve apenas o booleano.
 */
export function canManageVeiculos(user: SessionUser | null | undefined): boolean {
  if (!user) return false
  return user.role === 'admin' || user.permissions?.veiculos === true
}

/**
 * Verifica se o usuário logado tem acesso a uma página/aba específica do dashboard.
 */
export function hasPageAccess(
  user: SessionUser | null | undefined,
  permissionKey: keyof UserPermissions,
  defaultRoles: readonly string[] | string[]
): boolean {
  if (!user || !user.role) return false
  if (user.role === 'admin') return true

  // Se a permissão está explicitamente definida no perfil do usuário, ela prevalece
  if (user.permissions && user.permissions[permissionKey] !== undefined) {
    return user.permissions[permissionKey] === true
  }

  // Fallback baseado nos cargos permitidos por padrão
  return defaultRoles.includes(user.role)
}

import 'server-only'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { OWNER_EMAIL } from '@/constants/feedback'
import {
  temAcessoPagina,
  type PermissionKey,
  type UserPermissions,
} from '@/constants/permissoes'

export interface SessionUser {
  uid: string
  email: string | null
  name: string | null
  role: string | null
  permissions: UserPermissions
}

export type { PermissionKey, UserPermissions }

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
 * Garante que o usuário tem acesso a uma aba do dashboard — e, portanto,
 * pode fazer o CRUD dela. Mesma regra de `hasPageAccess` usada pelas
 * páginas: admin sempre; flag `permissions[aba]` quando definida;
 * senão os cargos padrão da aba.
 */
export async function assertPageAccess(key: PermissionKey): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')
  if (!hasPageAccess(user, key)) {
    throw new Error('Acesso negado. Você não tem permissão para acessar esta área.')
  }
  return user
}

/** Acesso ao módulo jurídico (aba `juridico`). */
export function assertJuridicoAccess(): Promise<SessionUser> {
  return assertPageAccess('juridico')
}

/** Ver/criar/baixar/excluir contratos (aba `contratos`). */
export function assertPodeGerarContratos(): Promise<SessionUser> {
  return assertPageAccess('contratos')
}

/** Versão síncrona do gate de contratos, para renderização condicional. */
export function canManageContratos(user: SessionUser | null | undefined): boolean {
  return hasPageAccess(user, 'contratos')
}

/** Baixar o PDF de uma proposta (aba `propostas`). */
export function assertPodeGerarPropostaPDF(): Promise<SessionUser> {
  return assertPageAccess('propostas')
}

/** Ver e fazer a triagem dos anúncios de terceiros (aba `anuncios`). */
export function assertPodeVerAnuncios(): Promise<SessionUser> {
  return assertPageAccess('anuncios')
}

/** Criar/editar/excluir veículos (aba `veiculos`). */
export function assertPodeGerenciarVeiculos(): Promise<SessionUser> {
  return assertPageAccess('veiculos')
}

/** Versão síncrona do gate de veículos. */
export function canManageVeiculos(user: SessionUser | null | undefined): boolean {
  return hasPageAccess(user, 'veiculos')
}

/**
 * Gate do "dono do sistema" — a única pessoa que faz a triagem de feedback
 * (mudar status, escrever atualizações, excluir reports). Comparação
 * case-insensitive contra `OWNER_EMAIL`.
 */
export function isOwner(user: SessionUser | null | undefined): boolean {
  const email = user?.email?.toLowerCase().trim()
  return !!email && email === OWNER_EMAIL.toLowerCase()
}

/**
 * Verifica se o usuário logado tem acesso a uma página/aba específica do
 * dashboard. Ter acesso à aba = poder fazer o CRUD dela.
 */
export function hasPageAccess(
  user: SessionUser | null | undefined,
  permissionKey: PermissionKey,
): boolean {
  return temAcessoPagina(user?.role, user?.permissions, permissionKey)
}

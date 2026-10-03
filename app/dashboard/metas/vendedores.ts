import 'server-only'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import type { VendedorOpcao } from './types'

// Quem é "vendedor" para as metas e para o "Quem fechou?" das propostas
// registradas. Não dá para usar o cargo: vendedores podem ter cargo admin.
// A lista é mantida pelo ADM supremo na aba Metas.

const CONFIG_REF = () => adminDb.collection('metas_config').doc('vendedores')

export async function lerUidsVendedores(): Promise<string[]> {
  const doc = await CONFIG_REF().get()
  const uids = doc.data()?.uids
  return Array.isArray(uids) ? uids.filter((u): u is string => typeof u === 'string') : []
}

export async function gravarUidsVendedores(uids: string[], porUid: string) {
  await CONFIG_REF().set({ uids, atualizadoEm: new Date().toISOString(), atualizadoPorUid: porUid })
}

export async function ehVendedorDasMetas(uid: string): Promise<boolean> {
  return (await lerUidsVendedores()).includes(uid)
}

/** Usuários ativos do Auth com esses uids, com nome para exibir. */
export async function opcoesDeUsuarios(uids: Iterable<string>): Promise<VendedorOpcao[]> {
  const set = new Set(uids)
  if (set.size === 0) return []
  const { users } = await adminAuth.listUsers()
  return users
    .filter((u) => set.has(u.uid) && !u.disabled)
    .map((u) => ({ uid: u.uid, nome: u.displayName || u.email || 'Usuário', email: u.email || '' }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

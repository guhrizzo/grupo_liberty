'use server'

import { adminDb } from '@/utils/firebase/admin'
import { getSessionUser } from '@/utils/permissions'

const MAX_ITENS = 40

/**
 * Salva a ordem do menu lateral escolhida pelo próprio usuário
 * (`profiles/{uid}.sidebarOrdem`, lista de hrefs). `null` volta ao padrão.
 * Só guarda a ordem — o que cada um pode ver continua vindo das permissões.
 */
export async function salvarOrdemMenu(hrefs: string[] | null): Promise<{ success?: string; error?: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }

  let ordem: string[] | null = null
  if (hrefs !== null) {
    if (!Array.isArray(hrefs) || hrefs.length > MAX_ITENS) return { error: 'Ordem inválida.' }
    ordem = [...new Set(hrefs)].filter(
      (h) => typeof h === 'string' && h.length <= 100 && /^\/dashboard(\/[a-z0-9-]+)?$/.test(h),
    )
  }

  try {
    await adminDb.collection('profiles').doc(user.uid).set({ sidebarOrdem: ordem }, { merge: true })
    return { success: ordem ? 'Ordem do menu salva.' : 'Menu voltou para a ordem padrão.' }
  } catch (err) {
    console.error('[salvarOrdemMenu]', err)
    return { error: 'Erro ao salvar a ordem do menu.' }
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/utils/permissions'
import { carregarCatalogo, gravarCatalogo } from '@/utils/pos-venda/catalogo'
import { normalizarCatalogo, type PlanoCatalogo } from '@/utils/pos-venda/catalogo-modelo'

/** Salva preços, planos e regras de cobrança. Só administradores. Propostas já publicadas não mudam. */
export async function salvarCatalogoPosVenda(entrada: PlanoCatalogo[]): Promise<{ success?: string; error?: string }> {
  const user = await getSessionUser()
  if (!user || user.role !== 'admin') return { error: 'Apenas administradores podem alterar preços e planos.' }

  const planos = normalizarCatalogo(entrada)
  if (!planos) {
    return { error: 'Confira os planos: nome obrigatório, valor maior que zero (ou vazio para "sob consulta"), vencimento entre 1 e 60 dias e periodicidade válida.' }
  }
  try {
    await gravarCatalogo(planos, user.uid)
  } catch {
    return { error: 'Não foi possível salvar. Tente novamente.' }
  }
  revalidatePath('/dashboard/pos-venda')
  revalidatePath('/dashboard/pos-venda/catalogo')
  revalidatePath('/area-do-cliente/pos-venda')
  return { success: 'Catálogo salvo. Vale para as próximas solicitações e propostas.' }
}

export async function lerCatalogoPosVenda() {
  return carregarCatalogo()
}

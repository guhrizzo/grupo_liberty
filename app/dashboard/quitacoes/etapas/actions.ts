'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/utils/permissions'
import { normalizarEtapas, type EtapaConfig } from '@/utils/quitacoes/etapas'
import { carregarEtapas, gravarEtapas } from '@/utils/quitacoes/etapas-config'

type Resultado = { success?: string; error?: string }

/** Salva a lista global de etapas. Só administradores; etapas existentes nunca são apagadas, só desativadas. */
export async function salvarEtapasQuitacao(entrada: EtapaConfig[]): Promise<Resultado> {
  const user = await getSessionUser()
  if (!user || user.role !== 'admin') return { error: 'Apenas administradores podem configurar as etapas.' }

  const etapas = normalizarEtapas(entrada)
  if (!etapas) {
    return { error: 'Confira as etapas: cada uma precisa de nome (até 80 caracteres), e pelo menos uma além da inicial deve estar ativa.' }
  }
  const atuais = await carregarEtapas()
  const ids = new Set(etapas.map((e) => e.id))
  if (atuais.some((e) => !ids.has(e.id))) {
    return { error: 'Não é possível remover uma etapa já existente. Desative-a para escondê-la.' }
  }

  try {
    await gravarEtapas(etapas, user.uid)
  } catch {
    return { error: 'Não foi possível salvar. Tente novamente.' }
  }
  revalidatePath('/dashboard/quitacoes')
  revalidatePath('/dashboard/quitacoes/etapas')
  revalidatePath('/area-do-cliente/quitacao')
  return { success: 'Etapas salvas.' }
}

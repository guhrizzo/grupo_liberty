'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { normalizarConfig, type ConfigIndicacoes } from '@/utils/indicacoes/modelo'
import { gravarConfigIndicacoes, revisarIndicacao } from '@/utils/indicacoes/servidor'

type Resultado = { success?: string; error?: string }

/** As regras de recompensa só mudam com o administrador; a revisão de indicações vale para quem tem acesso à área. */
async function usuario() {
  const user = await getSessionUser()
  return user && hasPageAccess(user, 'indicacoes') ? user : null
}

export async function salvarConfigIndicacoes(entrada: ConfigIndicacoes): Promise<Resultado> {
  const user = await usuario()
  if (!user || user.role !== 'admin') return { error: 'Apenas administradores podem alterar as regras.' }
  const config = normalizarConfig(entrada)
  if (!config) {
    return { error: 'Confira as faixas: começam na 1ª indicação, não podem ter lacunas e a última fica sem limite. Valores não podem ser negativos.' }
  }
  try {
    await gravarConfigIndicacoes(config, user.uid)
  } catch {
    return { error: 'Não foi possível salvar. Tente novamente.' }
  }
  revalidatePath('/dashboard/indicacoes')
  revalidatePath('/area-do-cliente/indicacoes')
  return { success: 'Regras salvas. Valem para as próximas conversões.' }
}

export async function decidirIndicacao(id: string, decisao: 'aprovar' | 'recusar'): Promise<Resultado> {
  const user = await usuario()
  if (!user) return { error: 'Acesso negado.' }
  if (typeof id !== 'string' || !/^cpf_[a-f0-9]{64}$/.test(id) || (decisao !== 'aprovar' && decisao !== 'recusar')) {
    return { error: 'Indicação inválida.' }
  }
  try {
    const status = await revisarIndicacao(id, decisao, user.uid)
    if (!status) return { error: 'Esta indicação não está mais em revisão.' }
  } catch {
    return { error: 'Não foi possível registrar a decisão. Tente novamente.' }
  }
  revalidatePath('/dashboard/indicacoes')
  return { success: decisao === 'aprovar' ? 'Indicação aprovada e convertida.' : 'Indicação recusada.' }
}

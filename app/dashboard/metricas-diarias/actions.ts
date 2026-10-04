'use server'

import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { getSessionUser, hasPageAccess, type SessionUser } from '@/utils/permissions'
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import { METRICA_CAMPOS, METRICA_VALOR_MAX, metricaVazia, type MetricaValores } from '@/constants/metricas-diarias'
import type { MetricaDiaria, MetricasDoMes, SalvarMetricaResponse } from './types'

const COLECAO = 'metricas_diarias'

function serialize(id: string, data: FirebaseFirestore.DocumentData): MetricaDiaria {
  const valores = metricaVazia()
  for (const { key } of METRICA_CAMPOS) valores[key] = typeof data[key] === 'number' ? data[key] : 0
  return {
    id,
    uid: data.uid ?? '',
    nome: data.nome ?? 'Usuário',
    data: data.data ?? '',
    mes: data.mes ?? String(data.data ?? '').slice(0, 7),
    atualizadoEm: data.atualizadoEm ?? '',
    ...valores,
  }
}

async function checarAcesso(): Promise<{ user: SessionUser } | { error: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!hasPageAccess(user, 'metricas_diarias')) return { error: 'Acesso negado.' }
  return { user }
}

/** Admin vê o time inteiro; os demais, só os próprios dias. */
function veTodos(user: SessionUser) {
  return user.role === 'admin'
}

export async function getMetricasDoMes(mes: string): Promise<MetricasDoMes> {
  const vazio = { mes, registros: [] }
  try {
    if (!/^\d{4}-\d{2}$/.test(mes)) return vazio
    const acesso = await checarAcesso()
    if ('error' in acesso) return vazio
    const { user } = acesso

    // Só igualdade em um campo (sem índice composto); o resto filtra em memória.
    const snap = veTodos(user)
      ? await adminDb.collection(COLECAO).where('mes', '==', mes).get()
      : await adminDb.collection(COLECAO).where('uid', '==', user.uid).get()

    const registros = snap.docs
      .map((d) => serialize(d.id, d.data()))
      .filter((r) => r.mes === mes)
      .sort((a, b) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome, 'pt-BR'))
    return { mes, registros }
  } catch (err) {
    console.error('[getMetricasDoMes]', err)
    return vazio
  }
}

export async function salvarMetricaDiaria(data: string, valores: MetricaValores): Promise<SalvarMetricaResponse> {
  try {
    const acesso = await checarAcesso()
    if ('error' in acesso) return { error: acesso.error }
    const { user } = acesso

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T00:00:00Z`))) {
      return { error: 'Data inválida.' }
    }
    if (data > hojeSaoPaulo()) return { error: 'Não dá para preencher um dia que ainda não chegou.' }

    const limpos = metricaVazia()
    for (const { key, label } of METRICA_CAMPOS) {
      const v = Number(valores?.[key] ?? 0)
      if (!Number.isInteger(v) || v < 0 || v > METRICA_VALOR_MAX) {
        return { error: `"${label}" precisa ser um número inteiro entre 0 e ${METRICA_VALOR_MAX}.` }
      }
      limpos[key] = v
    }

    const id = `${user.uid}_${data}`
    const doc = {
      uid: user.uid,
      nome: user.name || user.email || 'Usuário',
      email: user.email ?? '',
      data,
      mes: data.slice(0, 7),
      ...limpos,
      atualizadoEm: new Date().toISOString(),
    }
    await adminDb.collection(COLECAO).doc(id).set(doc, { merge: true })
    revalidatePath('/dashboard/metricas-diarias')
    return { success: 'Métricas do dia salvas.', registro: serialize(id, doc) }
  } catch (err) {
    console.error('[salvarMetricaDiaria]', err)
    return { error: 'Erro ao salvar as métricas.' }
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { getSessionUser } from '@/utils/permissions'
import { ehCeo } from '@/constants/permissoes'
import { ehTarefaPrioridade } from '@/constants/tarefas'
import { LEMBRETE_TEXTO_MAX, type Lembrete, type LembreteResponse } from './types'

const COLECAO = 'lembretes_ceo'

function serialize(id: string, data: FirebaseFirestore.DocumentData): Lembrete {
  return {
    id,
    texto: data.texto ?? '',
    prioridade: ehTarefaPrioridade(data.prioridade) ? data.prioridade : 'normal',
    autorUid: data.autorUid ?? '',
    autorNome: data.autorNome ?? 'Usuário',
    criadoEm: data.criadoEm ?? '',
    vistoEm: data.vistoEm ?? null,
  }
}

/** CEO lê todos; os demais, só os que eles mesmos enviaram. */
export async function getLembretes(): Promise<Lembrete[]> {
  try {
    const user = await getSessionUser()
    if (!user) return []
    // Só igualdade (sem orderBy) para não exigir índice composto; ordena em memória.
    const snap = ehCeo(user.email)
      ? await adminDb.collection(COLECAO).get()
      : await adminDb.collection(COLECAO).where('autorUid', '==', user.uid).get()
    return snap.docs
      .map((d) => serialize(d.id, d.data()))
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
  } catch (err) {
    console.error('[getLembretes]', err)
    return []
  }
}

export async function enviarLembrete(texto: string, prioridade: string): Promise<LembreteResponse> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }

  const t = (texto ?? '').trim()
  if (!t) return { error: 'Escreva o lembrete.' }
  if (t.length > LEMBRETE_TEXTO_MAX) return { error: `Máximo de ${LEMBRETE_TEXTO_MAX} caracteres.` }
  if (!ehTarefaPrioridade(prioridade)) return { error: 'Prioridade inválida.' }

  try {
    await adminDb.collection(COLECAO).add({
      texto: t,
      prioridade,
      autorUid: user.uid,
      autorNome: user.name || user.email || 'Usuário',
      criadoEm: new Date().toISOString(),
      vistoEm: null,
    })
    revalidatePath('/dashboard/demandas')
    return { success: 'Lembrete enviado ao CEO.' }
  } catch (err) {
    console.error('[enviarLembrete]', err)
    return { error: 'Erro ao enviar o lembrete. Tente novamente.' }
  }
}

/** Só o CEO marca/desmarca como visto. */
export async function marcarLembreteVisto(id: string, visto: boolean): Promise<LembreteResponse> {
  const user = await getSessionUser()
  if (!user || !ehCeo(user.email)) return { error: 'Acesso negado.' }
  if (!id) return { error: 'Lembrete inválido.' }
  try {
    const ref = adminDb.collection(COLECAO).doc(id)
    if (!(await ref.get()).exists) return { error: 'Lembrete não encontrado.' }
    await ref.update({ vistoEm: visto ? new Date().toISOString() : null })
    revalidatePath('/dashboard/demandas')
    return { success: visto ? 'Marcado como visto.' : 'Marcado como não visto.' }
  } catch (err) {
    console.error('[marcarLembreteVisto]', err)
    return { error: 'Erro ao atualizar o lembrete.' }
  }
}

/** CEO exclui qualquer um; o autor, só os seus que ainda não foram vistos. */
export async function excluirLembrete(id: string): Promise<LembreteResponse> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!id) return { error: 'Lembrete inválido.' }
  try {
    const ref = adminDb.collection(COLECAO).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Lembrete não encontrado.' }
    const d = doc.data() || {}
    const podeExcluir = ehCeo(user.email) || (d.autorUid === user.uid && !d.vistoEm)
    if (!podeExcluir) return { error: 'Você não pode excluir este lembrete.' }
    await ref.delete()
    revalidatePath('/dashboard/demandas')
    return { success: 'Lembrete excluído.' }
  } catch (err) {
    console.error('[excluirLembrete]', err)
    return { error: 'Erro ao excluir o lembrete.' }
  }
}

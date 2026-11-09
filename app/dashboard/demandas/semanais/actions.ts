'use server'

import { revalidatePath } from 'next/cache'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { getSessionUser, isAdmSupremo } from '@/utils/permissions'
import { hojeNoFuso } from '@/app/dashboard/financeiro/periodo'
import { TAREFA_DESCRICAO_MAX, TAREFA_TITULO_MAX } from '@/constants/tarefas'
import {
  COL_TAREFAS_SEMANAIS as COL,
  COL_TAREFAS_SEMANAIS_CONCLUSOES as COL_CONC,
  ehDiaSemana,
  idConclusao,
  ocorrenciaAtual,
} from '@/utils/pendencias/semanais'
import type { TarefaSemanal, TarefaSemanalResponse } from './types'

function revalidar() {
  revalidatePath('/dashboard', 'layout')
}

/** Tarefas semanais: todas para o ADM supremo; só as próprias para os demais. */
export async function getTarefasSemanais(): Promise<TarefaSemanal[]> {
  try {
    const user = await getSessionUser()
    if (!user) return []
    const supremo = isAdmSupremo(user)
    const snap = supremo
      ? await adminDb.collection(COL).get()
      : await adminDb.collection(COL).where('responsavelUid', '==', user.uid).get()

    const hoje = hojeNoFuso()
    const regras = snap.docs.map((doc) => {
      const d = doc.data()
      const dia = ehDiaSemana(d.diaSemana) ? d.diaSemana : 1
      const desde = typeof d.desde === 'string' ? d.desde : hoje
      const oc = ocorrenciaAtual(hoje, dia)
      return { id: doc.id, d, dia, desde, ocorrencia: oc >= desde ? oc : null }
    })

    const datas = [...new Set(regras.map((r) => r.ocorrencia).filter((x): x is string => !!x))]
    const conclusoes = new Map<string, string>()
    if (datas.length > 0) {
      const cs = await adminDb.collection(COL_CONC).where('data', 'in', datas).get()
      for (const c of cs.docs) conclusoes.set(c.id, (c.data().concluidaPorNome as string) ?? '')
    }

    return regras
      .map((r) => {
        const feita = r.ocorrencia ? conclusoes.has(idConclusao(r.id, r.ocorrencia)) : false
        return {
          id: r.id,
          titulo: (r.d.titulo as string) ?? '',
          descricao: (r.d.descricao as string) ?? '',
          diaSemana: r.dia,
          responsavelUid: (r.d.responsavelUid as string) ?? '',
          responsavelNome: (r.d.responsavelNome as string) ?? 'Usuário',
          ativa: r.d.ativa !== false,
          desde: r.desde,
          ocorrencia: r.ocorrencia,
          concluida: feita,
          concluidaPorNome: feita && r.ocorrencia ? conclusoes.get(idConclusao(r.id, r.ocorrencia)) || null : null,
        } satisfies TarefaSemanal
      })
      .sort((a, b) => a.diaSemana - b.diaSemana || a.titulo.localeCompare(b.titulo, 'pt-BR'))
  } catch (err) {
    console.error('[getTarefasSemanais]', err)
    return []
  }
}

async function exigirSupremo() {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')
  if (!isAdmSupremo(user)) throw new Error('Apenas o ADM supremo gerencia tarefas semanais.')
  return user
}

export async function salvarTarefaSemanal(formData: FormData): Promise<TarefaSemanalResponse> {
  try {
    const user = await exigirSupremo()
    const titulo = String(formData.get('titulo') ?? '').trim()
    const descricao = String(formData.get('descricao') ?? '').trim()
    const diaSemana = Number(formData.get('diaSemana'))
    const responsavelUid = String(formData.get('responsavelUid') ?? '').trim()

    if (!titulo) return { error: 'Informe o título da tarefa.' }
    if (titulo.length > TAREFA_TITULO_MAX) return { error: `Título com no máximo ${TAREFA_TITULO_MAX} caracteres.` }
    if (descricao.length > TAREFA_DESCRICAO_MAX) return { error: 'Descrição muito longa.' }
    if (!ehDiaSemana(diaSemana)) return { error: 'Escolha o dia da semana.' }
    if (!responsavelUid) return { error: 'Escolha o funcionário.' }

    let responsavelNome = 'Usuário'
    try {
      const u = await adminAuth.getUser(responsavelUid)
      responsavelNome = u.displayName || u.email || 'Usuário'
    } catch {
      return { error: 'Funcionário não encontrado.' }
    }

    const agora = new Date().toISOString()
    await adminDb.collection(COL).add({
      titulo,
      descricao,
      diaSemana,
      responsavelUid,
      responsavelNome,
      ativa: true,
      // A regra só vale a partir de hoje (não cria atraso retroativo).
      desde: hojeNoFuso(),
      criadoPorUid: user.uid,
      criadoPorNome: user.name || user.email || 'Usuário',
      criadoEm: agora,
    })
    revalidar()
    return { success: 'Tarefa semanal cadastrada.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao salvar.' }
  }
}

export async function alternarTarefaSemanalAtiva(id: string, ativa: boolean): Promise<TarefaSemanalResponse> {
  try {
    await exigirSupremo()
    await adminDb.collection(COL).doc(id).update({ ativa })
    revalidar()
    return { success: ativa ? 'Tarefa reativada.' : 'Tarefa pausada.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao atualizar.' }
  }
}

export async function excluirTarefaSemanal(id: string): Promise<TarefaSemanalResponse> {
  try {
    await exigirSupremo()
    await adminDb.collection(COL).doc(id).delete()
    revalidar()
    return { success: 'Tarefa semanal excluída.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao excluir.' }
  }
}

/** Marca (ou desmarca) a ocorrência atual da tarefa como feita. Responsável ou ADM supremo. */
export async function concluirTarefaSemanal(
  id: string,
  concluir: boolean,
): Promise<TarefaSemanalResponse> {
  try {
    const user = await getSessionUser()
    if (!user) return { error: 'Não autenticado.' }
    const ref = adminDb.collection(COL).doc(id)
    const d = (await ref.get()).data()
    if (!d) return { error: 'Tarefa não encontrada.' }
    if (d.responsavelUid !== user.uid && !isAdmSupremo(user)) return { error: 'Acesso negado.' }

    const dia = ehDiaSemana(d.diaSemana) ? d.diaSemana : 1
    const data = ocorrenciaAtual(hojeNoFuso(), dia)
    const concRef = adminDb.collection(COL_CONC).doc(idConclusao(id, data))
    if (concluir) {
      await concRef.set({
        regraId: id,
        data,
        concluidaPorUid: user.uid,
        concluidaPorNome: user.name || user.email || 'Usuário',
        concluidaEm: new Date().toISOString(),
      })
    } else {
      await concRef.delete()
    }
    revalidar()
    return { success: concluir ? 'Tarefa concluída.' : 'Conclusão desfeita.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao atualizar.' }
  }
}

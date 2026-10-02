'use server'

import { revalidatePath } from 'next/cache'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { getSessionUser, isAdmSupremo, type SessionUser } from '@/utils/permissions'
import {
  TAREFA_DESCRICAO_MAX,
  TAREFA_ANOTACOES_MAX,
  TAREFA_COMENTARIO_MAX,
  TAREFA_TITULO_MAX,
  ehDataValida,
  ehTarefaStatus,
} from '@/constants/tarefas'
import type { Tarefa, TarefaFieldErrors, TarefaResponse, UsuarioOpcao } from './types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLECAO = 'tarefas'

function serialize(id: string, data: FirebaseFirestore.DocumentData): Tarefa {
  return {
    id,
    titulo: data.titulo ?? '',
    descricao: data.descricao ?? '',
    prazo: data.prazo ?? '',
    responsavelUid: data.responsavelUid ?? '',
    responsavelNome: data.responsavelNome ?? 'Usuário',
    responsavelEmail: data.responsavelEmail ?? '',
    status: ehTarefaStatus(data.status) ? data.status : 'pendente',
    comentario: data.comentario ?? null,
    respondidoEm: data.respondidoEm ?? null,
    exclusaoSolicitadaEm: data.exclusaoSolicitadaEm ?? null,
    fechada: data.fechada === true,
    fechadaEm: data.fechadaEm ?? null,
    criadoPorUid: data.criadoPorUid ?? '',
    criadoPorNome: data.criadoPorNome ?? 'Usuário',
    criadoEm: data.criadoEm ?? '',
    atualizadoEm: data.atualizadoEm ?? data.criadoEm ?? '',
  }
}

/** Revalida a aba e o layout (contador do menu). */
function revalidar() {
  revalidatePath('/dashboard', 'layout')
}

/** Garante que quem chama é ADM supremo. */
async function checarAdmSupremo(): Promise<{ user: SessionUser } | { error: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!isAdmSupremo(user)) return { error: 'Acesso negado. Apenas o ADM supremo gerencia tarefas.' }
  return { user }
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

export async function getTarefas(): Promise<Tarefa[]> {
  try {
    const user = await getSessionUser()
    if (!user) return []

    // Só igualdade (sem orderBy) para não exigir índice composto; ordena em memória.
    const snap = isAdmSupremo(user)
      ? await adminDb.collection(COLECAO).get()
      : await adminDb.collection(COLECAO).where('responsavelUid', '==', user.uid).get()

    return snap.docs
      .map((doc) => serialize(doc.id, doc.data()))
      .sort((a, b) => a.prazo.localeCompare(b.prazo) || b.criadoEm.localeCompare(a.criadoEm))
  } catch (err) {
    console.error('[getTarefas]', err)
    return []
  }
}

/** Usuários com cargo — opções do seletor de responsável. Só ADM supremo. */
export async function getUsuariosAtribuiveis(): Promise<UsuarioOpcao[]> {
  const check = await checarAdmSupremo()
  if ('error' in check) return []

  try {
    const [profilesSnap, authResult] = await Promise.all([
      adminDb.collection('profiles').get(),
      adminAuth.listUsers(),
    ])
    const comCargo = new Set(
      profilesSnap.docs.filter((d) => !!d.data()?.role).map((d) => d.id),
    )
    return authResult.users
      .filter((u) => comCargo.has(u.uid) && !u.disabled)
      .map((u) => ({
        uid: u.uid,
        nome: u.displayName || u.email || 'Usuário',
        email: u.email || '',
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  } catch (err) {
    console.error('[getUsuariosAtribuiveis]', err)
    return []
  }
}

// ─── CRUD do ADM supremo ─────────────────────────────────────────────────────

/** Cria (sem `id`) ou edita (com `id`) uma tarefa. */
export async function salvarTarefa(formData: FormData): Promise<TarefaResponse> {
  const check = await checarAdmSupremo()
  if ('error' in check) return { error: check.error }
  const { user } = check

  const id = ((formData.get('id') as string) || '').trim()
  const titulo = ((formData.get('titulo') as string) || '').trim()
  const descricao = ((formData.get('descricao') as string) || '').trim()
  const prazo = ((formData.get('prazo') as string) || '').trim()
  const responsavelUid = ((formData.get('responsavelUid') as string) || '').trim()

  const fieldErrors: TarefaFieldErrors = {}
  if (!titulo) fieldErrors.titulo = 'Informe um título.'
  else if (titulo.length > TAREFA_TITULO_MAX) fieldErrors.titulo = `Máximo de ${TAREFA_TITULO_MAX} caracteres.`
  if (descricao.length > TAREFA_DESCRICAO_MAX) fieldErrors.descricao = `Máximo de ${TAREFA_DESCRICAO_MAX} caracteres.`
  if (!ehDataValida(prazo)) fieldErrors.prazo = 'Informe o prazo.'
  if (!responsavelUid) fieldErrors.responsavelUid = 'Escolha o responsável.'

  let responsavelNome = ''
  let responsavelEmail = ''
  if (responsavelUid) {
    try {
      const u = await adminAuth.getUser(responsavelUid)
      responsavelNome = u.displayName || u.email || 'Usuário'
      responsavelEmail = u.email || ''
    } catch {
      fieldErrors.responsavelUid = 'Usuário não encontrado.'
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  try {
    const now = new Date().toISOString()
    const dados = {
      titulo,
      descricao,
      prazo,
      responsavelUid,
      responsavelNome,
      responsavelEmail,
      atualizadoEm: now,
    }

    if (id) {
      const ref = adminDb.collection(COLECAO).doc(id)
      const doc = await ref.get()
      if (!doc.exists) return { error: 'Tarefa não encontrada.' }
      // Trocar o responsável descarta a resposta do anterior.
      const trocouResponsavel = doc.data()?.responsavelUid !== responsavelUid
      await ref.update(
        trocouResponsavel
          ? { ...dados, status: 'pendente', comentario: null, respondidoEm: null, exclusaoSolicitadaEm: null }
          : dados,
      )
      revalidar()
      return { success: 'Tarefa atualizada.' }
    }

    await adminDb.collection(COLECAO).add({
      ...dados,
      status: 'pendente',
      comentario: null,
      respondidoEm: null,
      exclusaoSolicitadaEm: null,
      fechada: false,
      fechadaEm: null,
      criadoPorUid: user.uid,
      criadoPorNome: user.name || user.email || 'Usuário',
      criadoEm: now,
    })
    revalidar()
    return { success: 'Tarefa criada.' }
  } catch (err) {
    console.error('[salvarTarefa]', err)
    return { error: 'Erro ao salvar a tarefa. Tente novamente.' }
  }
}

export async function excluirTarefa(id: string): Promise<TarefaResponse> {
  const check = await checarAdmSupremo()
  if ('error' in check) return { error: check.error }
  if (!id) return { error: 'Tarefa inválida.' }

  try {
    const ref = adminDb.collection(COLECAO).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Tarefa não encontrada.' }
    await ref.delete()
    revalidar()
    return { success: 'Tarefa excluída.' }
  } catch (err) {
    console.error('[excluirTarefa]', err)
    return { error: 'Erro ao excluir a tarefa.' }
  }
}

/** Fecha (trava a resposta) ou reabre (volta para pendente e limpa o comentário). */
export async function definirTarefaFechada(id: string, fechada: boolean): Promise<TarefaResponse> {
  const check = await checarAdmSupremo()
  if ('error' in check) return { error: check.error }
  if (!id) return { error: 'Tarefa inválida.' }

  try {
    const ref = adminDb.collection(COLECAO).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Tarefa não encontrada.' }

    const now = new Date().toISOString()
    await ref.update(
      fechada
        ? { fechada: true, fechadaEm: now, atualizadoEm: now }
        : {
            fechada: false,
            fechadaEm: null,
            status: 'pendente',
            comentario: null,
            respondidoEm: null,
            exclusaoSolicitadaEm: null,
            atualizadoEm: now,
          },
    )
    revalidar()
    return { success: fechada ? 'Tarefa fechada.' : 'Tarefa reaberta.' }
  } catch (err) {
    console.error('[definirTarefaFechada]', err)
    return { error: 'Erro ao atualizar a tarefa.' }
  }
}

// ─── Resposta do responsável ─────────────────────────────────────────────────

/**
 * O responsável marca a tarefa como concluída (comentário opcional), não
 * concluída (motivo obrigatório) ou desfaz a resposta (`pendente`).
 * Bloqueado depois que o ADM supremo fecha.
 */
export async function responderTarefa(
  id: string,
  status: string,
  comentarioRaw: string | null,
): Promise<TarefaResponse> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!id) return { error: 'Tarefa inválida.' }
  if (!ehTarefaStatus(status)) return { error: 'Resposta inválida.' }

  const comentario = status === 'pendente' ? '' : (comentarioRaw ?? '').trim()
  if (status === 'nao_concluida' && !comentario) {
    return { error: 'Explique por que não concluiu.', fieldErrors: { comentario: 'Obrigatório.' } }
  }
  if (comentario.length > TAREFA_COMENTARIO_MAX) {
    return {
      error: `Máximo de ${TAREFA_COMENTARIO_MAX} caracteres.`,
      fieldErrors: { comentario: 'Muito longo.' },
    }
  }

  try {
    const ref = adminDb.collection(COLECAO).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Tarefa não encontrada.' }
    const data = doc.data()!
    if (data.responsavelUid !== user.uid) return { error: 'Esta tarefa não é sua.' }
    if (data.fechada === true) return { error: 'Esta tarefa já foi fechada pelo ADM.' }

    const now = new Date().toISOString()
    await ref.update({
      status,
      comentario: comentario || null,
      respondidoEm: status === 'pendente' ? null : now,
      // O pedido de exclusão só vale para tarefa concluída.
      ...(status === 'concluida' ? {} : { exclusaoSolicitadaEm: null }),
      atualizadoEm: now,
    })
    revalidar()
    return {
      success:
        status === 'concluida'
          ? 'Tarefa marcada como concluída.'
          : status === 'nao_concluida'
            ? 'Resposta enviada.'
            : 'Resposta desfeita.',
    }
  } catch (err) {
    console.error('[responderTarefa]', err)
    return { error: 'Erro ao enviar a resposta.' }
  }
}

// ─── Pedido de exclusão ──────────────────────────────────────────────────────

/**
 * O responsável pede (ou cancela o pedido) para o ADM supremo excluir uma
 * tarefa concluída. O ADM supremo também pode limpar o pedido (recusar).
 */
export async function definirPedidoExclusao(id: string, pedir: boolean): Promise<TarefaResponse> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!id) return { error: 'Tarefa inválida.' }

  try {
    const ref = adminDb.collection(COLECAO).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Tarefa não encontrada.' }
    const data = doc.data()!
    const souResponsavel = data.responsavelUid === user.uid

    if (pedir) {
      if (!souResponsavel) return { error: 'Esta tarefa não é sua.' }
      if (data.status !== 'concluida') {
        return { error: 'Só dá para pedir a exclusão de uma tarefa concluída.' }
      }
    } else if (!souResponsavel && !isAdmSupremo(user)) {
      return { error: 'Acesso negado.' }
    }

    const now = new Date().toISOString()
    await ref.update({ exclusaoSolicitadaEm: pedir ? now : null, atualizadoEm: now })
    revalidar()
    return {
      success: pedir
        ? 'Pedido de exclusão enviado ao ADM.'
        : souResponsavel
          ? 'Pedido de exclusão cancelado.'
          : 'Pedido de exclusão recusado.',
    }
  } catch (err) {
    console.error('[definirPedidoExclusao]', err)
    return { error: 'Erro ao atualizar o pedido de exclusão.' }
  }
}

// ─── Bloco de anotações pessoal ──────────────────────────────────────────────
// Um documento por usuário em `tarefas_anotacoes/{uid}`. O uid vem sempre da
// sessão: ninguém (nem o ADM supremo) lê ou grava o bloco de outra pessoa.

const COLECAO_ANOTACOES = 'tarefas_anotacoes'

export async function getMinhasAnotacoes(): Promise<{ texto: string; atualizadoEm: string | null }> {
  try {
    const user = await getSessionUser()
    if (!user) return { texto: '', atualizadoEm: null }
    const doc = await adminDb.collection(COLECAO_ANOTACOES).doc(user.uid).get()
    const data = doc.data()
    return { texto: data?.texto ?? '', atualizadoEm: data?.atualizadoEm ?? null }
  } catch (err) {
    console.error('[getMinhasAnotacoes]', err)
    return { texto: '', atualizadoEm: null }
  }
}

export async function salvarMinhasAnotacoes(
  textoRaw: string,
): Promise<TarefaResponse & { atualizadoEm?: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }

  const texto = typeof textoRaw === 'string' ? textoRaw : ''
  if (texto.length > TAREFA_ANOTACOES_MAX) {
    return { error: `Máximo de ${TAREFA_ANOTACOES_MAX} caracteres.` }
  }

  try {
    const atualizadoEm = new Date().toISOString()
    await adminDb.collection(COLECAO_ANOTACOES).doc(user.uid).set({ texto, atualizadoEm })
    return { success: 'Anotações salvas.', atualizadoEm }
  } catch (err) {
    console.error('[salvarMinhasAnotacoes]', err)
    return { error: 'Erro ao salvar as anotações.' }
  }
}

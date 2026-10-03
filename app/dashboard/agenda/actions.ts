'use server'

import { revalidatePath } from 'next/cache'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { getSessionUser, isAdmSupremo, type SessionUser } from '@/utils/permissions'
import { ehDataValida } from '@/constants/tarefas'
import {
  contaConectada,
  desconectar,
  excluirEvento,
  integracaoConfigurada,
  uidsConectados,
  urlAutorizacao,
} from '@/utils/google-agenda'
import { origem, sincronizar } from './sincronia'
import {
  AGENDA_DESCRICAO_MAX,
  AGENDA_LOCAL_MAX,
  AGENDA_TITULO_MAX,
  type AgendaResponse,
  type Compromisso,
  type CompromissoFieldErrors,
  type ConexaoGoogle,
} from './types'

const COLECAO = 'agenda'
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function checarAdmSupremo(): Promise<{ user: SessionUser } | { error: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!isAdmSupremo(user)) return { error: 'Acesso negado. Apenas o ADM supremo gerencia a agenda.' }
  return { user }
}

function revalidar() {
  revalidatePath('/dashboard/agenda')
}

function serialize(
  id: string,
  data: FirebaseFirestore.DocumentData,
  conectados: Set<string>,
): Compromisso {
  const uids: string[] = data.participantesUids ?? []
  const nomes: Record<string, string> = data.participantesNomes ?? {}
  const eventos: Record<string, string> = data.googleEventos ?? {}
  const erros: Record<string, string> = data.googleErros ?? {}
  return {
    id,
    titulo: data.titulo ?? '',
    descricao: data.descricao ?? '',
    local: data.local ?? '',
    data: data.data ?? '',
    diaInteiro: data.diaInteiro === true,
    horaInicio: data.horaInicio ?? null,
    horaFim: data.horaFim ?? null,
    participantes: uids.map((uid) => ({
      uid,
      nome: nomes[uid] ?? 'Usuário',
      conectado: conectados.has(uid),
      erro: erros[uid] ?? null,
      sincronizado: !!eventos[uid],
    })),
    criadoPorNome: data.criadoPorNome ?? '',
    atualizadoEm: data.atualizadoEm ?? '',
  }
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

/** ADM supremo vê todos; os demais, só onde são participantes. */
export async function getCompromissos(): Promise<Compromisso[]> {
  try {
    const user = await getSessionUser()
    if (!user) return []
    // Só igualdade/array-contains: não exige índice composto; ordena em memória.
    const snap = isAdmSupremo(user)
      ? await adminDb.collection(COLECAO).get()
      : await adminDb.collection(COLECAO).where('participantesUids', 'array-contains', user.uid).get()

    const todos = new Set<string>()
    snap.docs.forEach((d) => (d.data().participantesUids ?? []).forEach((u: string) => todos.add(u)))
    const conectados = integracaoConfigurada() ? await uidsConectados([...todos]) : new Set<string>()

    return snap.docs
      .map((d) => serialize(d.id, d.data(), conectados))
      .sort(
        (a, b) =>
          a.data.localeCompare(b.data) ||
          Number(!a.diaInteiro) - Number(!b.diaInteiro) ||
          (a.horaInicio ?? '').localeCompare(b.horaInicio ?? ''),
      )
  } catch (err) {
    console.error('[getCompromissos]', err)
    return []
  }
}

export async function getConexaoGoogle(): Promise<ConexaoGoogle> {
  const configurada = integracaoConfigurada()
  const user = await getSessionUser()
  if (!user || !configurada) return { configurada, email: null }
  try {
    const conta = await contaConectada(user.uid)
    return { configurada, email: conta ? conta.email || 'conta Google' : null }
  } catch (err) {
    console.error('[getConexaoGoogle]', err)
    return { configurada, email: null }
  }
}

// ─── Conexão com o Google ────────────────────────────────────────────────────

export async function iniciarConexaoGoogle(): Promise<{ url?: string; error?: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  const url = urlAutorizacao(user.uid, `${await origem()}/api/google-agenda/callback`)
  if (!url) return { error: 'A integração com o Google Agenda ainda não foi configurada.' }
  return { url }
}

export async function desconectarGoogle(): Promise<AgendaResponse> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  try {
    await desconectar(user.uid)
    revalidar()
    return { success: 'Google Agenda desconectado. Os eventos já criados continuam no seu Google.' }
  } catch (err) {
    console.error('[desconectarGoogle]', err)
    return { error: 'Erro ao desconectar.' }
  }
}

// ─── CRUD do ADM supremo ─────────────────────────────────────────────────────

/** Cria (sem `id`) ou edita (com `id`) um compromisso e sincroniza com o Google. */
export async function salvarCompromisso(formData: FormData): Promise<AgendaResponse> {
  const check = await checarAdmSupremo()
  if ('error' in check) return { error: check.error }
  const { user } = check

  const texto = (k: string) => ((formData.get(k) as string) || '').trim()
  const id = texto('id')
  const titulo = texto('titulo')
  const descricao = texto('descricao')
  const local = texto('local')
  const data = texto('data')
  const diaInteiro = texto('diaInteiro') === 'true'
  const horaInicio = diaInteiro ? null : texto('horaInicio') || null
  const horaFim = diaInteiro ? null : texto('horaFim') || null
  const participantesUids = [...new Set(formData.getAll('participantes').map(String).filter(Boolean))]

  const fieldErrors: CompromissoFieldErrors = {}
  if (!titulo) fieldErrors.titulo = 'Informe um título.'
  else if (titulo.length > AGENDA_TITULO_MAX) fieldErrors.titulo = `Máximo de ${AGENDA_TITULO_MAX} caracteres.`
  if (!ehDataValida(data)) fieldErrors.data = 'Informe a data.'
  if (!diaInteiro) {
    if (!horaInicio || !HORA.test(horaInicio)) fieldErrors.horaInicio = 'Informe o horário.'
    if (horaFim && (!HORA.test(horaFim) || (horaInicio && horaFim <= horaInicio))) {
      fieldErrors.horaFim = 'O fim precisa ser depois do início.'
    }
  }
  if (participantesUids.length === 0) fieldErrors.participantes = 'Escolha pelo menos um participante.'
  if (descricao.length > AGENDA_DESCRICAO_MAX || local.length > AGENDA_LOCAL_MAX) {
    return { error: 'Texto longo demais.' }
  }

  const participantesNomes: Record<string, string> = {}
  if (participantesUids.length > 0) {
    try {
      const { users } = await adminAuth.getUsers(participantesUids.map((uid) => ({ uid })))
      users.forEach((u) => (participantesNomes[u.uid] = u.displayName || u.email || 'Usuário'))
      if (users.length !== participantesUids.length) fieldErrors.participantes = 'Participante não encontrado.'
    } catch {
      fieldErrors.participantes = 'Participante não encontrado.'
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { error: 'Verifique os campos destacados.', fieldErrors }

  const now = new Date().toISOString()
  const dados = {
    titulo,
    descricao,
    local,
    data,
    diaInteiro,
    horaInicio,
    horaFim,
    participantesUids,
    participantesNomes,
    atualizadoEm: now,
  }

  try {
    let docId = id
    let removidos: string[] = []
    if (id) {
      const ref = adminDb.collection(COLECAO).doc(id)
      const atual = await ref.get()
      if (!atual.exists) return { error: 'Compromisso não encontrado.' }
      const antes: string[] = atual.data()?.participantesUids ?? []
      removidos = antes.filter((u) => !participantesUids.includes(u))
      await ref.update(dados)
    } else {
      const ref = await adminDb.collection(COLECAO).add({
        ...dados,
        googleEventos: {},
        googleErros: {},
        criadoPorUid: user.uid,
        criadoPorNome: user.name || user.email || 'Usuário',
        criadoEm: now,
      })
      docId = ref.id
    }

    let falhas: string[] = []
    if (integracaoConfigurada()) {
      const salvo = (await adminDb.collection(COLECAO).doc(docId).get()).data()!
      falhas = await sincronizar(docId, salvo, removidos, await origem())
    }
    revalidar()
    return {
      success: id ? 'Compromisso atualizado.' : 'Compromisso criado.',
      aviso:
        falhas.length > 0
          ? `Não foi possível atualizar o Google Agenda de ${falhas.map((u) => participantesNomes[u]).join(', ')}.`
          : undefined,
    }
  } catch (err) {
    console.error('[salvarCompromisso]', err)
    return { error: 'Erro ao salvar o compromisso.' }
  }
}

export async function excluirCompromisso(id: string): Promise<AgendaResponse> {
  const check = await checarAdmSupremo()
  if ('error' in check) return { error: check.error }
  try {
    const ref = adminDb.collection(COLECAO).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Compromisso não encontrado.' }
    const eventos: Record<string, string> = doc.data()?.googleEventos ?? {}
    if (integracaoConfigurada()) {
      await Promise.all(
        Object.entries(eventos).map(([uid, eventId]) =>
          excluirEvento(uid, eventId).catch((err) => console.error('[agenda] excluir evento', uid, err)),
        ),
      )
    }
    await ref.delete()
    revalidar()
    return { success: 'Compromisso excluído.' }
  } catch (err) {
    console.error('[excluirCompromisso]', err)
    return { error: 'Erro ao excluir o compromisso.' }
  }
}

/** Tenta de novo levar o compromisso para o Google de todos os participantes. */
export async function ressincronizarCompromisso(id: string): Promise<AgendaResponse> {
  const check = await checarAdmSupremo()
  if ('error' in check) return { error: check.error }
  if (!integracaoConfigurada()) return { error: 'A integração com o Google Agenda não está configurada.' }
  try {
    const doc = await adminDb.collection(COLECAO).doc(id).get()
    if (!doc.exists) return { error: 'Compromisso não encontrado.' }
    const falhas = await sincronizar(id, doc.data()!, [], await origem())
    revalidar()
    return falhas.length > 0
      ? { error: 'Ainda não deu para sincronizar com o Google de todos os participantes.' }
      : { success: 'Sincronizado com o Google Agenda.' }
  } catch (err) {
    console.error('[ressincronizarCompromisso]', err)
    return { error: 'Erro ao sincronizar.' }
  }
}

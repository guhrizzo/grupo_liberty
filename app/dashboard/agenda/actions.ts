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
  listarEventosGoogle,
  obterEventoGoogle,
  type EventoGoogleLido,
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
  type EventoGoogle,
} from './types'

const COLECAO = 'agenda'
// Eventos do Google que o dono liberou para a administração: `${uid}_${eventId}`.
const COMPARTILHADOS = 'agenda_google_compartilhados'
const DIA_MS = 86_400_000
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function checarLogado(): Promise<{ user: SessionUser } | { error: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  return { user }
}

/**
 * Gerencia quem criou o compromisso; o ADM supremo também gerencia os que o
 * criador compartilhou com a administração.
 */
function podeGerenciar(user: SessionUser, data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (data?.criadoPorUid === user.uid) return true
  return isAdmSupremo(user) && data?.compartilhado === true
}

const SEM_PERMISSAO = 'Você só pode alterar compromissos que você mesmo criou.'

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
    criadoPorUid: data.criadoPorUid ?? '',
    compartilhado: data.compartilhado === true,
    criadoPorNome: data.criadoPorNome ?? '',
    atualizadoEm: data.atualizadoEm ?? '',
  }
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

/**
 * Cada um vê onde é participante e o que criou. O ADM supremo vê também o que
 * os outros criaram e compartilharam com a administração.
 */
export async function getCompromissos(): Promise<Compromisso[]> {
  try {
    const user = await getSessionUser()
    if (!user) return []
    // Só igualdade/array-contains: não exige índice composto; ordena em memória.
    const col = adminDb.collection(COLECAO)
    const consultas = [
      col.where('participantesUids', 'array-contains', user.uid).get(),
      col.where('criadoPorUid', '==', user.uid).get(),
      ...(isAdmSupremo(user) ? [col.where('compartilhado', '==', true).get()] : []),
    ]
    const docs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
    for (const snap of await Promise.all(consultas)) snap.docs.forEach((d) => docs.set(d.id, d))

    const todos = new Set<string>()
    docs.forEach((d) => (d.data().participantesUids ?? []).forEach((u: string) => todos.add(u)))
    const conectados = integracaoConfigurada() ? await uidsConectados([...todos]) : new Set<string>()

    return [...docs.values()]
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

// ─── Eventos do Google (somente leitura) ─────────────────────────────────────

/**
 * Eventos da agenda do Google do próprio usuário (e, para o ADM supremo, os que
 * outras pessoas compartilharam). Nada é gravado: lê direto do Google.
 */
export async function getEventosGoogle(): Promise<EventoGoogle[]> {
  try {
    const user = await getSessionUser()
    if (!user || !integracaoConfigurada()) return []

    const compartilhados = await adminDb.collection(COMPARTILHADOS).get()
    const idsMeus = new Set<string>()
    const deOutros: { uid: string; eventId: string; donoNome: string }[] = []
    compartilhados.docs.forEach((d) => {
      const x = d.data()
      if (x.uid === user.uid) idsMeus.add(x.eventId)
      else if (isAdmSupremo(user)) deOutros.push({ uid: x.uid, eventId: x.eventId, donoNome: x.donoNome ?? 'Usuário' })
    })

    const agora = Date.now()
    const lidos = await listarEventosGoogle(
      user.uid,
      new Date(agora - 60 * DIA_MS),
      new Date(agora + 180 * DIA_MS),
    ).catch((err) => {
      console.error('[getEventosGoogle] próprios', err)
      return [] as EventoGoogleLido[]
    })
    const proprios: EventoGoogle[] = lidos.map((e) => ({
      ...e,
      uid: user.uid,
      donoNome: user.name || user.email || 'Você',
      compartilhado: idsMeus.has(e.id),
    }))

    const alheios = (
      await Promise.all(
        deOutros.map(async (c) => {
          try {
            const e = await obterEventoGoogle(c.uid, c.eventId)
            return e ? { ...e, uid: c.uid, donoNome: c.donoNome, compartilhado: true } : null
          } catch (err) {
            console.error('[getEventosGoogle] compartilhado', c.uid, err)
            return null
          }
        }),
      )
    ).filter((e): e is EventoGoogle => e !== null)

    return [...proprios, ...alheios]
  } catch (err) {
    console.error('[getEventosGoogle]', err)
    return []
  }
}

/** O dono libera (ou retira) um evento do próprio Google para a administração ver. */
export async function compartilharEventoGoogle(eventId: string, compartilhar: boolean): Promise<AgendaResponse> {
  const check = await checarLogado()
  if ('error' in check) return { error: check.error }
  const { user } = check
  if (!eventId) return { error: 'Evento inválido.' }
  try {
    const ref = adminDb.collection(COMPARTILHADOS).doc(`${user.uid}_${eventId}`)
    if (compartilhar) {
      // Confere que o evento existe mesmo na agenda dessa pessoa.
      const evento = await obterEventoGoogle(user.uid, eventId)
      if (!evento) return { error: 'Evento não encontrado no seu Google Agenda.' }
      await ref.set({
        uid: user.uid,
        eventId,
        donoNome: user.name || user.email || 'Usuário',
        compartilhadoEm: new Date().toISOString(),
      })
    } else {
      await ref.delete()
    }
    revalidar()
    return { success: compartilhar ? 'Evento compartilhado com a administração.' : 'Evento voltou a ser só seu.' }
  } catch (err) {
    console.error('[compartilharEventoGoogle]', err)
    return { error: 'Erro ao alterar o compartilhamento.' }
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

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Cria (sem `id`) ou edita (com `id`) um compromisso e sincroniza com o Google.
 * Qualquer usuário marca na própria agenda; só o ADM supremo escolhe participantes.
 */
export async function salvarCompromisso(formData: FormData): Promise<AgendaResponse> {
  const check = await checarLogado()
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
  const compartilhadoInformado = texto('compartilhado') === 'true'
  const participantesUids = isAdmSupremo(user)
    ? [...new Set(formData.getAll('participantes').map(String).filter(Boolean))]
    : [user.uid]

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
  const dados: Record<string, unknown> = {
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
      if (!podeGerenciar(user, atual.data())) return { error: SEM_PERMISSAO }
      const antes: string[] = atual.data()?.participantesUids ?? []
      removidos = antes.filter((u) => !participantesUids.includes(u))
      // Só quem criou muda o compartilhamento.
      if (atual.data()?.criadoPorUid === user.uid) dados.compartilhado = !isAdmSupremo(user) && compartilhadoInformado
      await ref.update(dados)
    } else {
      const ref = await adminDb.collection(COLECAO).add({
        ...dados,
        compartilhado: !isAdmSupremo(user) && compartilhadoInformado,
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
  const check = await checarLogado()
  if ('error' in check) return { error: check.error }
  const { user } = check
  try {
    const ref = adminDb.collection(COLECAO).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Compromisso não encontrado.' }
    if (!podeGerenciar(user, doc.data())) return { error: SEM_PERMISSAO }
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
  const check = await checarLogado()
  if ('error' in check) return { error: check.error }
  const { user } = check
  if (!integracaoConfigurada()) return { error: 'A integração com o Google Agenda não está configurada.' }
  try {
    const doc = await adminDb.collection(COLECAO).doc(id).get()
    if (!doc.exists) return { error: 'Compromisso não encontrado.' }
    if (!podeGerenciar(user, doc.data())) return { error: SEM_PERMISSAO }
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

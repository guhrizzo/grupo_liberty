import 'server-only'
import crypto from 'node:crypto'
import { adminDb } from '@/utils/firebase/admin'
import { decrypt, encrypt } from '@/utils/crypto'

// Integração com o Google Agenda (OAuth 2.0 web server flow + Calendar API v3
// via fetch). Ver docs/superpowers/specs/2026-10-03-agenda-google-design.md.

export const FUSO_AGENDA = 'America/Sao_Paulo'
const ESCOPOS = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events']
const CONTAS = 'google_agenda_contas'
const STATE_VALIDADE_MS = 10 * 60 * 1000

function config() {
  const clientId = process.env.GOOGLE_AGENDA_CLIENT_ID
  const clientSecret = process.env.GOOGLE_AGENDA_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

export function integracaoConfigurada(): boolean {
  return config() !== null
}

// ─── state assinado (leva o uid: no app desktop o retorno cai no navegador do
// sistema, onde a pessoa pode nem estar logada no painel) ────────────────────

interface StatePayload {
  uid: string
  redirectUri: string
  exp: number
}

function assinar(dados: string, segredo: string) {
  return crypto.createHmac('sha256', segredo).update(dados).digest('base64url')
}

function criarState(payload: StatePayload, segredo: string) {
  const dados = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${dados}.${assinar(dados, segredo)}`
}

export function lerState(state: string): StatePayload | null {
  const cfg = config()
  if (!cfg) return null
  const [dados, assinatura] = state.split('.')
  if (!dados || !assinatura) return null
  const esperada = assinar(dados, cfg.clientSecret)
  const a = Buffer.from(assinatura)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(dados, 'base64url').toString()) as StatePayload
    if (typeof payload.uid !== 'string' || typeof payload.redirectUri !== 'string') return null
    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

/** URL de autorização do Google para o usuário `uid`. */
export function urlAutorizacao(uid: string, redirectUri: string): string | null {
  const cfg = config()
  if (!cfg) return null
  const state = criarState({ uid, redirectUri, exp: Date.now() + STATE_VALIDADE_MS }, cfg.clientSecret)
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ESCOPOS.join(' '),
    access_type: 'offline',
    // Sempre pede consentimento: garante que o Google devolva o refresh token.
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// ─── Tokens ──────────────────────────────────────────────────────────────────

interface RespostaToken {
  access_token?: string
  refresh_token?: string
  id_token?: string
  scope?: string
  error?: string
  error_description?: string
}

async function postToken(body: Record<string, string>): Promise<RespostaToken> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    cache: 'no-store',
  })
  return (await res.json()) as RespostaToken
}

/** E-mail da conta a partir do id_token (veio direto do Google por TLS). */
function emailDoIdToken(idToken: string | undefined): string {
  if (!idToken) return ''
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString())
    return typeof payload.email === 'string' ? payload.email : ''
  } catch {
    return ''
  }
}

/** Troca o `code` do retorno pelo refresh token e salva a conta do usuário. */
export async function concluirConexao(uid: string, code: string, redirectUri: string) {
  const cfg = config()
  if (!cfg) throw new Error('Integração com o Google Agenda não configurada.')
  const r = await postToken({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  if (!r.refresh_token) {
    throw new Error(r.error_description || r.error || 'O Google não devolveu a autorização.')
  }
  if (!r.scope?.includes('calendar.events')) {
    throw new Error('A permissão para a agenda não foi concedida. Marque a opção da agenda ao autorizar.')
  }
  await adminDb.collection(CONTAS).doc(uid).set({
    refreshToken: encrypt(r.refresh_token),
    email: emailDoIdToken(r.id_token),
    conectadoEm: new Date().toISOString(),
  })
}

export async function contaConectada(uid: string): Promise<{ email: string } | null> {
  const doc = await adminDb.collection(CONTAS).doc(uid).get()
  if (!doc.exists) return null
  return { email: (doc.data()?.email as string) || '' }
}

/** uids com conta conectada, dentre os informados. */
export async function uidsConectados(uids: string[]): Promise<Set<string>> {
  if (uids.length === 0) return new Set()
  const refs = uids.map((u) => adminDb.collection(CONTAS).doc(u))
  const docs = await adminDb.getAll(...refs)
  return new Set(docs.filter((d) => d.exists).map((d) => d.id))
}

export async function desconectar(uid: string) {
  const ref = adminDb.collection(CONTAS).doc(uid)
  const doc = await ref.get()
  const token = doc.exists ? decrypt(doc.data()?.refreshToken ?? '') : ''
  if (token) {
    // Melhor esforço: se a revogação falhar, a conta sai do painel mesmo assim.
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => undefined)
  }
  await ref.delete()
}

class SemConta extends Error {}

async function accessToken(uid: string): Promise<string> {
  const cfg = config()
  if (!cfg) throw new Error('Integração com o Google Agenda não configurada.')
  const doc = await adminDb.collection(CONTAS).doc(uid).get()
  if (!doc.exists) throw new SemConta()
  const refreshToken = decrypt(doc.data()?.refreshToken ?? '')
  if (!refreshToken) throw new SemConta()
  const r = await postToken({
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token',
  })
  if (r.error === 'invalid_grant') {
    // A pessoa revogou o acesso no Google (ou o token venceu): desconecta.
    await doc.ref.delete()
    throw new Error('A conexão com o Google expirou. Conecte de novo na aba Agenda.')
  }
  if (!r.access_token) throw new Error(r.error_description || r.error || 'Falha ao autenticar no Google.')
  return r.access_token
}

// ─── Eventos ─────────────────────────────────────────────────────────────────

export interface DadosEvento {
  titulo: string
  descricao: string
  local: string
  data: string // YYYY-MM-DD
  diaInteiro: boolean
  horaInicio: string | null // HH:MM
  horaFim: string | null
  linkPainel: string
}

function diaSeguinte(data: string) {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function corpoEvento(e: DadosEvento) {
  const descricao = [e.descricao, `Compromisso do painel Liberty Car: ${e.linkPainel}`]
    .filter(Boolean)
    .join('\n\n')
  const base = { summary: e.titulo, description: descricao, location: e.local || undefined }
  if (e.diaInteiro || !e.horaInicio) {
    // No Google o fim de um evento de dia inteiro é exclusivo.
    return { ...base, start: { date: e.data }, end: { date: diaSeguinte(e.data) } }
  }
  const fim = e.horaFim && e.horaFim > e.horaInicio ? e.horaFim : e.horaInicio
  return {
    ...base,
    start: { dateTime: `${e.data}T${e.horaInicio}:00`, timeZone: FUSO_AGENDA },
    end: { dateTime: `${e.data}T${fim}:00`, timeZone: FUSO_AGENDA },
  }
}

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

async function chamar(uid: string, url: string, init: RequestInit) {
  const token = await accessToken(uid)
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
    cache: 'no-store',
  })
  return res
}

async function erroDe(res: Response) {
  try {
    const j = await res.json()
    return j?.error?.message || `Google respondeu ${res.status}`
  } catch {
    return `Google respondeu ${res.status}`
  }
}

/**
 * Cria ou atualiza o evento de `uid`. Devolve o id do evento, `null` se a
 * pessoa não tem conta conectada, ou lança com a mensagem do erro.
 */
export async function salvarEvento(uid: string, eventId: string | null, e: DadosEvento): Promise<string | null> {
  try {
    if (eventId) {
      const res = await chamar(uid, `${API}/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        body: JSON.stringify(corpoEvento(e)),
      })
      if (res.ok) return eventId
      // Apagado direto no Google: recria.
      if (res.status !== 404 && res.status !== 410) throw new Error(await erroDe(res))
    }
    const res = await chamar(uid, API, { method: 'POST', body: JSON.stringify(corpoEvento(e)) })
    if (!res.ok) throw new Error(await erroDe(res))
    const criado = (await res.json()) as { id?: string }
    if (!criado.id) throw new Error('O Google não devolveu o evento criado.')
    return criado.id
  } catch (err) {
    if (err instanceof SemConta) return null
    throw err
  }
}

/** Apaga o evento de `uid` no Google (já apagado ou sem conta = ok). */
export async function excluirEvento(uid: string, eventId: string): Promise<void> {
  try {
    const res = await chamar(uid, `${API}/${encodeURIComponent(eventId)}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(await erroDe(res))
  } catch (err) {
    if (err instanceof SemConta) return
    throw err
  }
}

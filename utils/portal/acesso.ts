import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { decrypt } from '@/utils/crypto'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { normalizarEmail, type ModuloPortal, type PerfilPortal } from './modelo'

const sessaoCookie = 'liberty_portal_sessao'
const duracaoSessao = 7 * 24 * 60 * 60 * 1000

export const clientesPortal = () => adminDb.collection('clientes_contrato')
export const chavesPortal = () => adminDb.collection('portal_acessos')
export const chaveHash = (value: string) => createHash('sha256').update(value).digest('hex')
export const tokenPortal = () => randomBytes(32).toString('hex')

export interface AcessoPortal {
  documento: string
  versao: string
  sessao?: { hash: string; expira: number } | null
  fotoGoogle?: { uid: string; url: string }
}

export interface CadastroPortal {
  email: string
  ativo: boolean
  versao: string
  modulos: ModuloPortal[]
  ordemMenu?: string[]
  perfil?: Omit<PerfilPortal, 'cpfResponsavel'> & { cpfResponsavelCifrado?: string }
}

function gravarSessao(store: Awaited<ReturnType<typeof cookies>>, value: string, duracao: number) {
  store.set(sessaoCookie, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/area-do-cliente',
    maxAge: duracao / 1000,
  })
}

function emailVerificado(token: DecodedIdToken) {
  const provedor = token.firebase.sign_in_provider
  return token.email_verified && (provedor === 'password' || provedor === 'google.com')
    ? normalizarEmail(token.email)
    : ''
}

function fotoDoGoogle(identidade: DecodedIdToken) {
  return identidade.firebase.sign_in_provider === 'google.com' &&
    typeof identidade.picture === 'string' &&
    /^https:\/\/lh[0-9]+\.googleusercontent\.com\//i.test(identidade.picture)
    ? identidade.picture
    : null
}

export async function iniciarSessaoPortal(idToken: string) {
  const identidade = await adminAuth.verifyIdToken(idToken, true)
  const agora = Date.now()
  const email = emailVerificado(identidade)
  if (!email || agora / 1000 - identidade.auth_time > 5 * 60) return 'identidade-invalida'

  const foto = fotoDoGoogle(identidade)
  const jwt = await adminAuth.createSessionCookie(idToken, { expiresIn: duracaoSessao })
  const chave = chaveHash(email)
  const ref = chavesPortal().doc(chave)
  const autorizada = await adminDb.runTransaction(async (tx) => {
    const acesso = (await tx.get(ref)).data() as AcessoPortal | undefined
    if (!acesso) return false

    const cliente = await tx.get(clientesPortal().doc(acesso.documento))
    const cadastro = cliente.get('portal') as CadastroPortal | undefined
    if (!cadastro?.ativo || cadastro.email !== email || cadastro.versao !== acesso.versao) return false

    tx.update(ref, {
      sessao: { hash: chaveHash(jwt), expira: agora + duracaoSessao },
      ...(foto ? { fotoGoogle: { uid: identidade.uid, url: foto } } : {}),
    })
    return true
  })
  if (!autorizada) return 'sem-cadastro'

  gravarSessao(await cookies(), jwt, duracaoSessao)
  return 'ok'
}

export async function clienteAutenticado() {
  const jwt = (await cookies()).get(sessaoCookie)?.value
  if (!jwt) return null

  try {
    const identidade = await adminAuth.verifySessionCookie(jwt, true)
    const email = emailVerificado(identidade)
    if (!email) return null

    const acesso = (await chavesPortal().doc(chaveHash(email)).get()).data() as AcessoPortal | undefined
    if (!acesso?.sessao || acesso.sessao.expira <= Date.now() || acesso.sessao.hash !== chaveHash(jwt)) return null

    const cliente = await clientesPortal().doc(acesso.documento).get()
    const cadastro = cliente.get('portal') as CadastroPortal | undefined
    if (!cadastro?.ativo || cadastro.versao !== acesso.versao || cadastro.email !== email) return null

    const foto = fotoDoGoogle(identidade) ??
      (acesso.fotoGoogle?.uid === identidade.uid ? acesso.fotoGoogle.url : null)
    const nome = cadastro.perfil?.nome || String(cliente.get('contratante.nome') || 'Cliente')
    return {
      documento: cliente.id,
      nome,
      perfil: {
        nome,
        telefone: cadastro.perfil?.telefone ?? String(cliente.get('contratante.telefone') || ''),
        cidade: cadastro.perfil?.cidade ?? '',
        uf: cadastro.perfil?.uf ?? '',
        cpfResponsavel: decrypt(cadastro.perfil?.cpfResponsavelCifrado ?? ''),
      },
      foto,
      cadastro,
    }
  } catch {
    return null
  }
}

export async function encerrarSessaoPortal() {
  const store = await cookies()
  const jwt = store.get(sessaoCookie)?.value
  gravarSessao(store, '', 0)
  if (!jwt) return

  try {
    const identidade = await adminAuth.verifySessionCookie(jwt)
    const email = emailVerificado(identidade)
    if (!email) return

    const ref = chavesPortal().doc(chaveHash(email))
    await adminDb.runTransaction(async (tx) => {
      const acesso = (await tx.get(ref)).data() as AcessoPortal | undefined
      if (acesso?.sessao?.hash === chaveHash(jwt)) tx.update(ref, { sessao: null })
    })
  } catch {
    console.warn('[portal] Não foi possível revogar a sessão no servidor.')
  }
}

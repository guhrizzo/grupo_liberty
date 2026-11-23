import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => {
  const docs = new Map<string, Record<string, unknown>>()
  const cookies = new Map<string, string>()
  const snapshot = (path: string) => ({
    id: path.split('/').at(-1),
    data: () => docs.get(path),
    get: (field: string) => field.split('.').reduce<unknown>(
      (data, part) => (data as Record<string, unknown> | undefined)?.[part],
      docs.get(path),
    ),
  })
  return { docs, cookies, snapshot, verifyIdToken: vi.fn(), verifySessionCookie: vi.fn(), createSessionCookie: vi.fn() }
})

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => ({ value: fake.cookies.get(name) }),
    set: (name: string, value: string) => fake.cookies.set(name, value),
  }),
}))
vi.mock('@/utils/firebase/admin', () => ({
  adminAuth: {
    verifyIdToken: fake.verifyIdToken,
    verifySessionCookie: fake.verifySessionCookie,
    createSessionCookie: fake.createSessionCookie,
  },
  adminDb: {
    collection: (collection: string) => ({
      doc: (id: string) => ({
        path: `${collection}/${id}`,
        get: async () => fake.snapshot(`${collection}/${id}`),
      }),
    }),
    runTransaction: async (run: (tx: unknown) => Promise<unknown>) => run({
      get: async (ref: { path: string }) => fake.snapshot(ref.path),
      update: (ref: { path: string }, fields: Record<string, unknown>) =>
        Object.assign(fake.docs.get(ref.path)!, fields),
    }),
  },
}))

import { chaveHash, clienteAutenticado, encerrarSessaoPortal, iniciarSessaoPortal } from './acesso'

const email = 'cliente@example.test'
const documento = '00000000000'
const caminhoAcesso = `portal_acessos/${chaveHash(email)}`
const caminhoCliente = `clientes_contrato/${documento}`
const sessao = 'jwt-de-teste'
const cookieSessao = 'liberty_portal_sessao'

function identidade(provedor = 'password', verificado = true) {
  return {
    uid: 'uid-cliente',
    email,
    email_verified: verificado,
    auth_time: Math.floor(Date.now() / 1000),
    firebase: { sign_in_provider: provedor },
  }
}

describe('sessão da Área do Cliente', () => {
  beforeEach(() => {
    fake.docs.clear()
    fake.cookies.clear()
    fake.verifyIdToken.mockReset().mockResolvedValue(identidade())
    fake.verifySessionCookie.mockReset().mockResolvedValue(identidade())
    fake.createSessionCookie.mockReset().mockResolvedValue(sessao)
    fake.docs.set(caminhoAcesso, { documento, versao: 'v1' })
    fake.docs.set(caminhoCliente, {
      contratante: { nome: 'Cliente Teste' },
      portal: { email, ativo: true, versao: 'v1', modulos: ['quitacao'] },
    })
  })

  it.each(['password', 'google.com'])('libera a conta vinculada e verificada por %s', async (provedor) => {
    fake.verifyIdToken.mockResolvedValue(identidade(provedor))
    expect(await iniciarSessaoPortal('token')).toBe('ok')
    expect(fake.verifyIdToken).toHaveBeenCalledWith('token', true)
    expect(await clienteAutenticado()).toMatchObject({ documento, nome: 'Cliente Teste' })
    expect(fake.verifySessionCookie).toHaveBeenCalledWith(sessao, true)
  })

  it('reutiliza a foto do login Google ao entrar com senha na mesma conta', async () => {
    const foto = 'https://lh3.googleusercontent.com/foto-de-teste'
    fake.verifyIdToken.mockResolvedValueOnce({ ...identidade('google.com'), picture: foto })
    expect(await iniciarSessaoPortal('token-google')).toBe('ok')
    await encerrarSessaoPortal()

    expect(await iniciarSessaoPortal('token-senha')).toBe('ok')
    expect(await clienteAutenticado()).toMatchObject({ foto })

    fake.verifySessionCookie.mockResolvedValueOnce({ ...identidade(), uid: 'outro-uid' })
    expect(await clienteAutenticado()).toMatchObject({ foto: null })
  })

  it('recusa e-mail não confirmado ou identidade sem cadastro associado', async () => {
    fake.verifyIdToken.mockResolvedValueOnce(identidade('password', false))
    expect(await iniciarSessaoPortal('token')).toBe('identidade-invalida')
    fake.verifyIdToken.mockResolvedValueOnce({ ...identidade('google.com'), email: 'outra@example.test' })
    expect(await iniciarSessaoPortal('token')).toBe('sem-cadastro')
    expect(fake.cookies.has(cookieSessao)).toBe(false)
  })

  it('recusa cookie de outra sessão ou revogado pelo Firebase', async () => {
    await iniciarSessaoPortal('token')
    fake.cookies.set(cookieSessao, 'outra-sessao')
    expect(await clienteAutenticado()).toBeNull()
    fake.cookies.set(cookieSessao, sessao)
    fake.verifySessionCookie.mockRejectedValueOnce(new Error('revogada'))
    expect(await clienteAutenticado()).toBeNull()
  })

  it('bloqueia acesso desativado e invalida o cookie após sair', async () => {
    await iniciarSessaoPortal('token')
    const cadastro = fake.docs.get(caminhoCliente)!
    cadastro.portal = { email, ativo: false, versao: 'v1' }
    expect(await clienteAutenticado()).toBeNull()
    cadastro.portal = { email, ativo: true, versao: 'v1' }
    await encerrarSessaoPortal()
    fake.cookies.set(cookieSessao, sessao)
    expect(await clienteAutenticado()).toBeNull()
  })
})

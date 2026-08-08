'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { adminAuth, adminDb } from '@/utils/firebase/admin'

type LoginResult = { error?: string }

export async function login(_prev: LoginResult, formData: FormData): Promise<LoginResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'E-mail e senha são obrigatórios.' }
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    )

    if (!res.ok) {
      const errorData = await res.json()
      const message = errorData.error?.message || 'Credenciais inválidas'
      let friendlyMessage = 'Erro ao realizar login.'
      if (message === 'INVALID_PASSWORD' || message === 'EMAIL_NOT_FOUND') {
        friendlyMessage = 'E-mail ou senha incorretos.'
      } else if (message === 'USER_DISABLED') {
        friendlyMessage = 'Esta conta foi desativada.'
      } else {
        friendlyMessage = message
      }
      return { error: friendlyMessage }
    }

    const { idToken } = await res.json()

    const expiresIn = 60 * 60 * 24 * 5 * 1000
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn })

    const cookieStore = await cookies()
    cookieStore.set('session', sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    })
  } catch (error: unknown) {
    console.error('Erro no login:', error)
    const message = error instanceof Error ? error.message : 'Erro ao realizar login'
    return { error: message }
  }

  revalidatePath('/', 'layout')
  // Mantemos redirect aqui porque o sucesso invalida a página inteira.
  redirect('/dashboard')
}

export type EmailAuthMethod = { hasPassword: boolean; hasGoogle: boolean }

/**
 * Verifica, ANTES de abrir o popup do Google, se o e-mail já tem uma conta
 * com senha. Usado pelo cliente para decidir se precisa pedir a senha atual
 * e vincular deliberadamente (linkWithPopup) em vez de deixar o
 * signInWithPopup decidir sozinho.
 *
 * Necessário porque este projeto Firebase tem a proteção de privacidade de
 * e-mail ativada ("Improved Email Privacy"), que faz o signInWithPopup NÃO
 * lançar mais o erro auth/account-exists-with-different-credential nesse
 * caso — em vez disso, ele autentica direto na conta existente e derruba o
 * provedor de senha, sem avisar. Pré-checar aqui evita essa troca.
 *
 * Não revela se a conta existe (mesmo retorno `false` para "não existe" e
 * "existe mas sem senha") — só o "true" positivo confirma existência, e
 * isso é inerente ao próprio fluxo de vinculação.
 */
export async function checkEmailAuthMethod(email: string): Promise<EmailAuthMethod> {
  const cleanEmail = (email || '').trim()
  if (!cleanEmail) return { hasPassword: false, hasGoogle: false }

  try {
    const user = await adminAuth.getUserByEmail(cleanEmail)
    const providerIds = user.providerData.map((p) => p.providerId)
    return {
      hasPassword: providerIds.includes('password'),
      hasGoogle: providerIds.includes('google.com'),
    }
  } catch {
    // Conta não existe (ou erro de rede) — cliente segue o fluxo normal do Google.
    return { hasPassword: false, hasGoogle: false }
  }
}

/**
 * Login via Google (idToken já obtido no cliente com signInWithPopup).
 *
 * Nunca cria usuário novo: só cria a sessão se já existir um perfil em
 * `profiles/{uid}` (provisionado por um admin em /dashboard/usuarios).
 * A vinculação de conta acontece no cliente ANTES desta função ser chamada
 * (ver checkEmailAuthMethod) — aqui só validamos e criamos a sessão.
 * Se for um e-mail realmente novo (sem perfil), o usuário do Auth que o
 * popup do Google acabou de criar é removido, para não sobrar cadastro
 * órfão no banco.
 */
export async function loginWithGoogle(idToken: string): Promise<LoginResult> {
  if (!idToken) {
    return { error: 'Token do Google inválido.' }
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken)

    const profileDoc = await adminDb.collection('profiles').doc(decoded.uid).get()
    if (!profileDoc.exists) {
      await adminAuth.deleteUser(decoded.uid).catch((err) => {
        console.error('Erro ao limpar conta Google não autorizada:', err)
      })
      return {
        error:
          'Esta conta Google ainda não tem acesso liberado. Peça a um administrador para cadastrar seu e-mail no sistema.',
      }
    }

    const expiresIn = 60 * 60 * 24 * 5 * 1000
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn })

    const cookieStore = await cookies()
    cookieStore.set('session', sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    })
  } catch (error: unknown) {
    console.error('Erro no login com Google:', error)
    return { error: 'Não foi possível autenticar com o Google. Tente novamente.' }
  }

  revalidatePath('/', 'layout')
  // Fora do try/catch: redirect() lança uma exceção de controle do Next.js.
  redirect('/dashboard')
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function requestPasswordReset(email: string): Promise<{ success?: string; error?: string }> {
  if (!email || !email.trim()) {
    return { error: 'Informe o seu endereço de e-mail.' }
  }

  const cleanEmail = email.trim()

  try {
    // Tenta gerar o link pelo adminAuth para log de desenvolvimento (facilita testes)
    try {
      const link = await adminAuth.generatePasswordResetLink(cleanEmail)
      console.log(`[PASSWORD RESET LINK for ${cleanEmail}]:`, link)
    } catch (adminErr) {
      console.warn('Erro ao gerar link admin (usuário pode não existir):', adminErr)
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: cleanEmail }),
      }
    )

    if (!res.ok) {
      const errorData = await res.json()
      const message = errorData.error?.message
      if (message === 'EMAIL_NOT_FOUND') {
        return { error: 'Não encontramos nenhuma conta vinculada a este e-mail.' }
      }
      if (message === 'INVALID_EMAIL') {
        return { error: 'Endereço de e-mail inválido.' }
      }
      return { error: 'Não foi possível enviar o e-mail de redefinição. Tente novamente mais tarde.' }
    }

    return { success: 'E-mail enviado! Verifique sua caixa de entrada e a pasta de SPAM / Lixo Eletrônico.' }
  } catch (error: unknown) {
    console.error('Erro na solicitação de recuperação de senha:', error)
    return { error: 'Erro de conexão. Verifique sua internet e tente novamente.' }
  }
}


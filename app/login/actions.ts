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

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('E-mail e senha são obrigatórios.'))
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    )

    if (!res.ok) {
      const errorData = await res.json()
      const message = errorData.error?.message || 'Erro ao cadastrar'
      let friendlyMessage = 'Erro ao realizar cadastro.'
      if (message === 'EMAIL_EXISTS') {
        friendlyMessage = 'Este e-mail já está cadastrado.'
      } else if (message === 'WEAK_PASSWORD') {
        friendlyMessage = 'A senha deve ter no mínimo 6 caracteres.'
      } else {
        friendlyMessage = message
      }
      redirect('/login?error=' + encodeURIComponent(friendlyMessage))
    }

    const { localId } = await res.json()

    await adminDb.collection('profiles').doc(localId).set({
      role: 'vendedor',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Erro no cadastro:', error)
    if (error.digest?.startsWith('NEXT_REDIRECT')) {
      throw error
    }
    redirect('/login?error=' + encodeURIComponent(error.message || 'Erro ao realizar cadastro'))
  }

  revalidatePath('/', 'layout')
  redirect('/login?message=Cadastro realizado com sucesso! Faça login para continuar.')
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  revalidatePath('/', 'layout')
  redirect('/login')
}

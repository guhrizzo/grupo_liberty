import { NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/utils/firebase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CODE_RE = /^[A-Za-z0-9_-]{20,64}$/
const SESSION_MS = 5 * 24 * 60 * 60 * 1000

/**
 * Troca um `code` de `device_logins` (gerado por criarCodigoDispositivo) por um
 * cookie de sessão `session`, no mesmo formato que `login`/`loginWithGoogle`
 * gravam. Chamado só pelo processo principal do app desktop (loopback).
 *
 * Sem rate-limit explícito: o `code` tem 256 bits (não é brute-forçável) e o
 * consumo é de uso único via transação. Abuso de volume fica com os limites da
 * plataforma.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { code?: unknown } | null
  const code = body?.code
  if (typeof code !== 'string' || !CODE_RE.test(code)) {
    return NextResponse.json({ error: 'Código inválido.' }, { status: 400 })
  }

  const ref = adminDb.collection('device_logins').doc(code)

  let uid: string
  try {
    uid = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const d = snap.data()
      const nowIso = new Date().toISOString()
      if (!snap.exists || !d || d.usedAt || String(d.expiresAt ?? '') < nowIso) {
        throw new Error('CODIGO_INVALIDO')
      }
      tx.update(ref, { usedAt: nowIso })
      return String(d.uid)
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'CODIGO_INVALIDO') {
      return NextResponse.json(
        { error: 'Código expirado ou já usado. Tente entrar de novo.' },
        { status: 400 },
      )
    }
    console.error('[desktop/exchange] transação:', err)
    return NextResponse.json({ error: 'Erro ao validar o código.' }, { status: 500 })
  }

  // Perfil tem que existir — nunca cria nem limpa usuário aqui.
  const profileSnap = await adminDb.collection('profiles').doc(uid).get()
  if (!profileSnap.exists) {
    return NextResponse.json({ error: 'Conta sem acesso liberado ao sistema.' }, { status: 403 })
  }

  try {
    const customToken = await adminAuth.createCustomToken(uid)

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      },
    )
    if (!r.ok) {
      console.error('[desktop/exchange] signInWithCustomToken:', await r.text())
      return NextResponse.json({ error: 'Não foi possível criar a sessão.' }, { status: 500 })
    }
    const { idToken } = (await r.json()) as { idToken: string }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_MS })

    const res = NextResponse.json({ ok: true })
    res.cookies.set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: SESSION_MS / 1000,
    })
    return res
  } catch (err) {
    console.error('[desktop/exchange] criação de sessão:', err)
    return NextResponse.json({ error: 'Erro ao criar a sessão.' }, { status: 500 })
  }
}

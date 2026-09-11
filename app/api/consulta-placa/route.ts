import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { consultarPlaca } from '@/utils/veiculos/consulta-placa'

// ─── Config ──────────────────────────────────────────────────────────────────

const ROLES_PERMITIDOS = ['admin', 'vendedor']

// ─── Handler ─────────────────────────────────────────────────────────────────
// A lógica de consulta (cache + Sistema Puxa Placa) mora em
// utils/veiculos/consulta-placa.ts, reaproveitada pela rota pública de
// /anuncie-seu-veiculo. Aqui só ficam a autenticação e o gate por role.

export async function GET(request: NextRequest) {
  // 1. Autenticação + autorização por role
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    const profileDoc = await adminDb.collection('profiles').doc(decoded.uid).get()
    const role = profileDoc.data()?.role ?? ''

    if (!ROLES_PERMITIDOS.includes(role)) {
      return NextResponse.json(
        { error: 'Acesso restrito a admins e vendedores.' },
        { status: 403 },
      )
    }
  } catch {
    return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  }

  // 2. Validar placa
  const searchParams = request.nextUrl.searchParams
  const placaRaw = searchParams.get('placa')

  if (!placaRaw) {
    return NextResponse.json({ error: 'Placa não informada.' }, { status: 400 })
  }

  // 3. Consultar (cache + Puxa Placa)
  const resultado = await consultarPlaca(placaRaw)

  if (!resultado.ok) {
    return NextResponse.json(
      resultado.code === 'token_missing'
        ? { error: 'token_missing', message: resultado.error }
        : { error: resultado.error },
      { status: resultado.status },
    )
  }

  return NextResponse.json(resultado.data)
}

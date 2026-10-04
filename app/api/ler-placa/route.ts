import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { lerPlacaComIA } from '@/utils/veiculos/ler-placa-ia'
import { temAcessoPagina, type PermissionKey } from '@/constants/permissoes'

// Mesmas abas que podem consultar placa (app/api/consulta-placa/route.ts).
const ABAS_PERMITIDAS: PermissionKey[] = ['veiculos', 'propostas', 'consulta_fipe']

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp']
// O navegador já reduz a foto (~1280px); isso só barra abuso.
const TAMANHO_MAX_BASE64 = 3_000_000

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    const profileDoc = await adminDb.collection('profiles').doc(decoded.uid).get()
    const { role, permissions } = profileDoc.data() ?? {}
    if (!ABAS_PERMITIDAS.some((aba) => temAcessoPagina(role, permissions, aba))) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { imagem?: unknown; tipo?: unknown } | null
  const imagem = typeof body?.imagem === 'string' ? body.imagem : ''
  const tipo = typeof body?.tipo === 'string' ? body.tipo : 'image/jpeg'
  if (!imagem || imagem.length > TAMANHO_MAX_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(imagem)) {
    return NextResponse.json({ error: 'Foto inválida.' }, { status: 400 })
  }
  if (!TIPOS_ACEITOS.includes(tipo)) {
    return NextResponse.json({ error: 'Formato de foto não suportado.' }, { status: 400 })
  }

  try {
    const r = await lerPlacaComIA(imagem, tipo)
    if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status })
    return NextResponse.json({ placa: r.placa })
  } catch (err) {
    console.error('[api/ler-placa]', err)
    return NextResponse.json({ error: 'Erro ao ler a placa.' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/utils/firebase/admin'

export interface PecaConsertoItem {
  nome: string
  valor: number
}

/**
 * GET /api/veiculos/[id]/pecas-conserto
 *
 * Retorna a lista consolidada de peças para conserto vindas das
 * manutenções do veículo (campo `pecasConserto` em cada manutenção,
 * exceto as canceladas). Deduplicado por nome (case-insensitive).
 *
 * Permissão: mesma gate da rota de PDF da proposta.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'ID do veículo inválido.' }, { status: 400 })
  }

  try {
    const sessionCookie = (await import('next/headers')).cookies
    const cookieStore = await sessionCookie()
    const session = cookieStore.get('session')?.value
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }
    await adminAuth.verifySessionCookie(session, true)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Acesso negado.'
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  const out: PecaConsertoItem[] = []
  try {
    const snap = await adminDb
      .collection('manutencoes')
      .where('veiculoId', '==', id)
      .get()
    const vistos = new Set<string>()
    snap.forEach((doc) => {
      const data = doc.data() as {
        pecasConserto?: unknown
        status?: string
      }
      if (data.status === 'cancelada') return
      if (!Array.isArray(data.pecasConserto)) return
      for (const item of data.pecasConserto) {
        if (!item || typeof item !== 'object') continue
        const obj = item as Record<string, unknown>
        const nome = String(obj.nome ?? '').trim()
        const valorNum =
          typeof obj.valor === 'number'
            ? obj.valor
            : obj.valor != null
              ? Number(obj.valor)
              : 0
        if (!nome) continue
        const key = nome.toLowerCase()
        if (vistos.has(key)) continue
        vistos.add(key)
        out.push({
          nome,
          valor: Number.isFinite(valorNum) && valorNum > 0 ? valorNum : 0,
        })
      }
    })
  } catch (err) {
    console.error('Erro ao buscar pecas do veiculo:', err)
    return NextResponse.json({ error: 'Erro ao buscar peças do veículo.' }, { status: 500 })
  }

  return NextResponse.json({ pecas: out })
}

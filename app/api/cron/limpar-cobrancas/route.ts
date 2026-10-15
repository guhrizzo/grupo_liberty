import { NextRequest, NextResponse } from 'next/server'
import { limparLixeiraCobrancas } from '@/utils/cobrancas/limpar-lixeira'

// ─── Cron diário: apagar cobranças na lixeira há mais de 60 dias ───────────
// A lógica de fato mora em utils/cobrancas/limpar-lixeira.ts. Aqui só cuidamos
// da autenticação do cron (CRON_SECRET, igual aos outros crons).

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const resultado = await limparLixeiraCobrancas()
    return NextResponse.json({ ok: true, ...resultado })
  } catch (err) {
    console.error('[cron/limpar-cobrancas]', err)
    return NextResponse.json({ ok: false, error: 'Erro ao limpar a lixeira.' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { limparVeiculosVendidos } from '@/utils/veiculos/limpar-vendidos'

// ─── Cron diário: apagar veículos vendidos há mais de 30 dias ──────────────
// A lógica de fato mora em utils/veiculos/limpar-vendidos.ts. Aqui só cuidamos
// da autenticação do cron.
//
// Protegido por CRON_SECRET — configurado no vercel.json como cron job e no
// header Authorization enviado automaticamente pela Vercel quando a env var
// CRON_SECRET está definida no projeto.

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const resultado = await limparVeiculosVendidos()
    return NextResponse.json({ ok: true, ...resultado })
  } catch (err) {
    console.error('[cron/limpar-vendidos]', err)
    return NextResponse.json({ ok: false, error: 'Erro ao limpar vendidos.' }, { status: 500 })
  }
}

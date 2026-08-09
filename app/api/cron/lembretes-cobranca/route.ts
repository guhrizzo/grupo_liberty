import { NextRequest, NextResponse } from 'next/server'
import { processarLembretesCobranca } from '@/utils/cobrancas/processar-lembretes'

// ─── Cron diário: "cobrar quando faltar X dias" ────────────────────────────
// A lógica de fato mora em utils/cobrancas/processar-lembretes.ts (também
// usada pelo botão manual "Testar lembretes agora" no dashboard). Aqui só
// cuidamos da autenticação do cron.
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
    const resultado = await processarLembretesCobranca()
    return NextResponse.json({ ok: true, ...resultado })
  } catch (err) {
    console.error('[cron/lembretes-cobranca]', err)
    return NextResponse.json({ ok: false, error: 'Erro ao processar lembretes.' }, { status: 500 })
  }
}

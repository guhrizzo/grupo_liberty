import { processarAvisosQuitacao } from '@/utils/quitacoes/avisos'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  return Response.json({ enviados: await processarAvisosQuitacao() })
}

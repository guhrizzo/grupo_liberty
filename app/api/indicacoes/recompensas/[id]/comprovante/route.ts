import { NextRequest } from 'next/server'
import { adminStorage } from '@/utils/firebase/admin'
import { assertPageAccess } from '@/utils/permissions'
import { ANEXO_TIPOS } from '@/app/dashboard/quitacoes/types'
import { comprovanteDaRecompensa } from '@/utils/indicacoes/servidor'

export const dynamic = 'force-dynamic'

/** Abre o comprovante de pagamento de uma recompensa (equipe com acesso a Indicações). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertPageAccess('indicacoes')
  } catch {
    return new Response('Acesso negado.', { status: 403 })
  }

  const { id } = await params
  if (!/^cpf_[a-f0-9]{64}$/.test(id)) return new Response('ID inválido.', { status: 400 })

  const caminho = await comprovanteDaRecompensa(id)
  const ext = caminho?.split('.').at(-1) ?? ''
  if (!caminho || !caminho.startsWith('indicacoes/comprovantes/') || !Object.hasOwn(ANEXO_TIPOS, ext)) {
    return new Response('Comprovante não encontrado.', { status: 404 })
  }

  try {
    const [buffer] = await adminStorage.bucket().file(caminho).download()
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': ANEXO_TIPOS[ext],
        'Content-Disposition': `inline; filename="comprovante-indicacao.${ext}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response('Comprovante não encontrado.', { status: 404 })
  }
}

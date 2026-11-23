import { adminStorage } from '@/utils/firebase/admin'
import { ANEXO_TAMANHO_MAX, ANEXO_TIPOS, TIPOS_ANEXO } from '@/app/dashboard/quitacoes/types'
import { obterDocumentoQuitacaoCliente } from '@/utils/quitacoes/portal'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ veiculoId: string; tipo: string }> }) {
  const { veiculoId, tipo } = await params
  const tipoAnexo = TIPOS_ANEXO.find(({ id }) => id === tipo)
  const indisponivel = () => new Response('Documento indisponível.', { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(veiculoId) || !tipoAnexo) return indisponivel()

  const documento = await obterDocumentoQuitacaoCliente(veiculoId, tipoAnexo.id)
  if (!documento || !(documento.tamanho > 0 && documento.tamanho <= ANEXO_TAMANHO_MAX)) return indisponivel()
  const ext = documento.path.split('.').at(-1) ?? ''
  if (!Object.hasOwn(ANEXO_TIPOS, ext) || ANEXO_TIPOS[ext] !== documento.contentType) return indisponivel()

  try {
    const [arquivo] = await adminStorage.bucket().file(documento.path).download()
    return new Response(new Uint8Array(arquivo), {
      headers: {
        'Content-Type': documento.contentType,
        'Content-Disposition': `attachment; filename="quitacao-${tipoAnexo.id}.${ext}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return indisponivel()
  }
}

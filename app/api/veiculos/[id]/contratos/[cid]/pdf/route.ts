import { NextRequest } from 'next/server'
import { adminDb, adminStorage } from '@/utils/firebase/admin'
import { assertPodeGerarContratos } from '@/utils/permissions'

export const dynamic = 'force-dynamic'

function sanitizeFilename(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-_ .]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 120) || 'contrato'
  )
}

/**
 * GET /api/veiculos/[id]/contratos/[cid]/pdf
 *
 * Serve o PDF de um contrato anexado ao veículo, com gate
 * `assertPodeGerarContratos` (admin OU permissions.contratos).
 *
 * Defesa contra tampering: valida que `doc.veiculoId === params.id`
 * antes de baixar do Storage.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> },
) {
  try {
    await assertPodeGerarContratos()
  } catch {
    return new Response('Acesso negado.', { status: 403 })
  }

  const { id: veiculoId, cid } = await params
  if (!veiculoId || !cid) {
    return new Response('ID inválido.', { status: 400 })
  }

  const docRef = adminDb.collection('veiculo_contratos').doc(cid)
  const doc = await docRef.get()

  if (!doc.exists) {
    return new Response('Contrato não encontrado.', { status: 404 })
  }

  const data = doc.data() as { veiculoId?: string; fileName?: string }
  if (data.veiculoId !== veiculoId) {
    return new Response('Acesso negado.', { status: 403 })
  }

  const bucket = adminStorage.bucket()
  const fileRef = bucket.file(`veiculos/${veiculoId}/contratos/${cid}.pdf`)

  const [exists] = await fileRef.exists()
  if (!exists) {
    return new Response('Arquivo de contrato não encontrado.', { status: 404 })
  }

  const [buffer] = await fileRef.download()
  const fileName = data.fileName ? sanitizeFilename(data.fileName) : 'contrato'

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

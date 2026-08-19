import { NextRequest } from 'next/server'
import { adminDb, adminStorage } from '@/utils/firebase/admin'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'

export const dynamic = 'force-dynamic'

function sanitizeFilename(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-_ .]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 120) || 'comprovante'
  )
}

/**
 * GET /api/financeiro/[id]/comprovante
 *
 * Serve o comprovante (PDF ou imagem) anexado a um lançamento financeiro.
 * Gate: mesmo acesso de leitura da página /dashboard/financeiro
 * (admin, vendedor ou advogado).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user || !hasPageAccess(user, 'financeiro', ['admin', 'vendedor', 'advogado'])) {
    return new Response('Acesso negado.', { status: 403 })
  }

  const { id: transacaoId } = await params
  if (!transacaoId) {
    return new Response('ID inválido.', { status: 400 })
  }

  const doc = await adminDb.collection('transacoes').doc(transacaoId).get()
  if (!doc.exists) {
    return new Response('Lançamento não encontrado.', { status: 404 })
  }

  const comprovante = doc.data()?.comprovante as
    | { fileName?: string; contentType?: string; storagePath?: string }
    | null
    | undefined
  if (!comprovante?.storagePath) {
    return new Response('Este lançamento não tem comprovante anexado.', { status: 404 })
  }

  const bucket = adminStorage.bucket()
  const fileRef = bucket.file(comprovante.storagePath)

  const [exists] = await fileRef.exists()
  if (!exists) {
    return new Response('Arquivo não encontrado.', { status: 404 })
  }

  const [buffer] = await fileRef.download()
  const fileName = comprovante.fileName ? sanitizeFilename(comprovante.fileName) : 'comprovante'
  const contentType = comprovante.contentType || 'application/octet-stream'

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

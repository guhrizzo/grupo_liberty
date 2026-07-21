import { NextRequest } from 'next/server'
import { adminStorage } from '@/utils/firebase/admin'
import { assertPodeGerarContratos } from '@/utils/permissions'

export const dynamic = 'force-dynamic'

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'contrato'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertPodeGerarContratos()
  } catch {
    return new Response('Acesso negado.', { status: 403 })
  }

  const { id } = await params
  if (!id) return new Response('ID inválido.', { status: 400 })

  const bucket = adminStorage.bucket()
  const fileRef = bucket.file(`contratos/${id}.pdf`)

  const [exists] = await fileRef.exists()
  if (!exists) {
    return new Response('Contrato não encontrado.', { status: 404 })
  }

  const [buffer] = await fileRef.download()
  const meta = (await fileRef.getMetadata())[0]
  const metadata = (meta.metadata ?? {}) as { clienteNome?: string }
  const clienteNome = metadata.clienteNome
    ? sanitizeFilename(metadata.clienteNome)
    : id

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="contrato_${clienteNome}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

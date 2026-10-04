import { NextRequest } from 'next/server'
import { adminDb, adminStorage } from '@/utils/firebase/admin'
import { assertPageAccess } from '@/utils/permissions'

export const dynamic = 'force-dynamic'

/** Nome do arquivo baixado = nome do modelo, sem acento nem símbolo. */
function nomeArquivo(nome: string, extensao: string): string {
  const base =
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 80) || 'modelo'
  return `${base}.${extensao}`
}

/** Download de um modelo de contrato (quem tem acesso à aba Contratos). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertPageAccess('contratos')
  } catch {
    return new Response('Acesso negado.', { status: 403 })
  }

  const { id } = await params
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) return new Response('ID inválido.', { status: 400 })

  const doc = await adminDb.collection('contrato_modelos').doc(id).get()
  if (!doc.exists) return new Response('Modelo não encontrado.', { status: 404 })
  const d = doc.data() ?? {}

  const fileRef = adminStorage.bucket().file(String(d.storagePath ?? ''))
  const [existe] = await fileRef.exists()
  if (!existe) return new Response('Arquivo não encontrado.', { status: 404 })

  const [buffer] = await fileRef.download()
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': String(d.contentType || 'application/octet-stream'),
      'Content-Disposition': `attachment; filename="${nomeArquivo(String(d.nome ?? ''), String(d.extensao ?? 'pdf'))}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

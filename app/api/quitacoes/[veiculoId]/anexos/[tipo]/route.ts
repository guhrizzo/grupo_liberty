import { NextRequest } from 'next/server'
import { adminDb, adminStorage } from '@/utils/firebase/admin'
import { assertPageAccess } from '@/utils/permissions'
import { TIPOS_ANEXO } from '@/app/dashboard/quitacoes/types'

export const dynamic = 'force-dynamic'

function nomeArquivo(nome: string): string {
  return (
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-_ .]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 120) || 'contrato'
  )
}

/** Abre o contrato anexado a um veículo da aba Quitações (mesmo acesso da aba Veículos). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ veiculoId: string; tipo: string }> },
) {
  try {
    await assertPageAccess('veiculos')
  } catch {
    return new Response('Acesso negado.', { status: 403 })
  }

  const { veiculoId, tipo } = await params
  if (!/^[A-Za-z0-9_-]+$/.test(veiculoId) || !TIPOS_ANEXO.some((t) => t.id === tipo)) {
    return new Response('ID inválido.', { status: 400 })
  }

  const doc = await adminDb.collection('quitacao_anexos').doc(`${veiculoId}_${tipo}`).get()
  if (!doc.exists) return new Response('Contrato não encontrado.', { status: 404 })
  const d = doc.data() ?? {}

  const fileRef = adminStorage.bucket().file(String(d.storagePath ?? ''))
  const [existe] = await fileRef.exists()
  if (!existe) return new Response('Arquivo não encontrado.', { status: 404 })

  const [buffer] = await fileRef.download()
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': String(d.contentType || 'application/octet-stream'),
      'Content-Disposition': `inline; filename="${nomeArquivo(String(d.fileName ?? ''))}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

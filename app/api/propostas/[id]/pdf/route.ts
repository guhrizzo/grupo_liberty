import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { assertPodeGerarPropostaPDF } from '@/utils/permissions'
import PropostaDocument from '@/app/dashboard/propostas/pdf/PropostaDocument'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Autenticação e autorização
  try {
    await assertPodeGerarPropostaPDF()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Acesso negado.'
    return new NextResponse(msg, { status: 401 })
  }

  const { id } = await params

  if (!id) {
    return new NextResponse('ID da proposta inválido.', { status: 400 })
  }

  // 2. Buscar proposta no Firestore
  const propostaDoc = await adminDb.collection('propostas').doc(id).get()

  if (!propostaDoc.exists) {
    return new NextResponse('Proposta não encontrada.', { status: 404 })
  }

  const proposta = propostaDoc.data() as {
    status: string
    veiculo_id: string
    user_id: string
    valor: number | null
    mensagem: string
    created_at: string
    updated_at?: string
  }

  // 3. Apenas propostas aceitas podem gerar PDF
  if (proposta.status !== 'aceito') {
    return new NextResponse(
      'Apenas propostas aceitas podem ter PDF gerado.',
      { status: 422 }
    )
  }

  // 4. Buscar dados do veículo
  let veiculoMarca = 'N/A'
  let veiculoModelo = 'N/A'
  let veiculoPrecoSugerido: number | null = null

  if (proposta.veiculo_id) {
    const veiculoDoc = await adminDb.collection('veiculos').doc(proposta.veiculo_id).get()
    if (veiculoDoc.exists) {
      const v = veiculoDoc.data() as { marca?: string; modelo?: string; preco?: number }
      veiculoMarca = v.marca ?? 'N/A'
      veiculoModelo = v.modelo ?? 'N/A'
      veiculoPrecoSugerido = v.preco ?? null
    }
  }

  // 5. Buscar nome e e-mail do cliente via Firebase Auth
  let clienteNome = 'Cliente'
  let clienteEmail = 'N/A'

  if (proposta.user_id) {
    try {
      const authUser = await adminAuth.getUser(proposta.user_id)
      clienteNome = authUser.displayName || 'Cliente'
      clienteEmail = authUser.email || 'N/A'
    } catch {
      // usuário removido — mantém defaults
    }
  }

  // 6. Gerar o PDF
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    createElement(PropostaDocument, {
      id,
      clienteNome,
      clienteEmail,
      veiculoMarca,
      veiculoModelo,
      veiculoPrecoSugerido,
      valorOfertado: proposta.valor,
      mensagem: proposta.mensagem,
      criadoEm: proposta.created_at,
      aceitoEm: proposta.updated_at ?? proposta.created_at,
    }) as any
  )

  // Converte Buffer para Uint8Array (compatível com NextResponse BodyInit)
  const uint8 = new Uint8Array(buffer)

  // 7. Retornar o PDF como download
  const fileName = `proposta-${id}.pdf`

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(uint8.byteLength),
    },
  })
}

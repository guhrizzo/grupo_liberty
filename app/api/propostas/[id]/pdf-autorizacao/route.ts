import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import type * as ReactPDF from '@react-pdf/renderer'
import { createElement } from 'react'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { assertPodeGerarPropostaPDF } from '@/utils/permissions'
import PropostaAutorizacaoDocument, {
  type PropostaAutorizacaoDocumentProps,
} from '@/app/dashboard/propostas/pdf/PropostaAutorizacaoDocument'
import { decrypt } from '@/utils/crypto'
import { maskCPFCNPJ } from '@/utils/masks'

/**
 * GET /api/propostas/[id]/pdf-autorizacao
 *
 * Gera um PDF de "Proposta Liberty Car" (estilo modelo Python) para conferência
 * e autorização. Aceita query params opcionais:
 *
 *   - proposta_comercial=<numero>  → atualiza Firestore e usa como valor principal
 *   - condicoes=<texto>             → atualiza Firestore e usa como "Condições e Garantias"
 *
 * Diferentemente da rota `/api/propostas/[id]/pdf`:
 * - NÃO exige status 'aceito'.
 * - A atualização dos campos de query é a única alteração de estado.
 * - NÃO dispara e-mail.
 *
 * Permissão: admin ou vendedor (mesmo gate da rota de PDF original).
 */
export async function GET(
  req: NextRequest,
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

  // 2. Parse de query params (textuais — podem vir vazios)
  const url = new URL(req.url)
  const propostaComercialRaw = url.searchParams.get('proposta_comercial')
  const condicoesRaw = url.searchParams.get('condicoes')

  // 3. Buscar proposta no Firestore
  const propostaDoc = await adminDb.collection('propostas').doc(id).get()
  if (!propostaDoc.exists) {
    return new NextResponse('Proposta não encontrada.', { status: 404 })
  }

  const proposta = propostaDoc.data() as {
    status: string
    veiculo_id: string
    user_id: string | null
    valor: number | null
    proposta_comercial?: number | null
    condicoes?: string | null
    mensagem: string
    nome?: string
    cpf?: string
    email?: string
    telefone?: string
    observacoes_internas?: string
    created_at: string
  }

  // 4. Persistir (se vierem) os campos de query — atualização direta, leve
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  let hasUpdate = false

  if (propostaComercialRaw !== null) {
    const trimmed = propostaComercialRaw.trim()
    if (trimmed === '') {
      update.proposta_comercial = null
      hasUpdate = true
    } else {
      // Remove pontos de milhar (formato BR) e troca vírgula decimal por ponto
      const normalized = trimmed.replace(/\./g, '').replace(',', '.')
      const parsed = parseFloat(normalized)
      if (!Number.isNaN(parsed) && parsed >= 0) {
        update.proposta_comercial = parsed
        hasUpdate = true
      }
    }
  }

  if (condicoesRaw !== null) {
    update.condicoes = condicoesRaw
    hasUpdate = true
  }

  if (hasUpdate) {
    try {
      await adminDb.collection('propostas').doc(id).update(update)
    } catch (err) {
      console.error('[pdf-autorizacao] Falha ao persistir campos de query:', err)
      // continuamos — geração do PDF não é bloqueada
    }
  }

  // 5. Buscar dados do veículo (campos financeiros estendidos)
  let veiculoMarca = 'N/A'
  let veiculoModelo = 'N/A'
  let veiculoAno: number | null = null
  let veiculoPlaca: string | null = null
  let veiculoPrecoSugerido: number | null = null
  let veiculoValorFipe: number | null = null
  const parcelasTotais: number | null = null
  const parcelasPagas: number | null = null
  let parcelasAtrasadas: number | null = null
  let valorParcela: number | null = null
  let dividaTotal: number | null = null
  let custoAcumulado: number | null = null
  let banco: string | null = null

  if (proposta.veiculo_id) {
    try {
      const veiculoDoc = await adminDb.collection('veiculos').doc(proposta.veiculo_id).get()
      if (veiculoDoc.exists) {
        const v = veiculoDoc.data() as {
          marca?: string
          modelo?: string
          ano?: number | null
          placa?: string | null
          preco?: number | null
          tabelaFipe?: number | null
          valorParcela?: number | null
          custoAcumulado?: number | null
          debitos?: number | null
          parcelasRestantes?: number | null
          banco?: string | null
        }
        veiculoMarca = v.marca ?? 'N/A'
        veiculoModelo = v.modelo ?? 'N/A'
        veiculoAno = v.ano ?? null
        veiculoPlaca = v.placa ?? null
        veiculoPrecoSugerido = v.preco ?? null
        veiculoValorFipe = v.tabelaFipe ?? null
        valorParcela = v.valorParcela ?? null
        custoAcumulado = v.custoAcumulado ?? null
        dividaTotal = v.debitos ?? null
        banco = v.banco ?? null
        parcelasAtrasadas = v.parcelasRestantes ?? null
      }
    } catch {
      // veículo removido — mantém defaults
    }
  }

  // 6. Resolver nome, e-mail, telefone e CPF do cliente
  let clienteNome = proposta.nome || 'Cliente'
  let clienteEmail = proposta.email || 'N/A'
  let clienteTelefone: string | null = proposta.telefone ?? null
  
  // Descriptografar CPF se ele existir no Firestore
  let clienteCpf: string | null = null
  if (proposta.cpf) {
    const rawCpf = decrypt(proposta.cpf)
    if (rawCpf) {
      clienteCpf = maskCPFCNPJ(rawCpf)
    }
  }

  if (proposta.user_id) {
    try {
      const authUser = await adminAuth.getUser(proposta.user_id)
      clienteNome = proposta.nome || authUser.displayName || clienteNome
      if (!proposta.email) clienteEmail = authUser.email || clienteEmail
      if (!clienteTelefone && authUser.phoneNumber) clienteTelefone = authUser.phoneNumber
    } catch {
      // usuário removido — mantém dados da proposta
    }
  }

  // Calcular saldo devedor = valorParcela * parcelasAtrasadas
  const saldoDevedor =
    valorParcela != null && parcelasAtrasadas != null
      ? valorParcela * parcelasAtrasadas
      : null

  // Valor final da proposta comercial (query > firestore > ofertado)
  const propostaComercialFinal =
    (update.proposta_comercial as number | null) ??
    proposta.proposta_comercial ??
    null

  // 7. Gerar o PDF
  const docProps: PropostaAutorizacaoDocumentProps = {
    id,
    clienteNome,
    clienteCpf,
    clienteEmail,
    clienteTelefone,
    veiculoMarca,
    veiculoModelo,
    veiculoAno,
    veiculoPlaca,
    veiculoPrecoSugerido,
    veiculoValorFipe,
    parcelasTotais,
    parcelasPagas,
    parcelasAtrasadas,
    valorParcela,
    saldoDevedor,
    dividaTotal,
    custoAcumulado,
    banco,
    propostaComercial: propostaComercialFinal,
    valorOfertado: proposta.valor,
    mensagem: proposta.mensagem,
    statusProposta: proposta.status,
    criadoEm: proposta.created_at,
    observacoesInternas: proposta.observacoes_internas ?? null,
    condicoes: condicoesRaw ?? proposta.condicoes ?? null,
  }

  // O cast resolve a divergência de tipos entre createElement (tipa pelos props
  // do componente) e renderToBuffer (espera ReactElement<DocumentProps>).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(PropostaAutorizacaoDocument as any, docProps) as React.ReactElement<ReactPDF.DocumentProps>
  const buffer = await renderToBuffer(element)

  const uint8 = new Uint8Array(buffer)
  const fileName = `autorizacao-proposta-${id}.pdf`

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(uint8.byteLength),
    },
  })
}

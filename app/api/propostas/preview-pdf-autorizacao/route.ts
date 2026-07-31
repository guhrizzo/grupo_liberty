import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import type * as ReactPDF from '@react-pdf/renderer'
import { createElement } from 'react'
import type React from 'react'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { assertPodeGerarPropostaPDF } from '@/utils/permissions'
import PropostaAutorizacaoDocument, {
  type PropostaAutorizacaoDocumentProps,
} from '@/app/dashboard/propostas/pdf/PropostaAutorizacaoDocument'
import { maskCPFCNPJ } from '@/utils/masks'

interface PecaConserto {
  nome: string
  valor: number
}

function parsePecasManuais(value: unknown): PecaConserto[] {
  if (!value) return []
  let raw: unknown = value
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(raw)) return []
  const out: PecaConserto[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const nome = String(obj.nome ?? '').trim()
    const valorNum =
      typeof obj.valor === 'number'
        ? obj.valor
        : obj.valor != null
          ? Number(obj.valor)
          : 0
    if (!nome) continue
    out.push({ nome, valor: Number.isFinite(valorNum) ? valorNum : 0 })
  }
  return out
}

/**
 * POST /api/propostas/preview-pdf-autorizacao
 *
 * Gera o PDF de autorização a partir de dados brutos enviados no body,
 * SEM persistir a proposta no Firestore.
 *
 * Body (JSON):
 *   - veiculo_id (obrigatório)
 *   - nome, cpf, telefone, email (cliente)
 *   - valor (number | null)
 *   - mensagem
 *   - status (default "pendente")
 *
 * Permissão: mesma da rota de PDF (`assertPodeGerarPropostaPDF`).
 */
export async function POST(req: NextRequest) {
  try {
    await assertPodeGerarPropostaPDF()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Acesso negado.'
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Body inválido (esperado JSON).' }, { status: 400 })
  }

  const veiculo_id = String(body.veiculo_id ?? '').trim()
  const nome = String(body.nome ?? '').trim()
  const email = String(body.email ?? '').trim()
  const telefone = String(body.telefone ?? '').trim()
  const mensagem = String(body.mensagem ?? '').trim()
  const status = String(body.status ?? 'pendente')
  const cpfRaw = String(body.cpf ?? '').replace(/\D/g, '')
  const valorNum =
    typeof body.valor === 'number'
      ? body.valor
      : body.valor != null
        ? Number(body.valor)
        : null

  // Peças informadas manualmente no formulário (opcional).
  const pecasConsertoManual = parsePecasManuais(body.pecasConserto)

  if (!veiculo_id) {
    return NextResponse.json({ error: 'veiculo_id é obrigatório.' }, { status: 400 })
  }
  if (!nome) {
    return NextResponse.json({ error: 'nome é obrigatório.' }, { status: 400 })
  }

  // Buscar veículo
  let veiculoMarca = 'N/A'
  let veiculoModelo = 'N/A'
  let veiculoAno: number | null = null
  let veiculoPlaca: string | null = null
  let veiculoPrecoSugerido: number | null = null
  let veiculoValorFipe: number | null = null
  let valorParcela: number | null = null
  let dividaTotal: number | null = null
  let custoAcumulado: number | null = null
  let parcelasAtrasadas: number | null = null
  let banco: string | null = null

  try {
    const veiculoDoc = await adminDb.collection('veiculos').doc(veiculo_id).get()
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
    // segue com defaults
  }

  // Resolver dados do cliente a partir de token, se houver
  let clienteNome = nome
  let clienteEmail = email || 'N/A'
  let clienteTelefone: string | null = telefone || null
  let clienteCpf: string | null = cpfRaw ? maskCPFCNPJ(cpfRaw) : null

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const idToken = authHeader.slice('Bearer '.length).trim()
    try {
      const decoded = await adminAuth.verifyIdToken(idToken)
      const authUser = await adminAuth.getUser(decoded.uid)
      if (!clienteNome && authUser.displayName) clienteNome = authUser.displayName
      if (!email && authUser.email) clienteEmail = authUser.email
      if (!clienteTelefone && authUser.phoneNumber) clienteTelefone = authUser.phoneNumber
    } catch {
      // ignora — usa dados do body
    }
  }

  const saldoDevedor =
    valorParcela != null && parcelasAtrasadas != null
      ? valorParcela * parcelasAtrasadas
      : null

  // Coletar peças para conserto das manutenções do veículo (somente concluídas/em execução).
  const pecasConserto: PecaConserto[] = []
  if (veiculo_id) {
    try {
      const snap = await adminDb
        .collection('manutencoes')
        .where('veiculoId', '==', veiculo_id)
        .get()
      const vistos = new Set<string>()
      snap.forEach((doc) => {
        const data = doc.data() as {
          pecasConserto?: unknown
          descricao?: string | null
          status?: string
        }
        // Ignora manutenções canceladas
        if (data.status === 'cancelada') return
        if (Array.isArray(data.pecasConserto)) {
          for (const item of data.pecasConserto) {
            if (!item || typeof item !== 'object') continue
            const obj = item as Record<string, unknown>
            const nome = String(obj.nome ?? '').trim()
            const valorNum =
              typeof obj.valor === 'number'
                ? obj.valor
                : obj.valor != null
                  ? Number(obj.valor)
                  : 0
            if (!nome) continue
            const key = `${nome}`.toLowerCase()
            if (vistos.has(key)) continue
            vistos.add(key)
            pecasConserto.push({
              nome,
              valor: Number.isFinite(valorNum) ? valorNum : 0,
            })
          }
        }
      })
    } catch (err) {
      console.error('Falha ao buscar peças das manutenções:', err)
    }
  }
  // Adiciona peças manuais (submetidas no formulário de nova proposta).
  for (const p of pecasConsertoManual) {
    const key = p.nome.toLowerCase()
    if (!pecasConserto.some((x) => x.nome.toLowerCase() === key)) {
      pecasConserto.push(p)
    }
  }

  const rascunhoId = `PREVIEW-${Date.now().toString(36).toUpperCase()}`

  const docProps: PropostaAutorizacaoDocumentProps = {
    id: rascunhoId,
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
    parcelasTotais: null,
    parcelasPagas: null,
    parcelasAtrasadas,
    valorParcela,
    saldoDevedor,
    dividaTotal,
    custoAcumulado,
    banco,
    propostaComercial: valorNum,
    valorOfertado: valorNum,
    mensagem,
    statusProposta: status,
    pecasConserto,
    criadoEm: new Date().toISOString(),
    observacoesInternas: null,
    condicoes: null,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(PropostaAutorizacaoDocument as any, docProps) as React.ReactElement<ReactPDF.DocumentProps>
  const buffer = await renderToBuffer(element)

  const uint8 = new Uint8Array(buffer)
  const fileName = `autorizacao-rascunho-${rascunhoId}.pdf`

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(uint8.byteLength),
    },
  })
}

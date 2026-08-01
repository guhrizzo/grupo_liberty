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

function numFromAny(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const cleaned = v.replace(/\./g, '').replace(',', '.').trim()
    if (!cleaned) return null
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function intFromAny(v: unknown): number | null {
  const n = numFromAny(v)
  return n == null ? null : Math.round(n)
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

/**
 * POST /api/propostas/preview-pdf-autorizacao
 *
 * Gera o PDF de autorização a partir de dados brutos enviados no body,
 * SEM persistir a proposta no Firestore.
 *
 * Aceita dois modos:
 * 1. **Livre**: o cliente envia TODOS os campos do veículo/financeiro/pendências
 *    diretamente no body. Não exige `veiculo_id`.
 * 2. **Veículo do estoque**: envia `veiculo_id` e o backend hidrata os demais
 *    dados financeiros a partir de Firestore (retrocompatibilidade).
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

  // ─────────────── Cliente ───────────────
  const nome = String(body.nome ?? '').trim()
  const email = String(body.email ?? '').trim()
  const telefone = String(body.telefone ?? '').trim()
  const mensagem = String(body.mensagem ?? '').trim()
  const status = String(body.status ?? 'pendente')
  const cpfRaw = String(body.cpf ?? '').replace(/\D/g, '')
  const clienteData = strOrNull(body.cliente_data) ?? strOrNull(body.data)
  const numeroContrato = strOrNull(body.numero_contrato)
  const propostaPreviaNum = numFromAny(body.proposta_previa)
  const condicoes = strOrNull(body.condicoes)
  const valorNum = numFromAny(body.valor) ?? numFromAny(body.proposta_comercial)

  // Peças manuais (opcional)
  const pecasConsertoManual = parsePecasManuais(body.pecasConserto)

  // ─────────────── Veículo + Financeiro ───────────────
  // Pode vir tanto pelo estoque (veiculo_id) quanto por digitação livre.
  const veiculo_id = String(body.veiculo_id ?? '').trim()

  let veiculoMarca = strOrNull(body.veiculo_marca) ?? 'N/A'
  let veiculoModelo = strOrNull(body.veiculo_modelo) ?? 'N/A'
  let veiculoAno = intFromAny(body.veiculo_ano)
  let veiculoPlaca = strOrNull(body.veiculo_placa)
  let veiculoPrecoSugerido = numFromAny(body.veiculo_preco_sugerido)
  let veiculoValorFipe = numFromAny(body.veiculo_valor_fipe)
  const valorEstimadoDivida = numFromAny(body.valor_estimado_divida)
  let valorParcela = numFromAny(body.valor_parcela)
  let dividaTotal: number | null = null
  let custoAcumulado: number | null = null
  const parcelasTotais: number | null = intFromAny(body.parcelas_totais)
  const parcelasPagas: number | null = intFromAny(body.parcelas_pagas)
  let parcelasAtrasadas: number | null = intFromAny(body.parcelas_atrasadas)
  let banco: string | null = strOrNull(body.banco)
  const valorIpva = numFromAny(body.valor_ipva)
  const valorLicenciamento = numFromAny(body.valor_licenciamento)
  const valorMultas = numFromAny(body.valor_multas)
  let debitosItensPdf: Array<{ chave: string; label: string; valor: number }> = []

  // Se veio veiculo_id, sobrescreve com dados do Firestore (modo estoque).
  if (veiculo_id) {
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
          debitosItens?: Array<{ chave: string; valor: number; label?: string | null }> | null
          parcelasRestantes?: number | null
          banco?: string | null
        }
        if (!veiculoMarca || veiculoMarca === 'N/A') veiculoMarca = v.marca ?? 'N/A'
        if (!veiculoModelo || veiculoModelo === 'N/A') veiculoModelo = v.modelo ?? 'N/A'
        if (veiculoAno == null) veiculoAno = v.ano ?? null
        if (!veiculoPlaca) veiculoPlaca = v.placa ?? null
        if (veiculoPrecoSugerido == null) veiculoPrecoSugerido = v.preco ?? null
        if (veiculoValorFipe == null) veiculoValorFipe = v.tabelaFipe ?? null
        if (valorParcela == null) valorParcela = v.valorParcela ?? null
        if (custoAcumulado == null) custoAcumulado = v.custoAcumulado ?? null
        dividaTotal = v.debitos ?? null
        if (!banco) banco = v.banco ?? null
        if (parcelasAtrasadas == null) parcelasAtrasadas = v.parcelasRestantes ?? null
        if (Array.isArray(v.debitosItens) && v.debitosItens.length > 0) {
          debitosItensPdf = v.debitosItens
            .filter((d) => Number(d.valor) > 0)
            .map((d) => ({
              chave: String(d.chave),
              label: d.label ? String(d.label) : String(d.chave),
              valor: Number(d.valor) || 0,
            }))
        }
      }
    } catch {
      // segue com os valores já preenchidos
    }
  }

  // ─────────────── Identidade do cliente ───────────────
  let clienteNome = nome
  let clienteEmail = email || 'N/A'
  let clienteTelefone: string | null = telefone || null
  const clienteCpf: string | null = cpfRaw ? maskCPFCNPJ(cpfRaw) : null

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

  // Se não veio cliente mas veio nome no body, usa
  if (!clienteNome && clienteEmail && clienteEmail !== 'N/A') {
    clienteNome = clienteEmail
  }

  // Saldo devedor = valorParcela * parcelasAtrasadas (se aplicável)
  const saldoDevedor =
    valorParcela != null && parcelasAtrasadas != null
      ? valorParcela * parcelasAtrasadas
      : null

  // Coletar peças de manutenções (se houver veiculo_id)
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
          status?: string
        }
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
            const key = nome.toLowerCase()
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
    numeroContrato,
    clienteNome,
    clienteCpf,
    clienteEmail,
    clienteTelefone,
    clienteData,
    veiculoMarca,
    veiculoModelo,
    veiculoAno,
    veiculoPlaca,
    veiculoPrecoSugerido,
    veiculoValorFipe,
    valorEstimadoDivida,
    parcelasTotais,
    parcelasPagas,
    parcelasAtrasadas,
    valorParcela,
    saldoDevedor,
    dividaTotal,
    custoAcumulado,
    valorIpva: valorIpva ?? undefined,
    valorLicenciamento: valorLicenciamento ?? undefined,
    valorMultas: valorMultas ?? undefined,
    banco,
    debitosItens: debitosItensPdf,
    propostaComercial: valorNum,
    valorOfertado: valorNum,
    mensagem,
    statusProposta: status,
    pecasConserto,
    criadoEm: new Date().toISOString(),
    observacoesInternas: null,
    condicoes,
    propostaPrevia: propostaPreviaNum,
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

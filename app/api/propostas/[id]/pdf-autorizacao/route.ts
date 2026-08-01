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

function strOrNull(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

/**
 * GET /api/propostas/[id]/pdf-autorizacao
 *
 * Gera um PDF de "Proposta Liberty Car" para conferência e autorização.
 * Aceita query params opcionais:
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
  try {
    await assertPodeGerarPropostaPDF()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Acesso negado.'
    return new NextResponse(msg, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return new NextResponse('ID da proposta inválida.', { status: 400 })
  }

  // Parse de query params
  const url = new URL(req.url)
  const propostaComercialRaw = url.searchParams.get('proposta_comercial')
  const condicoesRaw = url.searchParams.get('condicoes')

  // Buscar proposta no Firestore
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
    // Novos campos (todos opcionais para retrocompatibilidade):
    numero_contrato?: string | null
    cliente_data?: string | null
    veiculo_marca?: string | null
    veiculo_modelo?: string | null
    veiculo_ano?: number | null
    veiculo_placa?: string | null
    veiculo_valor_fipe?: number | null
    valor_estimado_divida?: number | null
    valor_ipva?: number | null
    valor_licenciamento?: number | null
    valor_multas?: number | null
    valor_parcela?: number | null
    parcelas_totais?: number | null
    parcelas_pagas?: number | null
    parcelas_atrasadas?: number | null
    pecas_conserto?: Array<{ nome: string; valor: number }> | null
    proposta_previa?: number | null
    banco?: string | null
  }

  // Atualização leve via query
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  let hasUpdate = false

  if (propostaComercialRaw !== null) {
    const trimmed = propostaComercialRaw.trim()
    if (trimmed === '') {
      update.proposta_comercial = null
      hasUpdate = true
    } else {
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
    }
  }

  // ───── Buscar dados do veículo (opcional, retrocompatibilidade) ─────
  let veiculoMarca = strOrNull(proposta.veiculo_marca) ?? 'N/A'
  let veiculoModelo = strOrNull(proposta.veiculo_modelo) ?? 'N/A'
  let veiculoAno: number | null = proposta.veiculo_ano ?? null
  let veiculoPlaca: string | null = strOrNull(proposta.veiculo_placa)
  let veiculoPrecoSugerido: number | null = null
  let veiculoValorFipe: number | null = proposta.veiculo_valor_fipe ?? null
  const valorEstimadoDivida: number | null = proposta.valor_estimado_divida ?? null
  let valorParcela: number | null = proposta.valor_parcela ?? null
  const parcelasTotais: number | null = proposta.parcelas_totais ?? null
  const parcelasPagas: number | null = proposta.parcelas_pagas ?? null
  let parcelasAtrasadas: number | null = proposta.parcelas_atrasadas ?? null
  let dividaTotal: number | null = null
  let custoAcumulado: number | null = null
  let banco: string | null = strOrNull(proposta.banco)

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
        if (veiculoMarca === 'N/A') veiculoMarca = v.marca ?? 'N/A'
        if (veiculoModelo === 'N/A') veiculoModelo = v.modelo ?? 'N/A'
        if (veiculoAno == null) veiculoAno = v.ano ?? null
        if (!veiculoPlaca) veiculoPlaca = v.placa ?? null
        veiculoPrecoSugerido = v.preco ?? null
        if (veiculoValorFipe == null) veiculoValorFipe = v.tabelaFipe ?? null
        if (valorParcela == null) valorParcela = v.valorParcela ?? null
        if (custoAcumulado == null) custoAcumulado = v.custoAcumulado ?? null
        dividaTotal = v.debitos ?? null
        if (!banco) banco = v.banco ?? null
        if (parcelasAtrasadas == null) parcelasAtrasadas = v.parcelasRestantes ?? null
      }
    } catch {
      // veículo removido — mantém dados salvos na proposta
    }
  }

  // ───── Identidade do cliente ─────
  let clienteNome = proposta.nome || 'Cliente'
  let clienteEmail = proposta.email || 'N/A'
  let clienteTelefone: string | null = proposta.telefone ?? null
  const clienteData: string | null = strOrNull(proposta.cliente_data) ?? strOrNull(proposta.created_at)
  const numeroContrato: string | null = strOrNull(proposta.numero_contrato)

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

  const saldoDevedor =
    valorParcela != null && parcelasAtrasadas != null
      ? valorParcela * parcelasAtrasadas
      : null

  const valorIpva = proposta.valor_ipva ?? null
  const valorLicenciamento = proposta.valor_licenciamento ?? null
  const valorMultas = proposta.valor_multas ?? null

  // Peças: priorizar array salvo na proposta; cair pra manutenções se houver veículo
  const pecasConserto: { nome: string; valor: number }[] = []
  if (Array.isArray(proposta.pecas_conserto)) {
    for (const p of proposta.pecas_conserto) {
      if (!p || typeof p !== 'object') continue
      const nome = String(p.nome ?? '').trim()
      const valorNum = Number(p.valor)
      if (!nome) continue
      pecasConserto.push({ nome, valor: Number.isFinite(valorNum) ? valorNum : 0 })
    }
  }
  if (pecasConserto.length === 0 && proposta.veiculo_id) {
    try {
      const snap = await adminDb
        .collection('manutencoes')
        .where('veiculoId', '==', proposta.veiculo_id)
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
      console.error('[pdf-autorizacao] Falha ao buscar peças das manutenções:', err)
    }
  }

  // Débitos estruturados (se houver)
  let debitosItensPdf: Array<{ chave: string; label: string; valor: number }> = []
  if (proposta.veiculo_id) {
    try {
      const vehDoc = await adminDb.collection('veiculos').doc(proposta.veiculo_id).get()
      if (vehDoc.exists) {
        const v = vehDoc.data() as {
          debitosItens?: Array<{ chave: string; valor: number; label?: string | null }> | null
        }
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
    } catch (err) {
      console.error('[pdf-autorizacao] Falha ao buscar débitos do veículo:', err)
    }
  }

  const propostaComercialFinal =
    (update.proposta_comercial as number | null) ??
    proposta.proposta_comercial ??
    null

  const propostaPreviaNum: number | null =
    proposta.proposta_previa != null && Number.isFinite(proposta.proposta_previa) && proposta.proposta_previa > 0
      ? proposta.proposta_previa
      : null

  const docProps: PropostaAutorizacaoDocumentProps = {
    id,
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
    propostaComercial: propostaComercialFinal,
    valorOfertado: proposta.valor,
    mensagem: proposta.mensagem,
    statusProposta: proposta.status,
    criadoEm: proposta.created_at,
    observacoesInternas: proposta.observacoes_internas ?? null,
    condicoes: condicoesRaw ?? proposta.condicoes ?? null,
    pecasConserto,
    propostaPrevia: propostaPreviaNum,
  }

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

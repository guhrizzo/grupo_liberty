import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import {
  calcularEncargos,
  type PagamentoEncargosInput,
  type ResultadoEncargos,
  hojeSaoPaulo,
} from '@/utils/cobrancas/encargos'

// Núcleo do registro de pagamento de parcela. Fica fora de `actions.ts`
// ('use server') para poder ser chamado também pelo webhook do Asaas, que não
// tem sessão de usuário — qualquer export de um arquivo 'use server' vira
// endpoint público.

export const EPSILON = 0.01

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface TaxasEncargos {
  multaPct: number
  jurosMensalPct: number
  encargosDesde: string | null
}

/** Taxas gravadas na cobrança — cobranças anteriores à regra não têm (= 0). */
export function taxasDaCobranca(data: FirebaseFirestore.DocumentData | undefined): TaxasEncargos {
  return {
    multaPct: typeof data?.multaPct === 'number' ? data.multaPct : 0,
    jurosMensalPct: typeof data?.jurosMensalPct === 'number' ? data.jurosMensalPct : 0,
    encargosDesde: typeof data?.encargosDesde === 'string' ? data.encargosDesde : null,
  }
}

/** Roda o cálculo de encargos de uma parcela (dados crus do Firestore). */
export function calcularParcela(
  parcela: FirebaseFirestore.DocumentData,
  taxas: TaxasEncargos,
  pagamentos: PagamentoEncargosInput[],
  referencia: string = hojeSaoPaulo(),
): ResultadoEncargos {
  return calcularEncargos({
    valorParcela: parcela.valorParcela,
    dataVencimento: parcela.dataVencimento,
    multaPct: taxas.multaPct,
    jurosMensalPct: taxas.jurosMensalPct,
    encargosDesde: taxas.encargosDesde,
    isento: Boolean(parcela.encargosIsentos),
    pagamentos,
    referencia,
  })
}

export function pagamentosDoSnap(snap: FirebaseFirestore.QuerySnapshot): PagamentoEncargosInput[] {
  return snap.docs.map((doc) => {
    const d = doc.data()
    return { id: doc.id, valor: d.valor || 0, data: d.data, criadoEm: d.criadoEm }
  })
}

/**
 * Todo pagamento de parcela recebido vira uma receita em /dashboard/financeiro.
 * Grava direto em `transacoes` (pagamentos podem ser registrados por quem não é
 * admin, e pelo webhook).
 */
export async function registrarReceitaCobranca(params: {
  descricao: string
  valor: number
  data: string
  uid: string | null
  pagamentoId: string
  cobrancaId: string
  parcelaId: string
  origem?: string
}): Promise<string | null> {
  try {
    const now = new Date().toISOString()
    const docRef = adminDb.collection('transacoes').doc()
    await docRef.set({
      descricao: params.descricao,
      categoria: 'Venda de Veículo',
      tipo: 'receita',
      valor: params.valor,
      data: params.data,
      status: 'concluido',
      created_by: params.uid,
      created_at: now,
      updated_at: now,
      origem: params.origem ?? 'cobranca',
      origemPagamentoId: params.pagamentoId,
      origemCobrancaId: params.cobrancaId,
      origemParcelaId: params.parcelaId,
    })
    return docRef.id
  } catch (err) {
    console.error('[registrarReceitaCobranca]', err)
    return null
  }
}

export type RegistroPagamentoResultado =
  | {
      ok: true
      /** true quando o pagamento já existia (reentrega de webhook). */
      jaRegistrado: boolean
      pagamentoId: string
      quitada: boolean
      restante: number
      totalPagoAntes: number
      encargosPagosAgora: number
      principalPagoAgora: number
      parcela: FirebaseFirestore.DocumentData
      cobranca: FirebaseFirestore.DocumentData | undefined
    }
  | { ok: false; error: string }

/**
 * Valida e grava um pagamento (total ou parcial) numa parcela, com a receita
 * correspondente no financeiro. Não envia comprovante nem revalida páginas.
 *
 * `pagamentoId` fixo torna a operação idempotente (usado pelo Asaas).
 */
export async function registrarPagamentoCore(params: {
  parcelaId: string
  valor: number
  data: string
  uid: string | null
  pagamentoId?: string
  origem?: string
  descricaoExtra?: string
}): Promise<RegistroPagamentoResultado> {
  const { parcelaId, valor, data, uid } = params
  const parcelaRef = adminDb.collection('cobranca_parcelas').doc(parcelaId)
  const parcelaDoc = await parcelaRef.get()
  if (!parcelaDoc.exists) return { ok: false, error: 'Parcela não encontrada.' }
  const parcelaData = parcelaDoc.data()!

  const [pagamentosSnap, cobrancaDoc] = await Promise.all([
    adminDb.collection('cobranca_pagamentos').where('parcelaId', '==', parcelaId).get(),
    adminDb.collection('cobrancas').doc(parcelaData.cobrancaId).get(),
  ])
  const cobranca = cobrancaDoc.data()
  const taxas = taxasDaCobranca(cobranca)
  const pagamentosExistentes = pagamentosDoSnap(pagamentosSnap)
  const totalPago = round2(pagamentosExistentes.reduce((s, p) => s + p.valor, 0))

  const pagamentoRef = params.pagamentoId
    ? adminDb.collection('cobranca_pagamentos').doc(params.pagamentoId)
    : adminDb.collection('cobranca_pagamentos').doc()

  if (params.pagamentoId && pagamentosSnap.docs.some((d) => d.id === params.pagamentoId)) {
    const atual = calcularParcela(parcelaData, taxas, pagamentosExistentes, data)
    return {
      ok: true,
      jaRegistrado: true,
      pagamentoId: pagamentoRef.id,
      quitada: atual.totalDevido <= EPSILON,
      restante: atual.totalDevido,
      totalPagoAntes: totalPago,
      encargosPagosAgora: 0,
      principalPagoAgora: 0,
      parcela: parcelaData,
      cobranca,
    }
  }

  const antes = calcularParcela(parcelaData, taxas, pagamentosExistentes, data)
  const saldo = antes.totalDevido
  if (saldo <= EPSILON) return { ok: false, error: 'Esta parcela já está totalmente paga.' }
  const valorArredondado = round2(valor)

  const depois = calcularParcela(
    parcelaData,
    taxas,
    [
      ...pagamentosExistentes,
      { id: pagamentoRef.id, valor: valorArredondado, data, criadoEm: new Date().toISOString() },
    ],
    data,
  )
  if (valorArredondado > saldo + EPSILON || depois.excedente > EPSILON) {
    return {
      ok: false,
      error: `Valor maior que o total devido em ${data.split('-').reverse().join('/')} (R$ ${saldo.toFixed(2).replace('.', ',')}).`,
    }
  }
  const divisao = depois.divisao.find((d) => d.pagamentoId === pagamentoRef.id)
  const encargosPagosAgora = divisao?.paraEncargos ?? 0
  const principalPagoAgora = divisao?.paraPrincipal ?? valorArredondado

  const descricaoBase = cobranca
    ? `Parcela ${parcelaData.numeroParcela}/${cobranca.numeroParcelas} — ${cobranca.clienteNome} (${cobranca.veiculoResumo})`
    : `Parcela ${parcelaData.numeroParcela} — cobrança`
  const descricao =
    encargosPagosAgora > EPSILON
      ? `${descricaoBase} — inclui R$ ${encargosPagosAgora.toFixed(2).replace('.', ',')} de multa/juros`
      : descricaoBase

  const transacaoId = await registrarReceitaCobranca({
    descricao: params.descricaoExtra ? `${descricao} — ${params.descricaoExtra}` : descricao,
    valor: valorArredondado,
    data,
    uid,
    pagamentoId: pagamentoRef.id,
    cobrancaId: parcelaData.cobrancaId,
    parcelaId,
    origem: params.origem,
  })

  await pagamentoRef.set({
    parcelaId,
    cobrancaId: parcelaData.cobrancaId,
    valor: valorArredondado,
    data,
    criadoEm: new Date().toISOString(),
    transacaoId: transacaoId ?? null,
    ...(params.origem ? { origem: params.origem } : {}),
  })

  return {
    ok: true,
    jaRegistrado: false,
    pagamentoId: pagamentoRef.id,
    quitada: depois.totalDevido <= EPSILON,
    restante: depois.totalDevido,
    totalPagoAntes: totalPago,
    encargosPagosAgora,
    principalPagoAgora,
    parcela: parcelaData,
    cobranca,
  }
}

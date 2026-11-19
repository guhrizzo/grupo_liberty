import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import {
  EPSILON,
  calcularParcela,
  pagamentosDoSnap,
  registrarPagamentoCore,
  round2,
  taxasDaCobranca,
} from '@/utils/cobrancas/pagamento-core'

// Cobrança do Asaas que junta várias parcelas atrasadas do mesmo cliente
// (`asaas_cobrancas/{id}.parcelaIds`, com `parcelaId` = a mais antiga).

export type CampoCliente = 'cpf' | 'telefone' | 'endereco'

/** Dados do cliente que o Asaas exige para cobrar e negativar. */
export function camposFaltando(cliente: FirebaseFirestore.DocumentData | undefined): CampoCliente[] {
  const so = (v: unknown) => String(v ?? '').replace(/\D/g, '')
  const faltando: CampoCliente[] = []
  if (so(cliente?.cpf).length !== 11) faltando.push('cpf')
  if (so(cliente?.telefone).length < 10) faltando.push('telefone')
  if (!String(cliente?.endereco ?? '').trim()) faltando.push('endereco')
  return faltando
}

export function idPagamentoConsolidado(paymentId: string, parcelaId: string): string {
  return `asaas_${paymentId}_${parcelaId}`
}

/**
 * Distribui o valor recebido pelas parcelas, da mais antiga para a mais nova,
 * até o limite do que cada uma deve na data do pagamento. Idempotente: reentrega
 * do webhook reaproveita o que já foi gravado.
 * Retorna o valor que sobrou sem parcela para receber (0 = tudo alocado).
 */
export async function baixarParcelasConsolidadas(params: {
  paymentId: string
  parcelaIds: string[]
  valor: number
  data: string
  descricaoExtra: string
}): Promise<{ sobra: number; erros: string[] }> {
  let restante = round2(params.valor)
  const erros: string[] = []

  for (const parcelaId of params.parcelaIds) {
    const pagamentoId = idPagamentoConsolidado(params.paymentId, parcelaId)
    const ja = await adminDb.collection('cobranca_pagamentos').doc(pagamentoId).get()
    if (ja.exists) {
      restante = round2(restante - (ja.data()?.valor ?? 0))
      continue
    }
    if (restante <= EPSILON) break

    const parcelaDoc = await adminDb.collection('cobranca_parcelas').doc(parcelaId).get()
    if (!parcelaDoc.exists) continue
    const parcela = parcelaDoc.data()!
    const [pagSnap, cobDoc] = await Promise.all([
      adminDb.collection('cobranca_pagamentos').where('parcelaId', '==', parcelaId).get(),
      adminDb.collection('cobrancas').doc(parcela.cobrancaId).get(),
    ])
    const saldo = calcularParcela(parcela, taxasDaCobranca(cobDoc.data()), pagamentosDoSnap(pagSnap), params.data)
      .totalDevido
    if (saldo <= EPSILON) continue

    const valor = round2(Math.min(restante, saldo))
    const r = await registrarPagamentoCore({
      parcelaId,
      valor,
      data: params.data,
      uid: null,
      pagamentoId,
      origem: 'asaas',
      descricaoExtra: params.descricaoExtra,
    })
    if (r.ok) restante = round2(restante - valor)
    else erros.push(r.error)
  }
  return { sobra: restante > EPSILON ? restante : 0, erros }
}

/** Desfaz as baixas (e as receitas) gravadas por `baixarParcelasConsolidadas`. */
export async function estornarParcelasConsolidadas(paymentId: string, parcelaIds: string[]) {
  const batch = adminDb.batch()
  for (const parcelaId of parcelaIds) {
    const ref = adminDb.collection('cobranca_pagamentos').doc(idPagamentoConsolidado(paymentId, parcelaId))
    const snap = await ref.get()
    if (!snap.exists) continue
    batch.delete(ref)
    const transacaoId = snap.data()?.transacaoId as string | undefined
    if (transacaoId) batch.delete(adminDb.collection('transacoes').doc(transacaoId))
  }
  await batch.commit()
}

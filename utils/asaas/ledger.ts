import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/utils/firebase/admin'
import { dividirLiquido, round2 } from '@/utils/asaas/reserva'
import type { AsaasPayment } from '@/utils/asaas/client'

// Coleções:
//   asaas_cobrancas/{paymentId}            cobrança gerada no Asaas para uma parcela
//   reserva_quitacao_veiculos/{veiculoId}  configuração (%) e saldo acumulado de reserva
//   reserva_lancamentos/{paymentId_tipo}   razão: cada crédito/estorno de reserva
//   asaas_eventos/{eventId}                eventos de webhook já processados (idempotência)
//
// A conta de reserva é única no Asaas; o saldo de cada veículo mora só aqui.

export const COL_COBRANCAS = 'asaas_cobrancas'
export const COL_RESERVA = 'reserva_quitacao_veiculos'
export const COL_LANCAMENTOS = 'reserva_lancamentos'
export const COL_EVENTOS = 'asaas_eventos'

export type StatusAsaasCobranca = 'pendente' | 'recebida' | 'vencida' | 'cancelada' | 'estornada'

export interface LancamentoReserva {
  veiculoId: string
  cobrancaId: string
  parcelaId: string
  paymentId: string
  tipo: 'credito' | 'estorno'
  billingType: string
  bruto: number
  taxa: number
  liquido: number
  pct: number
  valorReserva: number
  valorCaixa: number
  /** 'asaas' = valor lido do split devolvido pelo Asaas; 'estimado' = calculado aqui (% sobre o líquido). */
  fonte: 'asaas' | 'estimado'
  /** 'confirmado' = pagamento aprovado; 'liquidado' = split liquidado (PAYMENT_SPLIT_DONE). */
  status: 'confirmado' | 'liquidado' | 'estornado'
  criadoEm: string
}

/** Credita a reserva do veículo pelo pagamento recebido. Idempotente por paymentId. */
export async function creditarReserva(payment: AsaasPayment): Promise<LancamentoReserva | null> {
  const cobRef = adminDb.collection(COL_COBRANCAS).doc(payment.id)
  const lancRef = adminDb.collection(COL_LANCAMENTOS).doc(`${payment.id}_credito`)

  return adminDb.runTransaction(async (tx) => {
    const [cobSnap, lancSnap] = await Promise.all([tx.get(cobRef), tx.get(lancRef)])
    if (!cobSnap.exists || lancSnap.exists) return null
    const cob = cobSnap.data()!

    const bruto = round2(payment.value)
    const liquido = round2(payment.netValue ?? payment.value)
    const pct: number = cob.reservaPct ?? 0
    const splitAsaas = payment.split?.find((s) => typeof s.totalValue === 'number')
    const valorReserva = splitAsaas ? round2(splitAsaas.totalValue!) : dividirLiquido(liquido, pct).reserva

    const lanc: LancamentoReserva = {
      veiculoId: cob.veiculoId,
      cobrancaId: cob.cobrancaId,
      parcelaId: cob.parcelaId,
      paymentId: payment.id,
      tipo: 'credito',
      billingType: payment.billingType,
      bruto,
      taxa: round2(bruto - liquido),
      liquido,
      pct,
      valorReserva,
      valorCaixa: round2(liquido - valorReserva),
      fonte: splitAsaas ? 'asaas' : 'estimado',
      // O Asaas pode enviar PAYMENT_SPLIT_DONE antes de PAYMENT_RECEIVED.
      status: cob.splitLiquidadoEm ? 'liquidado' : 'confirmado',
      criadoEm: new Date().toISOString(),
    }
    tx.set(lancRef, lanc)
    tx.set(
      adminDb.collection(COL_RESERVA).doc(cob.veiculoId),
      { saldoAcumulado: FieldValue.increment(valorReserva) },
      { merge: true },
    )
    tx.update(cobRef, { status: 'recebida', recebidaEm: lanc.criadoEm, liquido, valorReserva })
    return lanc
  })
}

/** Desfaz o crédito de reserva (estorno / chargeback perdido). Idempotente. */
export async function estornarReserva(paymentId: string): Promise<boolean> {
  const creditoRef = adminDb.collection(COL_LANCAMENTOS).doc(`${paymentId}_credito`)
  const estornoRef = adminDb.collection(COL_LANCAMENTOS).doc(`${paymentId}_estorno`)
  const cobRef = adminDb.collection(COL_COBRANCAS).doc(paymentId)

  return adminDb.runTransaction(async (tx) => {
    const [credito, estorno] = await Promise.all([tx.get(creditoRef), tx.get(estornoRef)])
    if (!credito.exists || estorno.exists) return false
    const c = credito.data() as LancamentoReserva
    tx.set(estornoRef, {
      ...c,
      tipo: 'estorno',
      bruto: -c.bruto,
      taxa: -c.taxa,
      liquido: -c.liquido,
      valorReserva: -c.valorReserva,
      valorCaixa: -c.valorCaixa,
      status: 'estornado',
      criadoEm: new Date().toISOString(),
    })
    tx.update(creditoRef, { status: 'estornado' })
    tx.set(
      adminDb.collection(COL_RESERVA).doc(c.veiculoId),
      { saldoAcumulado: FieldValue.increment(-c.valorReserva) },
      { merge: true },
    )
    tx.update(cobRef, { status: 'estornada' })
    return true
  })
}

export async function marcarSplitLiquidado(paymentId: string): Promise<void> {
  const ref = adminDb.collection(COL_LANCAMENTOS).doc(`${paymentId}_credito`)
  const snap = await ref.get()
  if (snap.exists) {
    if (snap.data()?.status === 'confirmado') await ref.update({ status: 'liquidado' })
    return
  }
  // Liquidação chegou antes do recebimento: guarda para `creditarReserva` aplicar.
  const cobRef = adminDb.collection(COL_COBRANCAS).doc(paymentId)
  if ((await cobRef.get()).exists) await cobRef.update({ splitLiquidadoEm: new Date().toISOString() })
}

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { registrarPagamentoCore } from '@/utils/cobrancas/pagamento-core'
import { buscarCobranca, type AsaasPayment } from '@/utils/asaas/client'
import {
  COL_COBRANCAS,
  COL_EVENTOS,
  creditarReserva,
  estornarReserva,
  marcarSplitLiquidado,
} from '@/utils/asaas/ledger'

// Webhook do Asaas. Configure em Integrações > Webhooks apontando para
// /api/asaas/webhook, com o mesmo token de ASAAS_WEBHOOK_TOKEN, e os eventos:
// PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_DELETED,
// PAYMENT_REFUNDED, PAYMENT_PARTIALLY_REFUNDED, PAYMENT_CHARGEBACK_REQUESTED,
// PAYMENT_CHARGEBACK_DISPUTE_LOST, PAYMENT_SPLIT_DONE,
// PAYMENT_SPLIT_DIVERGENCE_BLOCK, PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED.

export const dynamic = 'force-dynamic'

interface AsaasEvento {
  id?: string
  event?: string
  payment?: AsaasPayment & { paymentDate?: string; clientPaymentDate?: string }
}

function tokenValido(recebido: string | null): boolean {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN
  if (!esperado || !recebido) return false
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

function hojeISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/** Pagamento aprovado: baixa a parcela e credita a reserva do veículo. */
async function tratarRecebimento(evento: string, pagamento: AsaasPayment & { paymentDate?: string; clientPaymentDate?: string }) {
  // Pix/boleto: dinheiro entra em RECEIVED. Cartão: aprovado em CONFIRMED.
  if (evento === 'PAYMENT_CONFIRMED' && pagamento.billingType !== 'CREDIT_CARD') return

  const cobRef = adminDb.collection(COL_COBRANCAS).doc(pagamento.id)
  const cobSnap = await cobRef.get()
  if (!cobSnap.exists) return // cobrança que não foi gerada por este sistema
  const cob = cobSnap.data()!

  // Dados autoritativos (netValue e split) vêm da API, não só do corpo do webhook.
  const completo = await buscarCobranca(pagamento.id).catch(() => pagamento)

  const data = pagamento.clientPaymentDate ?? pagamento.paymentDate ?? hojeISO()
  const r = await registrarPagamentoCore({
    parcelaId: cob.parcelaId,
    valor: completo.value,
    data,
    uid: null,
    pagamentoId: `asaas_${pagamento.id}`,
    origem: 'asaas',
    descricaoExtra: `Asaas ${completo.billingType}`,
  })
  if (!r.ok) {
    // Parcela já quitada por outro meio, valor acima do devido etc. Não é erro de
    // entrega: registra para conferência manual e não deixa o Asaas reenviar.
    await cobRef.update({ pendenciaBaixa: r.error })
    console.error('[asaas/webhook] baixa não aplicada:', pagamento.id, r.error)
  }
  await creditarReserva(completo)
  revalidatePath('/dashboard/cobrancas')
  revalidatePath('/dashboard/financeiro')
}

/** Estorno: desfaz a baixa da parcela (e a receita) e a reserva. */
async function tratarEstorno(paymentId: string) {
  const cobRef = adminDb.collection(COL_COBRANCAS).doc(paymentId)
  if (!(await cobRef.get()).exists) return
  const pagRef = adminDb.collection('cobranca_pagamentos').doc(`asaas_${paymentId}`)
  const pag = await pagRef.get()
  const transacaoId = pag.data()?.transacaoId as string | undefined
  const batch = adminDb.batch()
  if (pag.exists) batch.delete(pagRef)
  if (transacaoId) batch.delete(adminDb.collection('transacoes').doc(transacaoId))
  await batch.commit()
  await estornarReserva(paymentId)
  revalidatePath('/dashboard/cobrancas')
  revalidatePath('/dashboard/financeiro')
}

async function atualizarCobranca(paymentId: string, patch: Record<string, unknown>) {
  const ref = adminDb.collection(COL_COBRANCAS).doc(paymentId)
  if ((await ref.get()).exists) await ref.update(patch)
}

export async function POST(request: NextRequest) {
  if (!tokenValido(request.headers.get('asaas-access-token'))) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  let corpo: AsaasEvento
  try {
    corpo = (await request.json()) as AsaasEvento
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  const { id: eventoId, event: evento, payment: pagamento } = corpo
  if (!eventoId || !evento || !pagamento?.id) return NextResponse.json({ ok: true, ignorado: true })

  // Idempotência: o Asaas reentrega eventos. `create` falha se já foi processado.
  const eventoRef = adminDb.collection(COL_EVENTOS).doc(eventoId)
  try {
    await eventoRef.create({ evento, paymentId: pagamento.id, em: new Date().toISOString() })
  } catch {
    return NextResponse.json({ ok: true, duplicado: true })
  }

  try {
    switch (evento) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        await tratarRecebimento(evento, pagamento)
        break
      case 'PAYMENT_OVERDUE':
        await atualizarCobranca(pagamento.id, { status: 'vencida', vencidaEm: new Date().toISOString() })
        break
      case 'PAYMENT_DELETED':
        await atualizarCobranca(pagamento.id, { status: 'cancelada', canceladaEm: new Date().toISOString() })
        break
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_CHARGEBACK_DISPUTE_LOST':
        await tratarEstorno(pagamento.id)
        break
      case 'PAYMENT_PARTIALLY_REFUNDED':
        // Documentação do Asaas não detalha o efeito no split: exige conferência manual.
        await atualizarCobranca(pagamento.id, { revisaoManual: 'Estorno parcial — conferir reserva.' })
        break
      case 'PAYMENT_CHARGEBACK_REQUESTED':
        await atualizarCobranca(pagamento.id, { revisaoManual: 'Chargeback solicitado — acompanhar.' })
        break
      case 'PAYMENT_SPLIT_DONE':
        await marcarSplitLiquidado(pagamento.id)
        break
      case 'PAYMENT_SPLIT_DIVERGENCE_BLOCK':
        await atualizarCobranca(pagamento.id, { divergencia: true })
        break
      case 'PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED':
        await atualizarCobranca(pagamento.id, { divergencia: false })
        break
    }
  } catch (err) {
    // Libera o evento para o Asaas reentregar.
    await eventoRef.delete().catch(() => {})
    console.error('[asaas/webhook]', evento, pagamento.id, err)
    return NextResponse.json({ error: 'Erro ao processar.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

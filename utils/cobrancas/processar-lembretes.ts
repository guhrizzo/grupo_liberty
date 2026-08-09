import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import { sendCobrancaLembreteEmail } from '@/utils/email/send-cobranca-lembrete-email'
import { sendCobrancaAtrasoEmail } from '@/utils/email/send-cobranca-atraso-email'

// ─── "Cobrar quando faltar X dias" + "Avisar quando atrasar" ──────────────
// Duas checagens independentes, cada uma com seu próprio marcador de "já
// avisado" na parcela (nunca reenvia a mesma parcela duas vezes pelo mesmo
// motivo):
//
// 1. Pré-vencimento: cobrança com `diasAvisoAntecedencia` configurado — avisa
//    quando faltar esse tanto de dias (ou menos) para o vencimento.
//    Marca `lembreteEnviadoEm`.
// 2. Atraso: cobrança com `avisarAtraso` ativado — avisa uma vez quando a
//    parcela vence sem pagamento. Marca `avisoAtrasoEnviadoEm`.
//
// Usado por dois lugares:
// - app/api/cron/lembretes-cobranca/route.ts (cron diário da Vercel, produção)
// - app/dashboard/cobrancas/actions.ts → testarLembretes() (botão manual no
//   dashboard, útil para testar em ambiente local/dev, onde não existe cron).

export interface ProcessarLembretesResult {
  verificados: number
  enviados: number
  erros: string[]
}

function diasAte(hoje: Date, dataVencimento: string): number {
  const venc = new Date(dataVencimento + 'T00:00:00')
  return Math.round((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

/** Busca parcelas + pagamentos de uma cobrança e devolve o valor pago por parcela. */
async function carregarValoresPagos(cobrancaId: string) {
  const [parcelasSnap, pagamentosSnap] = await Promise.all([
    adminDb.collection('cobranca_parcelas').where('cobrancaId', '==', cobrancaId).get(),
    adminDb.collection('cobranca_pagamentos').where('cobrancaId', '==', cobrancaId).get(),
  ])

  const pagoPorParcela = new Map<string, number>()
  for (const doc of pagamentosSnap.docs) {
    const data = doc.data()
    pagoPorParcela.set(data.parcelaId, (pagoPorParcela.get(data.parcelaId) ?? 0) + (data.valor || 0))
  }

  return { parcelasSnap, pagoPorParcela }
}

export async function processarLembretesCobranca(): Promise<ProcessarLembretesResult> {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  let verificados = 0
  let enviados = 0
  const erros: string[] = []

  // ── 1) Pré-vencimento ──────────────────────────────────────────────────
  const preVencimentoSnap = await adminDb
    .collection('cobrancas')
    .where('diasAvisoAntecedencia', '>', 0)
    .get()

  for (const cobrancaDoc of preVencimentoSnap.docs) {
    const cobranca = cobrancaDoc.data()
    const clienteEmail = (cobranca.clienteEmail as string | null) || null
    const diasAviso = cobranca.diasAvisoAntecedencia as number
    if (!clienteEmail || !diasAviso) continue

    const { parcelasSnap, pagoPorParcela } = await carregarValoresPagos(cobrancaDoc.id)

    for (const parcelaDoc of parcelasSnap.docs) {
      const parcela = parcelaDoc.data()
      verificados++

      if (parcela.lembreteEnviadoEm) continue // já avisado antes

      const valorPago = pagoPorParcela.get(parcelaDoc.id) ?? 0
      if (valorPago >= parcela.valorParcela - 0.01) continue // já quitada

      const diasRestantes = diasAte(hoje, parcela.dataVencimento)
      if (diasRestantes < 0 || diasRestantes > diasAviso) continue // fora da janela de aviso

      const ok = await sendCobrancaLembreteEmail({
        clienteNome: cobranca.clienteNome,
        clienteEmail,
        veiculoResumo: cobranca.veiculoResumo,
        numeroParcela: parcela.numeroParcela,
        numeroParcelas: cobranca.numeroParcelas,
        valorParcela: parcela.valorParcela,
        dataVencimento: parcela.dataVencimento,
        diasRestantes,
      })

      if (ok) {
        await parcelaDoc.ref.update({ lembreteEnviadoEm: new Date().toISOString() })
        enviados++
      } else {
        erros.push(parcelaDoc.id)
      }
    }
  }

  // ── 2) Atraso ───────────────────────────────────────────────────────────
  const atrasoSnap = await adminDb.collection('cobrancas').where('avisarAtraso', '==', true).get()

  for (const cobrancaDoc of atrasoSnap.docs) {
    const cobranca = cobrancaDoc.data()
    const clienteEmail = (cobranca.clienteEmail as string | null) || null
    if (!clienteEmail) continue

    const { parcelasSnap, pagoPorParcela } = await carregarValoresPagos(cobrancaDoc.id)

    for (const parcelaDoc of parcelasSnap.docs) {
      const parcela = parcelaDoc.data()
      verificados++

      if (parcela.avisoAtrasoEnviadoEm) continue // já avisado antes

      const valorPago = pagoPorParcela.get(parcelaDoc.id) ?? 0
      const valorRestante = Math.max(Math.round((parcela.valorParcela - valorPago) * 100) / 100, 0)
      if (valorRestante <= 0.01) continue // já quitada

      const diasRestantes = diasAte(hoje, parcela.dataVencimento)
      if (diasRestantes >= 0) continue // ainda não venceu

      const ok = await sendCobrancaAtrasoEmail({
        clienteNome: cobranca.clienteNome,
        clienteEmail,
        veiculoResumo: cobranca.veiculoResumo,
        numeroParcela: parcela.numeroParcela,
        numeroParcelas: cobranca.numeroParcelas,
        valorRestante,
        dataVencimento: parcela.dataVencimento,
        diasAtraso: Math.abs(diasRestantes),
      })

      if (ok) {
        await parcelaDoc.ref.update({ avisoAtrasoEnviadoEm: new Date().toISOString() })
        enviados++
      } else {
        erros.push(parcelaDoc.id)
      }
    }
  }

  return { verificados, enviados, erros }
}

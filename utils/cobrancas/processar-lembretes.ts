import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import { sendCobrancaLembreteEmail } from '@/utils/email/send-cobranca-lembrete-email'
import { sendCobrancaAtrasoEmail } from '@/utils/email/send-cobranca-atraso-email'

// ─── Envio automático em 3 momentos fixos ─────────────────────────────────
//
// Para cobranças com `avisarAtraso == true` (campo que agora significa
// "notificações ativas"), enviamos e-mail em exatamente 3 momentos por parcela:
//
//  1. 3 dias antes do vencimento  → marcado em `lembrete3dEnviadoEm`
//  2. No dia do vencimento         → marcado em `lembrete0dEnviadoEm`
//  3. 1 dia após o vencimento      → marcado em `avisoAtrasoEnviadoEm`
//
// Cada marcador garante que o mesmo e-mail nunca seja reenviado para a mesma
// parcela. Parcelas já quitadas são ignoradas.
//
// Compatibilidade: o campo antigo `lembreteEnviadoEm` e `diasAvisoAntecedencia`
// podem existir no Firestore (cobranças antigas), mas o novo código não os usa
// para controlar envios. Cobranças antigas sem `avisarAtraso` simplesmente
// não são processadas.
//
// Usado por dois lugares:
// - app/api/cron/lembretes-cobranca/route.ts  (cron diário da Vercel, produção)
// - app/dashboard/cobrancas/actions.ts → testarLembretes()  (botão manual)

export interface ProcessarLembretesResult {
  verificados: number
  enviados: number
  erros: string[]
}

function diasAte(hoje: Date, dataVencimento: string): number {
  const venc = new Date(dataVencimento + 'T00:00:00')
  return Math.round((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

/** Busca pagamentos de uma cobrança e devolve o valor pago por parcela. */
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

  // Busca apenas cobranças com notificações ativas e e-mail cadastrado
  const cobrancasSnap = await adminDb
    .collection('cobrancas')
    .where('avisarAtraso', '==', true)
    .get()

  for (const cobrancaDoc of cobrancasSnap.docs) {
    const cobranca = cobrancaDoc.data()
    const clienteEmail = (cobranca.clienteEmail as string | null) || null
    if (!clienteEmail) continue

    const { parcelasSnap, pagoPorParcela } = await carregarValoresPagos(cobrancaDoc.id)

    for (const parcelaDoc of parcelasSnap.docs) {
      const parcela = parcelaDoc.data()
      verificados++

      const valorPago = pagoPorParcela.get(parcelaDoc.id) ?? 0
      const valorRestante = Math.max(Math.round((parcela.valorParcela - valorPago) * 100) / 100, 0)
      if (valorRestante <= 0.01) continue // parcela já quitada

      const diasRestantes = diasAte(hoje, parcela.dataVencimento)

      // ── Momento 1: 3 dias antes ───────────────────────────────────────────
      if (diasRestantes === 3 && !parcela.lembrete3dEnviadoEm) {
        const ok = await sendCobrancaLembreteEmail({
          clienteNome: cobranca.clienteNome,
          clienteEmail,
          veiculoResumo: cobranca.veiculoResumo,
          numeroParcela: parcela.numeroParcela,
          numeroParcelas: cobranca.numeroParcelas,
          valorParcela: parcela.valorParcela,
          dataVencimento: parcela.dataVencimento,
          diasRestantes: 3,
        })

        if (ok) {
          await parcelaDoc.ref.update({ lembrete3dEnviadoEm: new Date().toISOString() })
          enviados++
        } else {
          erros.push(`${parcelaDoc.id}:3d`)
        }
      }

      // ── Momento 2: no dia do vencimento ──────────────────────────────────
      if (diasRestantes === 0 && !parcela.lembrete0dEnviadoEm) {
        const ok = await sendCobrancaLembreteEmail({
          clienteNome: cobranca.clienteNome,
          clienteEmail,
          veiculoResumo: cobranca.veiculoResumo,
          numeroParcela: parcela.numeroParcela,
          numeroParcelas: cobranca.numeroParcelas,
          valorParcela: parcela.valorParcela,
          dataVencimento: parcela.dataVencimento,
          diasRestantes: 0,
        })

        if (ok) {
          await parcelaDoc.ref.update({ lembrete0dEnviadoEm: new Date().toISOString() })
          enviados++
        } else {
          erros.push(`${parcelaDoc.id}:0d`)
        }
      }

      // ── Momento 3: 1 dia após o vencimento ───────────────────────────────
      if (diasRestantes === -1 && !parcela.avisoAtrasoEnviadoEm) {
        const ok = await sendCobrancaAtrasoEmail({
          clienteNome: cobranca.clienteNome,
          clienteEmail,
          veiculoResumo: cobranca.veiculoResumo,
          numeroParcela: parcela.numeroParcela,
          numeroParcelas: cobranca.numeroParcelas,
          valorRestante,
          dataVencimento: parcela.dataVencimento,
          diasAtraso: 1,
        })

        if (ok) {
          await parcelaDoc.ref.update({ avisoAtrasoEnviadoEm: new Date().toISOString() })
          enviados++
        } else {
          erros.push(`${parcelaDoc.id}:atraso`)
        }
      }
    }
  }

  return { verificados, enviados, erros }
}

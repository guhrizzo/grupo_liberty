import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import {
  listarNegativacoesDaCobranca,
  type AsaasDunning,
  type AsaasDunningStatus,
} from '@/utils/asaas/client'
import { COL_COBRANCAS } from '@/utils/asaas/ledger'

/** Negativação (Serasa) gravada dentro de `asaas_cobrancas/{paymentId}.negativacao`. */
export interface NegativacaoRegistro {
  id: string
  status: AsaasDunningStatus
  dunningNumber: number | null
  valor: number | null
  taxa: number | null
  liquido: number | null
  motivoNegacao: string | null
  podeCancelar: boolean
  motivoNaoCancelar: string | null
  precisaReenviarDocumento: boolean
  solicitadaEm: string
  solicitadaPor: string | null
  atualizadaEm: string
}

/** Status em que a negativação ainda está "viva" (bloqueia pedir outra). */
export const NEGATIVACAO_ATIVA: AsaasDunningStatus[] = [
  'PENDING',
  'AWAITING_APPROVAL',
  'AWAITING_CANCELLATION',
  'PROCESSED',
  'PARTIALLY_PAID',
]

export function registroDeDunning(
  d: AsaasDunning,
  base?: Partial<Pick<NegativacaoRegistro, 'solicitadaEm' | 'solicitadaPor'>>,
): NegativacaoRegistro {
  const agora = new Date().toISOString()
  return {
    id: d.id,
    status: d.status,
    dunningNumber: d.dunningNumber ?? null,
    valor: d.value ?? null,
    taxa: d.feeValue ?? null,
    liquido: d.netValue ?? null,
    motivoNegacao: d.denialReason ?? null,
    podeCancelar: d.canBeCancelled === true,
    motivoNaoCancelar: d.cannotBeCancelledReason ?? null,
    precisaReenviarDocumento: d.isNecessaryResendDocumentation === true,
    solicitadaEm: base?.solicitadaEm ?? d.requestDate ?? agora,
    solicitadaPor: base?.solicitadaPor ?? null,
    atualizadaEm: agora,
  }
}

/**
 * Busca a negativação mais recente da cobrança no Asaas e atualiza o registro local.
 * Usada pelo botão "Atualizar" e pelos webhooks PAYMENT_DUNNING_*.
 */
export async function sincronizarNegativacao(paymentId: string): Promise<NegativacaoRegistro | null> {
  const ref = adminDb.collection(COL_COBRANCAS).doc(paymentId)
  const snap = await ref.get()
  if (!snap.exists) return null
  const atual = snap.data()!.negativacao as NegativacaoRegistro | undefined

  const lista = await listarNegativacoesDaCobranca(paymentId)
  if (lista.length === 0) return atual ?? null
  // Prefere a que já acompanhávamos; senão, a mais recente.
  const alvo =
    lista.find((d) => d.id === atual?.id) ??
    [...lista].sort((a, b) => String(b.requestDate).localeCompare(String(a.requestDate)))[0]

  const registro = registroDeDunning(alvo, atual)
  await ref.update({ negativacao: registro })
  return registro
}

'use server'

import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import {
  AsaasError,
  asaasConfigurado,
  cancelarNegativacao,
  criarNegativacao,
  reenviarDocumentoNegativacao,
  simularNegativacao,
  type AsaasDunningDados,
} from '@/utils/asaas/client'
import { COL_COBRANCAS } from '@/utils/asaas/ledger'
import {
  NEGATIVACAO_ATIVA,
  registroDeDunning,
  sincronizarNegativacao,
  type NegativacaoRegistro,
} from '@/utils/asaas/negativacao'

// Negativação (Serasa) de cobranças vencidas geradas pelo Asaas.
// Ação com consequência jurídica e custo: restrita a administradores.

const DOC_MAX_BYTES = 10 * 1024 * 1024

type Resposta<T = object> = ({ success: string } & T) | { error: string }

async function autorizarAdmin() {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')
  if (!hasPageAccess(user, 'cobrancas')) throw new Error('Acesso negado.')
  if (user.role !== 'admin') throw new Error('Apenas administradores podem negativar clientes.')
  return user
}

async function lerCobrancaVencida(paymentId: string) {
  const ref = adminDb.collection(COL_COBRANCAS).doc(paymentId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Cobrança não encontrada.')
  const d = snap.data()!
  if (d.status !== 'vencida') {
    throw new Error('Só é possível negativar cobranças vencidas e não pagas.')
  }
  return { ref, d }
}

function erroDe(err: unknown, fallback: string): { error: string } {
  if (err instanceof AsaasError) return { error: `Asaas: ${err.message}` }
  return { error: err instanceof Error ? err.message : fallback }
}

export interface PrefillNegativacao {
  nome: string
  cpf: string
  telefone: string
  /** Endereço em texto livre do cliente (o Asaas exige CEP, número e bairro separados). */
  enderecoTexto: string
  descricao: string
}

export async function getPrefillNegativacao(
  paymentId: string,
): Promise<PrefillNegativacao | { error: string }> {
  try {
    await autorizarAdmin()
    const { d } = await lerCobrancaVencida(paymentId)
    const cob = (await adminDb.collection('cobrancas').doc(d.cobrancaId).get()).data()
    if (!cob) return { error: 'Cobrança não encontrada.' }
    return {
      nome: cob.clienteNome ?? '',
      cpf: cob.cliente?.cpf ?? '',
      telefone: cob.cliente?.telefone ?? '',
      enderecoTexto: cob.cliente?.endereco ?? '',
      descricao: `Parcela em atraso — ${cob.veiculoResumo ?? 'veículo'}`,
    }
  } catch (err) {
    return erroDe(err, 'Erro ao carregar dados.')
  }
}

export interface SimulacaoNegativacao {
  permitido: boolean
  motivo: string | null
  valor: number | null
  taxa: number | null
  liquido: number | null
}

/** Pergunta ao Asaas se a cobrança pode ser negativada e quanto custa. Não cria nada. */
export async function simularNegativacaoAsaas(
  paymentId: string,
): Promise<Resposta<{ simulacao: SimulacaoNegativacao }>> {
  try {
    await autorizarAdmin()
    await lerCobrancaVencida(paymentId)
    return { success: 'ok', simulacao: await simularNegativacao(paymentId) }
  } catch (err) {
    return erroDe(err, 'Erro ao simular.')
  }
}

function texto(form: FormData, campo: string): string {
  return String(form.get(campo) ?? '').trim()
}

function soDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

/** Cria a negativação no Asaas. Exige documento comprobatório (contrato/nota fiscal). */
export async function negativarCobrancaAsaas(form: FormData): Promise<Resposta> {
  try {
    const user = await autorizarAdmin()
    if (!asaasConfigurado()) return { error: 'Asaas não configurado.' }
    const paymentId = texto(form, 'payment')
    const { ref, d } = await lerCobrancaVencida(paymentId)
    if (d.negativacao && NEGATIVACAO_ATIVA.includes(d.negativacao.status)) {
      return { error: 'Esta cobrança já tem uma negativação em andamento.' }
    }

    const cpfCnpj = soDigitos(texto(form, 'customerCpfCnpj'))
    const cep = soDigitos(texto(form, 'customerPostalCode'))
    const telefone = soDigitos(texto(form, 'customerPrimaryPhone'))
    const dados: AsaasDunningDados = {
      payment: paymentId,
      description: texto(form, 'description'),
      customerName: texto(form, 'customerName'),
      customerCpfCnpj: cpfCnpj,
      customerPrimaryPhone: telefone,
      customerSecondaryPhone: soDigitos(texto(form, 'customerSecondaryPhone')),
      customerPostalCode: cep,
      customerAddress: texto(form, 'customerAddress'),
      customerAddressNumber: texto(form, 'customerAddressNumber'),
      customerComplement: texto(form, 'customerComplement'),
      customerProvince: texto(form, 'customerProvince'),
    }
    if (!dados.customerName) return { error: 'Informe o nome do cliente.' }
    if (![11, 14].includes(cpfCnpj.length)) return { error: 'CPF/CNPJ inválido.' }
    if (telefone.length < 10) return { error: 'Informe um telefone com DDD.' }
    if (cep.length !== 8) return { error: 'CEP inválido (8 dígitos).' }
    if (!dados.customerAddress) return { error: 'Informe o logradouro.' }
    if (!dados.customerAddressNumber) return { error: 'Informe o número do endereço.' }
    if (!dados.customerProvince) return { error: 'Informe o bairro.' }

    const documento = form.get('documents')
    if (!(documento instanceof File) || documento.size === 0) {
      return { error: 'Anexe o contrato ou a nota fiscal (com firma reconhecida em cartório).' }
    }
    if (documento.size > DOC_MAX_BYTES) return { error: 'O documento passa de 10 MB.' }

    const dunning = await criarNegativacao(dados, documento)
    await ref.update({
      negativacao: registroDeDunning(dunning, {
        solicitadaEm: new Date().toISOString(),
        solicitadaPor: user.name || user.email || user.uid,
      }),
    })
    revalidatePath('/dashboard/cobrancas')
    return { success: 'Negativação solicitada. O Asaas vai analisar o documento.' }
  } catch (err) {
    console.error('[negativarCobrancaAsaas]', err)
    return erroDe(err, 'Erro ao negativar.')
  }
}

/** Reenvia o documento quando o Asaas pede (precisaReenviarDocumento). */
export async function reenviarDocumentoNegativacaoAsaas(form: FormData): Promise<Resposta> {
  try {
    await autorizarAdmin()
    const paymentId = texto(form, 'payment')
    const neg = (await adminDb.collection(COL_COBRANCAS).doc(paymentId).get()).data()?.negativacao
    if (!neg) return { error: 'Não há negativação nesta cobrança.' }
    const documento = form.get('documents')
    if (!(documento instanceof File) || documento.size === 0) return { error: 'Anexe o documento.' }
    if (documento.size > DOC_MAX_BYTES) return { error: 'O documento passa de 10 MB.' }
    await reenviarDocumentoNegativacao(neg.id, documento)
    await sincronizarNegativacao(paymentId)
    revalidatePath('/dashboard/cobrancas')
    return { success: 'Documento reenviado para nova análise.' }
  } catch (err) {
    return erroDe(err, 'Erro ao reenviar.')
  }
}

export async function cancelarNegativacaoAsaas(paymentId: string): Promise<Resposta> {
  try {
    await autorizarAdmin()
    const neg = (await adminDb.collection(COL_COBRANCAS).doc(paymentId).get()).data()?.negativacao
    if (!neg) return { error: 'Não há negativação nesta cobrança.' }
    await cancelarNegativacao(neg.id)
    await sincronizarNegativacao(paymentId)
    revalidatePath('/dashboard/cobrancas')
    return { success: 'Cancelamento da negativação solicitado.' }
  } catch (err) {
    return erroDe(err, 'Erro ao cancelar.')
  }
}

/** Puxa o status mais recente da negativação direto do Asaas. */
export async function atualizarNegativacaoAsaas(paymentId: string): Promise<Resposta> {
  try {
    const user = await getSessionUser()
    if (!user || !hasPageAccess(user, 'cobrancas')) throw new Error('Acesso negado.')
    await sincronizarNegativacao(paymentId)
    revalidatePath('/dashboard/cobrancas')
    return { success: 'Status da negativação atualizado.' }
  } catch (err) {
    return erroDe(err, 'Erro ao atualizar.')
  }
}

export interface LinhaNegativacao {
  paymentId: string
  clienteNome: string
  veiculoResumo: string
  billingType: string
  valor: number
  vencimento: string
  statusCobranca: string
  negativacao: NegativacaoRegistro | null
}

/** Cobranças vencidas (candidatas) e cobranças com negativação, para a aba Negativações. */
export async function listarNegativacoesAsaas(): Promise<LinhaNegativacao[]> {
  const user = await getSessionUser()
  if (!user || !hasPageAccess(user, 'cobrancas')) return []
  const snap = await adminDb.collection(COL_COBRANCAS).get()
  const relevantes = snap.docs.filter((doc) => {
    const d = doc.data()
    return d.status === 'vencida' || d.negativacao
  })
  const cobIds = [...new Set(relevantes.map((doc) => doc.data().cobrancaId as string))]
  const cobs = new Map<string, FirebaseFirestore.DocumentData>()
  await Promise.all(
    cobIds.map(async (id) => {
      const s = await adminDb.collection('cobrancas').doc(id).get()
      if (s.exists) cobs.set(id, s.data()!)
    }),
  )
  return relevantes
    .map((doc) => {
      const d = doc.data()
      const cob = cobs.get(d.cobrancaId)
      return {
        paymentId: doc.id,
        clienteNome: (cob?.clienteNome as string) ?? '—',
        veiculoResumo: (cob?.veiculoResumo as string) ?? '',
        billingType: d.billingType as string,
        valor: d.valor as number,
        vencimento: d.vencimento as string,
        statusCobranca: d.status as string,
        negativacao: (d.negativacao as NegativacaoRegistro | undefined) ?? null,
      }
    })
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
}

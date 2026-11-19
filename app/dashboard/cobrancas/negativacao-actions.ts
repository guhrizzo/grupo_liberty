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
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import { camposFaltando, type CampoCliente } from '@/utils/asaas/consolidada'
import { calcularParcela, pagamentosDoSnap, taxasDaCobranca, EPSILON } from '@/utils/cobrancas/pagamento-core'
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

export interface ParcelaAtrasadaItem {
  parcelaId: string
  numeroParcela: number
  vencimento: string
  diasAtraso: number
  /** Total devido hoje nesta parcela (principal + multa + juros). */
  totalDevido: number
  /** Cobrança Asaas já gerada que cobre esta parcela e ainda não venceu (aguardando virar "vencida"). */
  cobrada: { paymentId: string; billingType: string; vencimento: string; link: string | null } | null
}

/** Tudo o que um cliente (uma cobrança/contrato) deve em atraso, somado. */
export interface ClienteAtrasado {
  cobrancaId: string
  clienteNome: string
  veiculoResumo: string
  numeroParcelas: number
  parcelas: ParcelaAtrasadaItem[]
  /** Soma das parcelas ainda sem cobrança Asaas. */
  totalDevido: number
  /** Dados do cliente já cadastrados (para pré-preencher o modal). */
  dados: { cpf: string; telefone: string; endereco: string }
  faltando: CampoCliente[]
}

/**
 * Clientes com parcelas atrasadas no sistema que ainda não têm cobrança vencida (ou negativação) no Asaas.
 * O Asaas só negativa cobranças dele: para estes, gera-se UMA cobrança com o total devido, espera-se vencer e negativa-se.
 */
export async function listarParcelasAtrasadasSemAsaas(): Promise<ClienteAtrasado[]> {
  const user = await getSessionUser()
  if (!user || !hasPageAccess(user, 'cobrancas')) return []

  const hoje = hojeSaoPaulo()
  const [parcelasSnap, asaasSnap] = await Promise.all([
    adminDb.collection('cobranca_parcelas').where('dataVencimento', '<', hoje).get(),
    adminDb.collection(COL_COBRANCAS).get(),
  ])

  // Cobranças Asaas por parcela (inclui as consolidadas, que cobrem várias parcelas).
  const porParcela = new Map<string, FirebaseFirestore.DocumentData[]>()
  for (const doc of asaasSnap.docs) {
    const d = doc.data()
    const cobertas: string[] = d.parcelaIds ?? (d.parcelaId ? [d.parcelaId] : [])
    for (const pid of cobertas) {
      porParcela.set(pid, [...(porParcela.get(pid) ?? []), { ...d, _id: doc.id }])
    }
  }

  const candidatas = parcelasSnap.docs.filter((doc) => {
    if (doc.data().suspensa) return false
    const asaas = porParcela.get(doc.id) ?? []
    return !asaas.some((a) => a.status === 'vencida' || a.status === 'recebida' || a.negativacao)
  })

  const cobIds = [...new Set(candidatas.map((doc) => doc.data().cobrancaId as string))]
  const cobs = new Map<string, FirebaseFirestore.DocumentData>()
  await Promise.all(
    cobIds.map(async (id) => {
      const s = await adminDb.collection('cobrancas').doc(id).get()
      if (s.exists) cobs.set(id, s.data()!)
    }),
  )

  const itens = await Promise.all(
    candidatas.map(async (doc) => {
      const p = doc.data()
      const cob = cobs.get(p.cobrancaId)
      if (!cob) return null
      const pagSnap = await adminDb.collection('cobranca_pagamentos').where('parcelaId', '==', doc.id).get()
      const r = calcularParcela(p, taxasDaCobranca(cob), pagamentosDoSnap(pagSnap), hoje)
      if (r.principalRestante <= EPSILON) return null
      const pendente = (porParcela.get(doc.id) ?? []).find((a) => a.status === 'pendente')
      const item: ParcelaAtrasadaItem = {
        parcelaId: doc.id,
        numeroParcela: p.numeroParcela as number,
        vencimento: p.dataVencimento as string,
        diasAtraso: Math.max(
          0,
          Math.round((Date.parse(hoje) - Date.parse(p.dataVencimento as string)) / 86_400_000),
        ),
        totalDevido: r.totalDevido,
        cobrada: pendente
          ? {
              paymentId: pendente._id as string,
              billingType: pendente.billingType as string,
              vencimento: pendente.vencimento as string,
              link: (pendente.link as string | null) ?? null,
            }
          : null,
      }
      return { cobrancaId: p.cobrancaId as string, item }
    }),
  )

  const grupos = new Map<string, ClienteAtrasado>()
  for (const x of itens) {
    if (!x) continue
    let g = grupos.get(x.cobrancaId)
    if (!g) {
      const cob = cobs.get(x.cobrancaId)!
      g = {
        cobrancaId: x.cobrancaId,
        clienteNome: (cob.clienteNome as string) ?? '—',
        veiculoResumo: (cob.veiculoResumo as string) ?? '',
        numeroParcelas: (cob.numeroParcelas as number) ?? 0,
        parcelas: [],
        totalDevido: 0,
        dados: {
          cpf: String(cob.cliente?.cpf ?? ''),
          telefone: String(cob.cliente?.telefone ?? ''),
          endereco: String(cob.cliente?.endereco ?? ''),
        },
        faltando: camposFaltando(cob.cliente),
      }
      grupos.set(x.cobrancaId, g)
    }
    g.parcelas.push(x.item)
    if (!x.item.cobrada) g.totalDevido = Math.round((g.totalDevido + x.item.totalDevido) * 100) / 100
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, parcelas: g.parcelas.sort((a, b) => a.vencimento.localeCompare(b.vencimento)) }))
    .sort((a, b) => a.parcelas[0].vencimento.localeCompare(b.parcelas[0].vencimento))
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

'use server'

import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import {
  calcularParcela,
  pagamentosDoSnap,
  taxasDaCobranca,
  round2,
  EPSILON,
} from '@/utils/cobrancas/pagamento-core'
import {
  AsaasError,
  asaasCartaoHabilitado,
  asaasConfigurado,
  buscarOuCriarCliente,
  criarCobranca,
  excluirCobranca,
  type AsaasBillingType,
} from '@/utils/asaas/client'
import {
  COL_COBRANCAS,
  COL_LANCAMENTOS,
  COL_RESERVA,
  type StatusAsaasCobranca,
} from '@/utils/asaas/ledger'
import { sugerirPercentualReserva } from '@/utils/asaas/reserva'

export interface AsaasCobrancaInfo {
  paymentId: string
  billingType: string
  valor: number
  vencimento: string
  status: StatusAsaasCobranca
  link: string | null
  reservaPct: number
  valorReserva: number | null
  divergencia: boolean
  revisaoManual: string | null
  pendenciaBaixa: string | null
}

export interface ReservaVeiculoInfo {
  pct: number
  saldoDevedorBase: number | null
  parcelasRestantes: number | null
  saldoAcumulado: number
}

export interface PainelAsaas {
  configurado: boolean
  cartaoHabilitado: boolean
  podeEditarReserva: boolean
  reserva: ReservaVeiculoInfo
  cobrancas: AsaasCobrancaInfo[]
}

export type AsaasResponse<T = object> = ({ success: string } & T) | { error: string }

async function autorizar() {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')
  if (!hasPageAccess(user, 'cobrancas')) throw new Error('Acesso negado.')
  return user
}

async function lerReserva(veiculoId: string): Promise<ReservaVeiculoInfo> {
  const d = (await adminDb.collection(COL_RESERVA).doc(veiculoId).get()).data()
  return {
    pct: typeof d?.pct === 'number' ? d.pct : 0,
    saldoDevedorBase: typeof d?.saldoDevedorBase === 'number' ? d.saldoDevedorBase : null,
    parcelasRestantes: typeof d?.parcelasRestantes === 'number' ? d.parcelasRestantes : null,
    saldoAcumulado: round2(typeof d?.saldoAcumulado === 'number' ? d.saldoAcumulado : 0),
  }
}

export async function getPainelAsaas(
  parcelaId: string,
  veiculoId: string,
): Promise<PainelAsaas | { error: string }> {
  try {
    const user = await autorizar()
    const snap = await adminDb.collection(COL_COBRANCAS).where('parcelaId', '==', parcelaId).get()
    const cobrancas: AsaasCobrancaInfo[] = snap.docs
      .map((doc) => ({ doc, d: doc.data() }))
      .sort((a, b) => String(b.d.criadoEm).localeCompare(String(a.d.criadoEm)))
      .map(({ doc, d }) => ({
        paymentId: doc.id,
        billingType: d.billingType as string,
        valor: d.valor as number,
        vencimento: d.vencimento as string,
        status: d.status as StatusAsaasCobranca,
        link: (d.link as string | null) ?? null,
        reservaPct: (d.reservaPct as number) ?? 0,
        valorReserva: typeof d.valorReserva === 'number' ? d.valorReserva : null,
        divergencia: Boolean(d.divergencia),
        revisaoManual: (d.revisaoManual as string | null) ?? null,
        pendenciaBaixa: (d.pendenciaBaixa as string | null) ?? null,
      }))
    return {
      configurado: asaasConfigurado(),
      cartaoHabilitado: asaasCartaoHabilitado(),
      podeEditarReserva: user.role === 'admin',
      reserva: await lerReserva(veiculoId),
      cobrancas,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao carregar.' }
  }
}

/** Sugere o % da reserva a partir do saldo devedor e das parcelas ainda em aberto da cobrança. */
export async function sugerirReservaVeiculo(
  cobrancaId: string,
  saldoDevedor: number,
  taxaEstimadaPorParcela: number,
): Promise<AsaasResponse<{ pct: number; parcelasRestantes: number }>> {
  try {
    await autorizar()
    if (!(saldoDevedor > 0)) return { error: 'Informe o saldo devedor.' }
    const snap = await adminDb
      .collection('cobranca_parcelas')
      .where('cobrancaId', '==', cobrancaId)
      .get()
    // Só o principal em aberto: encargos futuros são incertos e não entram na conta.
    const semEncargos = { multaPct: 0, jurosMensalPct: 0, encargosDesde: null }
    let restante = 0
    let qtd = 0
    for (const doc of snap.docs) {
      if (doc.data().suspensa) continue
      const pag = await adminDb
        .collection('cobranca_pagamentos')
        .where('parcelaId', '==', doc.id)
        .get()
      const r = calcularParcela(doc.data(), semEncargos, pagamentosDoSnap(pag))
      if (r.principalRestante > EPSILON) {
        restante += r.principalRestante
        qtd += 1
      }
    }
    if (qtd === 0) return { error: 'Não há parcelas em aberto.' }
    const pct = sugerirPercentualReserva({
      saldoDevedor,
      valorParcelasRestantes: restante,
      parcelasRestantes: qtd,
      taxaEstimadaPorParcela: Math.max(taxaEstimadaPorParcela, 0),
    })
    return { success: 'ok', pct, parcelasRestantes: qtd }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao calcular.' }
  }
}

export async function definirReservaVeiculo(
  veiculoId: string,
  dados: { pct: number; saldoDevedorBase: number | null; parcelasRestantes: number | null },
): Promise<AsaasResponse> {
  try {
    const user = await autorizar()
    if (user.role !== 'admin') return { error: 'Somente administradores definem a reserva.' }
    if (!Number.isFinite(dados.pct) || dados.pct < 0 || dados.pct > 100) {
      return { error: 'O percentual deve estar entre 0 e 100.' }
    }
    const pct = Math.round(dados.pct * 10000) / 10000
    await adminDb
      .collection(COL_RESERVA)
      .doc(veiculoId)
      .set(
        {
          pct,
          saldoDevedorBase: dados.saldoDevedorBase,
          parcelasRestantes: dados.parcelasRestantes,
          atualizadoEm: new Date().toISOString(),
          atualizadoPor: user.name || user.email || user.uid,
        },
        { merge: true },
      )
    return { success: 'Reserva do veículo salva. Vale para as próximas cobranças geradas.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao salvar.' }
  }
}

export async function gerarCobrancaAsaas(
  parcelaId: string,
  billingType: AsaasBillingType,
): Promise<AsaasResponse<{ link: string | null }>> {
  try {
    const user = await autorizar()
    if (!asaasConfigurado()) {
      return { error: 'Asaas não configurado (ASAAS_API_KEY e ASAAS_RESERVA_WALLET_ID).' }
    }
    if (billingType === 'CREDIT_CARD') {
      return {
        error: asaasCartaoHabilitado()
          ? 'Cobrança no cartão ainda não implementada (exige checkout/dados do cartão).'
          : 'Cartão com split ainda não foi validado com o Asaas. Use Pix ou boleto.',
      }
    }

    const parcelaDoc = await adminDb.collection('cobranca_parcelas').doc(parcelaId).get()
    if (!parcelaDoc.exists) return { error: 'Parcela não encontrada.' }
    const parcela = parcelaDoc.data()!
    if (parcela.suspensa) return { error: 'Parcela suspensa.' }

    const existentes = await adminDb.collection(COL_COBRANCAS).where('parcelaId', '==', parcelaId).get()
    if (existentes.docs.some((d) => ['pendente', 'vencida'].includes(d.data().status))) {
      return {
        error: 'Já existe uma cobrança Asaas em aberto para esta parcela. Cancele-a antes de gerar outra.',
      }
    }

    const [cobDoc, pagSnap] = await Promise.all([
      adminDb.collection('cobrancas').doc(parcela.cobrancaId).get(),
      adminDb.collection('cobranca_pagamentos').where('parcelaId', '==', parcelaId).get(),
    ])
    const cob = cobDoc.data()
    if (!cob) return { error: 'Cobrança não encontrada.' }
    const cpf: string = cob.cliente?.cpf ?? ''
    if (cpf.length !== 11) {
      return { error: 'O cliente precisa ter CPF cadastrado para gerar cobrança no Asaas.' }
    }

    // Vence hoje ou no vencimento da parcela (o que for mais tarde); valor = total devido nessa data.
    const hoje = hojeSaoPaulo()
    const vencimento = parcela.dataVencimento > hoje ? parcela.dataVencimento : hoje
    const devido = calcularParcela(
      parcela,
      taxasDaCobranca(cob),
      pagamentosDoSnap(pagSnap),
      vencimento,
    ).totalDevido
    if (devido <= EPSILON) return { error: 'Parcela já quitada.' }

    const reserva = await lerReserva(cob.veiculoId)
    const customer = await buscarOuCriarCliente({
      nome: cob.clienteNome,
      cpfCnpj: cpf,
      email: cob.clienteEmail,
      telefone: cob.cliente?.telefone,
    })
    const payment = await criarCobranca({
      customer,
      billingType,
      value: round2(devido),
      dueDate: vencimento,
      description: `Parcela ${parcela.numeroParcela}/${cob.numeroParcelas} — ${cob.veiculoResumo}`,
      externalReference: parcelaId,
      reservaPct: reserva.pct,
    })
    const link =
      payment.billingType === 'BOLETO'
        ? (payment.bankSlipUrl ?? payment.invoiceUrl ?? null)
        : (payment.invoiceUrl ?? null)
    await adminDb
      .collection(COL_COBRANCAS)
      .doc(payment.id)
      .set({
        veiculoId: cob.veiculoId,
        cobrancaId: parcela.cobrancaId,
        parcelaId,
        billingType,
        valor: round2(devido),
        vencimento,
        status: 'pendente',
        link,
        reservaPct: reserva.pct,
        divergencia: false,
        criadoEm: new Date().toISOString(),
        criadoPor: user.name || user.email || user.uid,
      })
    revalidatePath('/dashboard/cobrancas')
    return {
      success:
        reserva.pct > 0
          ? 'Cobrança gerada com split de reserva.'
          : 'Cobrança gerada SEM split (veículo sem % de reserva).',
      link,
    }
  } catch (err) {
    if (err instanceof AsaasError) return { error: `Asaas: ${err.message}` }
    console.error('[gerarCobrancaAsaas]', err)
    return { error: err instanceof Error ? err.message : 'Erro ao gerar cobrança.' }
  }
}

export async function cancelarCobrancaAsaas(paymentId: string): Promise<AsaasResponse> {
  try {
    await autorizar()
    const ref = adminDb.collection(COL_COBRANCAS).doc(paymentId)
    const snap = await ref.get()
    if (!snap.exists) return { error: 'Cobrança não encontrada.' }
    if (!['pendente', 'vencida'].includes(snap.data()!.status)) {
      return { error: 'Só é possível cancelar cobranças ainda não pagas.' }
    }
    await excluirCobranca(paymentId)
    await ref.update({ status: 'cancelada', canceladaEm: new Date().toISOString() })
    return { success: 'Cobrança cancelada no Asaas.' }
  } catch (err) {
    if (err instanceof AsaasError) return { error: `Asaas: ${err.message}` }
    return { error: err instanceof Error ? err.message : 'Erro ao cancelar.' }
  }
}

export interface ResumoReservaVeiculo {
  saldoAcumulado: number
  pct: number
  lancamentos: {
    paymentId: string
    tipo: string
    liquido: number
    valorReserva: number
    valorCaixa: number
    status: string
    fonte: string
    criadoEm: string
  }[]
}

export async function getResumoReserva(
  veiculoId: string,
): Promise<ResumoReservaVeiculo | { error: string }> {
  try {
    await autorizar()
    const [reserva, snap] = await Promise.all([
      lerReserva(veiculoId),
      adminDb.collection(COL_LANCAMENTOS).where('veiculoId', '==', veiculoId).get(),
    ])
    return {
      saldoAcumulado: reserva.saldoAcumulado,
      pct: reserva.pct,
      lancamentos: snap.docs
        .map((d) => d.data())
        .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
        .map((d) => ({
          paymentId: d.paymentId,
          tipo: d.tipo,
          liquido: d.liquido,
          valorReserva: d.valorReserva,
          valorCaixa: d.valorCaixa,
          status: d.status,
          fonte: d.fonte,
          criadoEm: d.criadoEm,
        })),
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao carregar.' }
  }
}

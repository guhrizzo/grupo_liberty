'use server'

import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { processarLembretesCobranca } from '@/utils/cobrancas/processar-lembretes'
import { sendCobrancaLembreteEmail } from '@/utils/email/send-cobranca-lembrete-email'
import { sendCobrancaAtrasoEmail } from '@/utils/email/send-cobranca-atraso-email'
import { sendComprovantePagamentoEmail } from '@/utils/email/send-comprovante-pagamento-email'

// ─── Types ───────────────────────────────────────────────────────────────────

export type TipoCobranca = 'aluguel' | 'promissoria' | 'quinzenal'
export type StatusParcela = 'pendente' | 'parcial' | 'pago' | 'atrasado'

export interface Pagamento {
  id: string
  parcelaId: string
  cobrancaId: string
  valor: number
  data: string // YYYY-MM-DD — data em que o pagamento foi/será feito
  criadoEm: string
  // Id da receita lançada automaticamente em /dashboard/financeiro para este
  // pagamento (null se nunca teve, ou se o vínculo já foi desfeito).
  transacaoId: string | null
}

export interface Parcela {
  id: string
  cobrancaId: string
  numeroParcela: number
  valorParcela: number
  dataVencimento: string // YYYY-MM-DD
  status: StatusParcela
  pago: boolean // true somente quando quitada (valorPago >= valorParcela)
  pagoEm: string | null // data do último pagamento registrado
  valorPago: number // soma de todos os pagamentos registrados
  valorRestante: number // valorParcela - valorPago (nunca negativo)
  pagamentos: Pagamento[]
  // Marcadores dos 3 momentos fixos de envio de e-mail
  lembrete3dEnviadoEm: string | null // e-mail enviado 3 dias antes do vencimento
  lembrete0dEnviadoEm: string | null // e-mail enviado no dia do vencimento
  avisoAtrasoEnviadoEm: string | null // e-mail enviado 1 dia após o vencimento
  /** @deprecated use lembrete3dEnviadoEm — mantido por compatibilidade com registros antigos */
  lembreteEnviadoEm: string | null
  // Edição manual do valor da parcela (marca a parcela como "editada")
  valorOriginal: number | null // valor antes da primeira edição manual
  valorEditadoPor: string | null // nome de quem fez a alteração
  valorEditadoMotivo: string | null // motivo informado (opcional)
  valorEditadoEm: string | null // data/hora da última edição
}

export interface Cobranca {
  id: string
  clienteNome: string
  clienteEmail: string | null
  veiculoId: string
  veiculoResumo: string
  valorTotal: number
  valorEntrada: number | null
  numeroParcelas: number
  diaVencimento: number
  tipo: TipoCobranca
  /** @deprecated não é mais usado para controlar envios — mantido por compatibilidade */
  diasAvisoAntecedencia: number | null
  /** true = notificações por e-mail ativas (3 dias antes, no dia, 1 dia após) */
  avisarAtraso: boolean
  criadoEm: string
  criadoPorUid: string | null
  parcelas: Parcela[]
}

/**
 * Resultado do envio do comprovante disparado por `registrarPagamento`:
 * - `enviado` / `falhou`: a cobrança tinha e-mail; o envio foi tentado.
 * - `sem-email`: a cobrança não tem e-mail — o client deve pedir um e
 *   chamar `enviarComprovantePagamento`.
 */
export type ComprovanteResultado =
  | { status: 'enviado'; email: string }
  | { status: 'falhou'; email: string }
  | { status: 'sem-email'; pagamentoId: string; quitada: boolean; numeroParcela: number }

export type CobrancaResponse = {
  success?: string
  error?: string
  comprovante?: ComprovanteResultado
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EPSILON = 0.01

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

function computeStatus(
  dataVencimento: string,
  valorPago: number,
  valorParcela: number,
): StatusParcela {
  if (valorPago >= valorParcela - EPSILON) return 'pago'
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const venc = new Date(dataVencimento + 'T00:00:00')
  if (venc < hoje) return 'atrasado'
  if (valorPago > 0) return 'parcial'
  return 'pendente'
}

function serializePagamento(id: string, data: FirebaseFirestore.DocumentData): Pagamento {
  return {
    id,
    parcelaId: data.parcelaId,
    cobrancaId: data.cobrancaId,
    valor: data.valor,
    data: data.data,
    criadoEm: data.criadoEm,
    transacaoId: data.transacaoId ?? null,
  }
}

function serializeParcela(
  id: string,
  data: FirebaseFirestore.DocumentData,
  pagamentos: Pagamento[],
): Parcela {
  const valorParcela = data.valorParcela
  const pagamentosOrdenados = [...pagamentos].sort((a, b) => a.data.localeCompare(b.data))
  const valorPago = round2(pagamentosOrdenados.reduce((s, p) => s + p.valor, 0))
  const status = computeStatus(data.dataVencimento, valorPago, valorParcela)
  return {
    id,
    cobrancaId: data.cobrancaId,
    numeroParcela: data.numeroParcela,
    valorParcela,
    dataVencimento: data.dataVencimento,
    status,
    pago: status === 'pago',
    pagoEm:
      pagamentosOrdenados.length > 0
        ? pagamentosOrdenados[pagamentosOrdenados.length - 1].data
        : null,
    valorPago,
    valorRestante: Math.max(round2(valorParcela - valorPago), 0),
    pagamentos: pagamentosOrdenados,
    lembrete3dEnviadoEm: data.lembrete3dEnviadoEm ?? null,
    lembrete0dEnviadoEm: data.lembrete0dEnviadoEm ?? null,
    avisoAtrasoEnviadoEm: data.avisoAtrasoEnviadoEm ?? null,
    lembreteEnviadoEm: data.lembreteEnviadoEm ?? null,
    valorOriginal: data.valorOriginal ?? null,
    valorEditadoPor: data.valorEditadoPor ?? null,
    valorEditadoMotivo: data.valorEditadoMotivo ?? null,
    valorEditadoEm: data.valorEditadoEm ?? null,
  }
}

async function assertAuthorized() {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')
  if (!hasPageAccess(user, 'cobrancas', ['admin', 'vendedor'])) {
    throw new Error('Acesso negado. Apenas administradores e vendedores podem acessar.')
  }
  return user
}

// ─── Integração com /dashboard/financeiro ─────────────────────────────────
//
// Todo pagamento de parcela recebido vira automaticamente uma receita
// (entrada) em /dashboard/financeiro. Grava direto na coleção `transacoes`
// (não passa por `createTransacao`, que exige admin — pagamentos podem ser
// registrados por vendedores também). O vínculo é bidirecional:
//   - o pagamento guarda `transacaoId` (id do lançamento no financeiro)
//   - o lançamento guarda `origemPagamentoId`/`origemCobrancaId`/`origemParcelaId`
// Isso permite perguntar ao usuário, na hora de remover de um lado, se quer
// remover do outro também (em vez de cascatear silenciosamente).

async function registrarReceitaCobranca(params: {
  descricao: string
  valor: number
  data: string
  uid: string | null
  pagamentoId: string
  cobrancaId: string
  parcelaId: string
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
      origem: 'cobranca', // marca lançamentos gerados automaticamente por pagamentos
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

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getCobrancas(): Promise<Cobranca[]> {
  try {
    await assertAuthorized()
  } catch {
    return []
  }

  const [cobrancasSnap, parcelasSnap, pagamentosSnap] = await Promise.all([
    adminDb.collection('cobrancas').orderBy('criadoEm', 'desc').get(),
    adminDb.collection('cobranca_parcelas').orderBy('numeroParcela', 'asc').get(),
    adminDb.collection('cobranca_pagamentos').get(),
  ])

  const pagamentosPorParcela = new Map<string, Pagamento[]>()
  for (const doc of pagamentosSnap.docs) {
    const pg = serializePagamento(doc.id, doc.data())
    const list = pagamentosPorParcela.get(pg.parcelaId) ?? []
    list.push(pg)
    pagamentosPorParcela.set(pg.parcelaId, list)
  }

  const parcelasPorCobranca = new Map<string, Parcela[]>()
  for (const doc of parcelasSnap.docs) {
    const p = serializeParcela(doc.id, doc.data(), pagamentosPorParcela.get(doc.id) ?? [])
    const list = parcelasPorCobranca.get(p.cobrancaId) ?? []
    list.push(p)
    parcelasPorCobranca.set(p.cobrancaId, list)
  }

  return cobrancasSnap.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      clienteNome: data.clienteNome,
      clienteEmail: data.clienteEmail ?? null,
      veiculoId: data.veiculoId,
      veiculoResumo: data.veiculoResumo,
      valorTotal: data.valorTotal,
      valorEntrada:
        typeof data.valorEntrada === 'number' && data.valorEntrada > 0
          ? data.valorEntrada
          : null,
      numeroParcelas: data.numeroParcelas,
      diaVencimento: data.diaVencimento,
      tipo: data.tipo,
      diasAvisoAntecedencia:
        typeof data.diasAvisoAntecedencia === 'number' && data.diasAvisoAntecedencia > 0
          ? data.diasAvisoAntecedencia
          : null,
      avisarAtraso: Boolean(data.avisarAtraso),
      criadoEm: data.criadoEm,
      criadoPorUid: data.criadoPorUid ?? null,
      parcelas: parcelasPorCobranca.get(doc.id) ?? [],
    }
  })
}

export async function criarCobranca(formData: FormData): Promise<CobrancaResponse> {
  let uid: string | null = null
  try {
    const user = await assertAuthorized()
    uid = user.uid
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  try {
    const clienteNome = (formData.get('clienteNome') as string || '').trim()
    const clienteEmailRaw = (formData.get('clienteEmail') as string || '').trim()
    const veiculoId = (formData.get('veiculoId') as string || '').trim()
    const veiculoResumo = (formData.get('veiculoResumo') as string || '').trim()
    const valorTotal = parseFloat(formData.get('valorTotal') as string || '0')
    const numeroParcelas = parseInt(formData.get('numeroParcelas') as string || '1', 10)
    const diaVencimento = parseInt(formData.get('diaVencimento') as string || '1', 10)
    const tipo = (formData.get('tipo') as string || 'promissoria') as TipoCobranca
    const primeiraParcela = (formData.get('primeiraParcela') as string || '').trim()
    const valorEntradaRaw = parseFloat(formData.get('valorEntrada') as string || '0')
    const valorEntrada =
      !isNaN(valorEntradaRaw) && valorEntradaRaw > 0 ? valorEntradaRaw : 0
    const diasAvisoRaw = parseInt(formData.get('diasAvisoAntecedencia') as string || '', 10)
    const diasAvisoAntecedencia =
      !isNaN(diasAvisoRaw) && diasAvisoRaw > 0 ? Math.min(diasAvisoRaw, 60) : null
    const avisarAtraso = (formData.get('avisarAtraso') as string) === 'true'

    if (!clienteNome) return { error: 'Informe o nome do cliente.' }
    if (!veiculoId) return { error: 'Selecione um veículo.' }
    if (isNaN(valorTotal) || valorTotal <= 0) return { error: 'Valor total inválido.' }
    if (valorEntrada >= valorTotal)
      return { error: 'O valor de entrada deve ser menor que o valor total.' }
    if (isNaN(numeroParcelas) || numeroParcelas < 1 || numeroParcelas > 300) return { error: 'Número de parcelas inválido (1–300).' }
    if (!primeiraParcela) return { error: 'Informe a data da primeira parcela.' }
    if ((diasAvisoAntecedencia || avisarAtraso) && !clienteEmailRaw) {
      return { error: 'Informe o e-mail do cliente para poder enviar os avisos.' }
    }
    if (clienteEmailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteEmailRaw)) {
      return { error: 'E-mail do cliente inválido.' }
    }

    const saldo = valorTotal - valorEntrada
    const valorParcela = Math.round((saldo / numeroParcelas) * 100) / 100

    // Criar documento da cobrança
    const cobrancaRef = await adminDb.collection('cobrancas').add({
      clienteNome,
      clienteEmail: clienteEmailRaw || null,
      veiculoId,
      veiculoResumo,
      valorTotal,
      valorEntrada: valorEntrada > 0 ? valorEntrada : null,
      numeroParcelas,
      diaVencimento,
      tipo,
      diasAvisoAntecedencia,
      avisarAtraso,
      criadoEm: new Date().toISOString(),
      criadoPorUid: uid,
    })

    // Gerar parcelas
    const batch = adminDb.batch()
    const baseDate = new Date(primeiraParcela + 'T12:00:00')

    for (let i = 0; i < numeroParcelas; i++) {
      let dataVencimento: string

      if (tipo === 'aluguel') {
        // Semanal: +7 dias por parcela
        dataVencimento = toDateString(addWeeks(baseDate, i))
      } else if (tipo === 'quinzenal') {
        // Quinzenal: +15 dias por parcela
        dataVencimento = toDateString(addDays(baseDate, i * 15))
      } else {
        // Mensal: mesmo dia do mês, avança meses
        const d = addMonths(baseDate, i)
        // Forçar o dia de vencimento (caso o mês tenha menos dias, usa o último dia)
        const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        d.setDate(Math.min(diaVencimento, ultimoDia))
        dataVencimento = toDateString(d)
      }

      const parcelaRef = adminDb.collection('cobranca_parcelas').doc()
      batch.set(parcelaRef, {
        cobrancaId: cobrancaRef.id,
        numeroParcela: i + 1,
        valorParcela,
        dataVencimento,
        pago: false,
        pagoEm: null,
      })
    }

    await batch.commit()
    revalidatePath('/dashboard/cobrancas')
    return { success: 'Cobrança cadastrada com sucesso!' }
  } catch (err: any) {
    console.error('[criarCobranca]', err)
    return { error: 'Erro ao salvar. Tente novamente.' }
  }
}

/**
 * Toggle de notificações de uma cobrança.
 * Ativa ou desativa os 3 e-mails automáticos (3d antes, no dia, 1d após).
 * Requer que a cobrança já tenha um e-mail cadastrado para ativar.
 */
export async function atualizarLembrete(
  cobrancaId: string,
  avisarAtraso: boolean,
): Promise<CobrancaResponse> {
  try {
    await assertAuthorized()
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  try {
    if (!cobrancaId) return { error: 'Cobrança inválida.' }

    if (avisarAtraso) {
      // Verifica se a cobrança tem e-mail antes de ativar
      const doc = await adminDb.collection('cobrancas').doc(cobrancaId).get()
      if (!doc.exists) return { error: 'Cobrança não encontrada.' }
      const email = (doc.data()?.clienteEmail as string | null) || ''
      if (!email.trim()) {
        return { error: 'Adicione o e-mail do cliente antes de ativar as notificações.' }
      }
    }

    await adminDb.collection('cobrancas').doc(cobrancaId).update({
      avisarAtraso: Boolean(avisarAtraso),
    })

    revalidatePath('/dashboard/cobrancas')
    return {
      success: avisarAtraso ? 'Notificações ativadas.' : 'Notificações desativadas.',
    }
  } catch (err: any) {
    console.error('[atualizarLembrete]', err)
    return { error: 'Erro ao salvar as notificações.' }
  }
}

/**
 * Edita dados básicos de uma cobrança existente.
 * Campos imutáveis (tipo, numeroParcelas, valorTotal, parcelas) não são alterados.
 */
export async function editarCobranca(
  cobrancaId: string,
  dados: {
    clienteNome: string
    clienteEmail: string
    veiculoId: string
    veiculoResumo: string
  },
): Promise<CobrancaResponse> {
  try {
    await assertAuthorized()
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  try {
    if (!cobrancaId) return { error: 'Cobrança inválida.' }

    const nome = (dados.clienteNome || '').trim()
    const email = (dados.clienteEmail || '').trim()
    const veiculoId = (dados.veiculoId || '').trim()
    const veiculoResumo = (dados.veiculoResumo || '').trim()

    if (!nome) return { error: 'Informe o nome do cliente.' }
    if (!veiculoId) return { error: 'Selecione um veículo.' }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'E-mail inválido.' }
    }

    const updateData: Record<string, unknown> = {
      clienteNome: nome,
      clienteEmail: email || null,
      veiculoId,
      veiculoResumo,
    }

    // Se o e-mail foi removido, desativa automaticamente as notificações
    if (!email) {
      updateData.avisarAtraso = false
    }

    await adminDb.collection('cobrancas').doc(cobrancaId).update(updateData)

    revalidatePath('/dashboard/cobrancas')
    return { success: 'Cobrança atualizada.' }
  } catch (err: any) {
    console.error('[editarCobranca]', err)
    return { error: 'Erro ao salvar as alterações.' }
  }
}

export type TestarLembretesResponse = CobrancaResponse & {
  verificados?: number
  enviados?: number
}

/**
 * Dispara manualmente a checagem de lembretes de vencimento — mesma lógica
 * do cron diário (/api/cron/lembretes-cobranca). Existe para testar em
 * ambiente local/dev, onde não há cron da Vercel rodando sozinho.
 */
export async function testarLembretes(): Promise<TestarLembretesResponse> {
  try {
    await assertAuthorized()
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  try {
    const { verificados, enviados, erros } = await processarLembretesCobranca()
    revalidatePath('/dashboard/cobrancas')

    if (erros.length > 0) {
      return {
        error: `${enviados} enviado(s), mas ${erros.length} lembrete(s) falharam ao enviar. Verifique os logs.`,
        verificados,
        enviados,
      }
    }
    return {
      success:
        enviados > 0
          ? `${enviados} lembrete${enviados === 1 ? '' : 's'} enviado${enviados === 1 ? '' : 's'} (${verificados} parcela${verificados === 1 ? '' : 's'} verificada${verificados === 1 ? '' : 's'}).`
          : `Nenhum lembrete a enviar agora (${verificados} parcela${verificados === 1 ? '' : 's'} verificada${verificados === 1 ? '' : 's'}).`,
      verificados,
      enviados,
    }
  } catch (err: any) {
    console.error('[testarLembretes]', err)
    return { error: 'Erro ao processar lembretes.' }
  }
}

/**
 * Envia manualmente, agora, um e-mail de cobrança para o cliente de UMA
 * cobrança específica — diferente de `testarLembretes` (que processa todas
 * as cobranças respeitando os 3 momentos fixos de envio). Aqui o envio é
 * imediato, independente de data: escolhe a parcela em aberto mais urgente
 * (a mais atrasada, ou se não houver atraso, a próxima a vencer) e dispara
 * o e-mail correspondente (lembrete ou aviso de atraso).
 *
 * Exceção: cobranças semanais (tipo `aluguel`) só podem ser enviadas no dia
 * do vencimento da parcela — mesma regra do envio automático. Fora do dia,
 * retorna erro explicando o motivo em vez de enviar.
 */
export async function enviarEmailCobranca(cobrancaId: string): Promise<CobrancaResponse> {
  try {
    await assertAuthorized()
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  try {
    if (!cobrancaId) return { error: 'Cobrança inválida.' }

    const cobrancaDoc = await adminDb.collection('cobrancas').doc(cobrancaId).get()
    if (!cobrancaDoc.exists) return { error: 'Cobrança não encontrada.' }
    const cobranca = cobrancaDoc.data()!

    const clienteEmail = ((cobranca.clienteEmail as string | null) || '').trim()
    if (!clienteEmail) {
      return { error: 'Este cliente não tem e-mail cadastrado. Edite a cobrança para adicionar.' }
    }

    const [parcelasSnap, pagamentosSnap] = await Promise.all([
      adminDb.collection('cobranca_parcelas').where('cobrancaId', '==', cobrancaId).get(),
      adminDb.collection('cobranca_pagamentos').where('cobrancaId', '==', cobrancaId).get(),
    ])

    const pagoPorParcela = new Map<string, number>()
    for (const doc of pagamentosSnap.docs) {
      const data = doc.data()
      pagoPorParcela.set(data.parcelaId, (pagoPorParcela.get(data.parcelaId) ?? 0) + (data.valor || 0))
    }

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    // Escolhe a parcela em aberto mais urgente (menor `diasRestantes`,
    // negativo = atrasada). Parcelas já quitadas são ignoradas.
    let alvo: {
      parcela: FirebaseFirestore.DocumentData
      valorRestante: number
      diasRestantes: number
    } | null = null

    for (const parcelaDoc of parcelasSnap.docs) {
      const parcela = parcelaDoc.data()
      const valorPago = pagoPorParcela.get(parcelaDoc.id) ?? 0
      const valorRestante = round2(Math.max(parcela.valorParcela - valorPago, 0))
      if (valorRestante <= EPSILON) continue // já quitada

      const venc = new Date(parcela.dataVencimento + 'T00:00:00')
      const diasRestantes = Math.round((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

      if (!alvo || diasRestantes < alvo.diasRestantes) {
        alvo = { parcela, valorRestante, diasRestantes }
      }
    }

    if (!alvo) {
      return { error: 'Este cliente não possui parcelas em aberto.' }
    }

    // Cobranças semanais (aluguel) só podem ter o e-mail enviado (manual ou
    // automático) no dia do vencimento da parcela — sem antecipar nem atrasar.
    if (cobranca.tipo === 'aluguel' && alvo.diasRestantes !== 0) {
      const dataFormatada = new Date(alvo.parcela.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR')
      return {
        error:
          alvo.diasRestantes > 0
            ? `Cobrança semanal: o envio só é liberado no dia do vencimento (${dataFormatada}, em ${alvo.diasRestantes} dia${alvo.diasRestantes === 1 ? '' : 's'}).`
            : `Cobrança semanal: o envio só é liberado no dia do vencimento. A parcela mais próxima já venceu em ${dataFormatada}.`,
      }
    }

    const clienteNome = cobranca.clienteNome
    const veiculoResumo = cobranca.veiculoResumo
    const numeroParcelas = cobranca.numeroParcelas

    const ok =
      alvo.diasRestantes < 0
        ? await sendCobrancaAtrasoEmail({
            clienteNome,
            clienteEmail,
            veiculoResumo,
            numeroParcela: alvo.parcela.numeroParcela,
            numeroParcelas,
            valorRestante: alvo.valorRestante,
            dataVencimento: alvo.parcela.dataVencimento,
            diasAtraso: Math.abs(alvo.diasRestantes),
          })
        : await sendCobrancaLembreteEmail({
            clienteNome,
            clienteEmail,
            veiculoResumo,
            numeroParcela: alvo.parcela.numeroParcela,
            numeroParcelas,
            valorParcela: alvo.parcela.valorParcela,
            dataVencimento: alvo.parcela.dataVencimento,
            diasRestantes: alvo.diasRestantes,
          })

    if (!ok) {
      return { error: 'Falha ao enviar o e-mail. Verifique se o RESEND_API_KEY está configurado.' }
    }

    return { success: `E-mail enviado para ${clienteEmail}.` }
  } catch (err: any) {
    console.error('[enviarEmailCobranca]', err)
    return { error: 'Erro ao enviar o e-mail.' }
  }
}

/**
 * Registra um pagamento (total ou parcial) para uma parcela.
 * Ex.: parcela de R$100 — cliente paga R$80 agora e R$20 dias depois.
 * Cada chamada cria um novo registro em `cobranca_pagamentos`; o valor pago
 * da parcela é a soma de todos os registros.
 */
export async function registrarPagamento(
  parcelaId: string,
  valor: number,
  data: string,
): Promise<CobrancaResponse> {
  let uid: string | null = null
  try {
    const user = await assertAuthorized()
    uid = user.uid
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  try {
    if (!parcelaId) return { error: 'Parcela inválida.' }
    if (typeof valor !== 'number' || isNaN(valor) || valor <= 0) {
      return { error: 'Informe um valor de pagamento válido.' }
    }
    if (!data) return { error: 'Informe a data do pagamento.' }

    const parcelaRef = adminDb.collection('cobranca_parcelas').doc(parcelaId)
    const parcelaDoc = await parcelaRef.get()
    if (!parcelaDoc.exists) return { error: 'Parcela não encontrada.' }
    const parcelaData = parcelaDoc.data()!

    const pagamentosSnap = await adminDb
      .collection('cobranca_pagamentos')
      .where('parcelaId', '==', parcelaId)
      .get()
    const totalPago = round2(
      pagamentosSnap.docs.reduce((s, doc) => s + (doc.data().valor || 0), 0),
    )
    const saldo = round2(parcelaData.valorParcela - totalPago)

    if (saldo <= EPSILON) return { error: 'Esta parcela já está totalmente paga.' }
    const valorArredondado = round2(valor)
    if (valorArredondado > saldo + EPSILON) {
      return {
        error: `Valor maior que o saldo restante (R$ ${saldo.toFixed(2).replace('.', ',')}).`,
      }
    }

    // Busca dados da cobrança para descrever a receita no financeiro.
    const cobrancaDoc = await adminDb.collection('cobrancas').doc(parcelaData.cobrancaId).get()
    const cobranca = cobrancaDoc.data()

    // Gera o id do pagamento antes de gravar (sem custo de rede) para poder
    // guardar o vínculo dos dois lados desde a criação.
    const pagamentoRef = adminDb.collection('cobranca_pagamentos').doc()

    const transacaoId = await registrarReceitaCobranca({
      descricao: cobranca
        ? `Parcela ${parcelaData.numeroParcela}/${cobranca.numeroParcelas} — ${cobranca.clienteNome} (${cobranca.veiculoResumo})`
        : `Parcela ${parcelaData.numeroParcela} — cobrança`,
      valor: valorArredondado,
      data,
      uid,
      pagamentoId: pagamentoRef.id,
      cobrancaId: parcelaData.cobrancaId,
      parcelaId,
    })

    await pagamentoRef.set({
      parcelaId,
      cobrancaId: parcelaData.cobrancaId,
      valor: valorArredondado,
      data,
      criadoEm: new Date().toISOString(),
      transacaoId: transacaoId ?? null,
    })

    const restante = round2(saldo - valorArredondado)
    const quitada = restante <= EPSILON

    // Comprovante ao cliente (e-mail HTML + recibo PDF). Best-effort: qualquer
    // problema aqui vira um `status` e nunca desfaz o pagamento.
    const clienteEmail = ((cobranca?.clienteEmail as string | null) || '').trim()
    let comprovante: ComprovanteResultado
    if (!clienteEmail) {
      comprovante = {
        status: 'sem-email',
        pagamentoId: pagamentoRef.id,
        quitada,
        numeroParcela: parcelaData.numeroParcela,
      }
    } else {
      try {
        const ok = await sendComprovantePagamentoEmail({
          clienteNome: cobranca?.clienteNome ?? 'Cliente',
          clienteEmail,
          veiculoResumo: cobranca?.veiculoResumo ?? '',
          numeroParcela: parcelaData.numeroParcela,
          numeroParcelas: cobranca?.numeroParcelas ?? parcelaData.numeroParcela,
          valorParcela: parcelaData.valorParcela,
          valorPagoAgora: valorArredondado,
          dataPagamento: data,
          dataVencimento: parcelaData.dataVencimento,
          valorPagoAcumulado: round2(totalPago + valorArredondado),
          valorRestante: Math.max(restante, 0),
          quitada,
          referencia: pagamentoRef.id.slice(0, 8).toUpperCase(),
        })
        comprovante = ok
          ? { status: 'enviado', email: clienteEmail }
          : { status: 'falhou', email: clienteEmail }
      } catch (e) {
        console.error('[registrarPagamento] falha ao enviar comprovante:', e)
        comprovante = { status: 'falhou', email: clienteEmail }
      }
    }

    revalidatePath('/dashboard/cobrancas')
    revalidatePath('/dashboard/financeiro')
    return {
      success: quitada
        ? 'Parcela quitada! Lançado como entrada no financeiro.'
        : `Pagamento registrado. Saldo restante: R$ ${restante.toFixed(2).replace('.', ',')}.`,
      comprovante,
    }
  } catch (err: any) {
    console.error('[registrarPagamento]', err)
    return { error: 'Erro ao registrar pagamento.' }
  }
}

/**
 * Envia o comprovante de um pagamento para um e-mail informado na hora (quando
 * a cobrança não tinha e-mail cadastrado). Salva o e-mail em
 * `cobranca.clienteEmail` para os próximos envios e dispara o comprovante.
 */
export async function enviarComprovantePagamento(
  pagamentoId: string,
  email: string,
): Promise<CobrancaResponse> {
  try {
    await assertAuthorized()
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  try {
    const emailTrim = (email || '').trim()
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      return { error: 'E-mail inválido.' }
    }
    if (!pagamentoId) return { error: 'Pagamento inválido.' }

    const pagamentoDoc = await adminDb.collection('cobranca_pagamentos').doc(pagamentoId).get()
    if (!pagamentoDoc.exists) return { error: 'Pagamento não encontrado.' }
    const pagamento = pagamentoDoc.data()!

    const parcelaDoc = await adminDb
      .collection('cobranca_parcelas')
      .doc(pagamento.parcelaId)
      .get()
    if (!parcelaDoc.exists) return { error: 'Parcela não encontrada.' }
    const parcela = parcelaDoc.data()!

    const cobrancaRef = adminDb.collection('cobrancas').doc(pagamento.cobrancaId)
    const cobrancaDoc = await cobrancaRef.get()
    if (!cobrancaDoc.exists) return { error: 'Cobrança não encontrada.' }
    const cobranca = cobrancaDoc.data()!

    await cobrancaRef.update({ clienteEmail: emailTrim })

    const pagamentosSnap = await adminDb
      .collection('cobranca_pagamentos')
      .where('parcelaId', '==', pagamento.parcelaId)
      .get()
    const valorPagoAcumulado = round2(
      pagamentosSnap.docs.reduce((s, doc) => s + (doc.data().valor || 0), 0),
    )
    const valorRestante = Math.max(round2(parcela.valorParcela - valorPagoAcumulado), 0)
    const quitada = valorRestante <= EPSILON

    const ok = await sendComprovantePagamentoEmail({
      clienteNome: cobranca.clienteNome ?? 'Cliente',
      clienteEmail: emailTrim,
      veiculoResumo: cobranca.veiculoResumo ?? '',
      numeroParcela: parcela.numeroParcela,
      numeroParcelas: cobranca.numeroParcelas ?? parcela.numeroParcela,
      valorParcela: parcela.valorParcela,
      valorPagoAgora: pagamento.valor,
      dataPagamento: pagamento.data,
      dataVencimento: parcela.dataVencimento,
      valorPagoAcumulado,
      valorRestante,
      quitada,
      referencia: pagamentoId.slice(0, 8).toUpperCase(),
    })

    revalidatePath('/dashboard/cobrancas')

    return ok
      ? { success: `Comprovante enviado para ${emailTrim}.` }
      : {
          error:
            'E-mail salvo no cadastro, mas o envio falhou. Verifique o RESEND_API_KEY.',
        }
  } catch (err) {
    console.error('[enviarComprovantePagamento]', err)
    return { error: 'Erro ao enviar o comprovante.' }
  }
}

/**
 * Edita manualmente o valor de uma parcela (ex.: renegociação, desconto,
 * correção). Exige o nome de quem está fazendo a alteração; o motivo é
 * opcional. A parcela fica marcada como "editada" (guarda o valor original,
 * quem editou, o motivo e quando) e o valor total da cobrança é ajustado
 * pela diferença para manter os totais/progresso corretos.
 */
export async function editarValorParcela(
  parcelaId: string,
  novoValor: number,
  editadoPor: string,
  motivo?: string,
): Promise<CobrancaResponse> {
  try {
    await assertAuthorized()
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  try {
    if (!parcelaId) return { error: 'Parcela inválida.' }
    if (typeof novoValor !== 'number' || isNaN(novoValor) || novoValor <= 0) {
      return { error: 'Informe um valor válido.' }
    }
    const nome = (editadoPor || '').trim()
    if (!nome) return { error: 'Informe o nome de quem está editando o valor.' }

    const parcelaRef = adminDb.collection('cobranca_parcelas').doc(parcelaId)
    const parcelaDoc = await parcelaRef.get()
    if (!parcelaDoc.exists) return { error: 'Parcela não encontrada.' }
    const parcelaData = parcelaDoc.data()!

    const pagamentosSnap = await adminDb
      .collection('cobranca_pagamentos')
      .where('parcelaId', '==', parcelaId)
      .get()
    const totalPago = round2(
      pagamentosSnap.docs.reduce((s, doc) => s + (doc.data().valor || 0), 0),
    )

    const valorArredondado = round2(novoValor)
    if (valorArredondado < totalPago - EPSILON) {
      return {
        error: `O novo valor não pode ser menor que o já pago (R$ ${totalPago.toFixed(2).replace('.', ',')}).`,
      }
    }

    const valorAntigo = parcelaData.valorParcela as number
    const motivoTrim = (motivo || '').trim()

    await parcelaRef.update({
      valorParcela: valorArredondado,
      // Preserva o valor original da 1ª edição — reedições não sobrescrevem.
      valorOriginal: parcelaData.valorOriginal ?? valorAntigo,
      valorEditadoPor: nome,
      valorEditadoMotivo: motivoTrim || null,
      valorEditadoEm: new Date().toISOString(),
    })

    // Ajusta o valorTotal da cobrança pela diferença, para manter o
    // progresso/totais exibidos consistentes com a soma das parcelas.
    const diferenca = round2(valorArredondado - valorAntigo)
    if (Math.abs(diferenca) > EPSILON) {
      const cobrancaRef = adminDb.collection('cobrancas').doc(parcelaData.cobrancaId)
      const cobrancaDoc = await cobrancaRef.get()
      if (cobrancaDoc.exists) {
        const valorTotalAtual = (cobrancaDoc.data()?.valorTotal as number) || 0
        await cobrancaRef.update({ valorTotal: round2(valorTotalAtual + diferenca) })
      }
    }

    revalidatePath('/dashboard/cobrancas')
    return { success: 'Valor da parcela atualizado.' }
  } catch (err: any) {
    console.error('[editarValorParcela]', err)
    return { error: 'Erro ao editar o valor da parcela.' }
  }
}

/**
 * Remove um pagamento específico (estorno/correção de lançamento).
 * @param removerTransacaoVinculada Se `true` e o pagamento tiver gerado uma
 * receita automática no financeiro, remove ela também. Se `false`, o
 * lançamento no financeiro é mantido, mas desvinculado (deixa de "achar" que
 * tem um pagamento de origem).
 */
export async function removerPagamento(
  pagamentoId: string,
  removerTransacaoVinculada: boolean = false,
): Promise<CobrancaResponse> {
  try {
    await assertAuthorized()
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  try {
    const pagamentoRef = adminDb.collection('cobranca_pagamentos').doc(pagamentoId)
    const pagamentoDoc = await pagamentoRef.get()
    const transacaoId = pagamentoDoc.data()?.transacaoId as string | null | undefined

    const batch = adminDb.batch()
    batch.delete(pagamentoRef)
    if (transacaoId) {
      if (removerTransacaoVinculada) {
        // Estorna a receita lançada automaticamente no financeiro.
        batch.delete(adminDb.collection('transacoes').doc(transacaoId))
      } else {
        // Mantém o lançamento no financeiro, mas desvincula (o pagamento de
        // origem deixará de existir).
        batch.update(adminDb.collection('transacoes').doc(transacaoId), {
          origemPagamentoId: null,
          origemCobrancaId: null,
          origemParcelaId: null,
        })
      }
    }
    await batch.commit()

    revalidatePath('/dashboard/cobrancas')
    revalidatePath('/dashboard/financeiro')
    return {
      success:
        transacaoId && removerTransacaoVinculada
          ? 'Pagamento removido e receita correspondente removida do financeiro.'
          : 'Pagamento removido.',
    }
  } catch (err: any) {
    console.error('[removerPagamento]', err)
    return { error: 'Erro ao remover pagamento.' }
  }
}

/**
 * Desfaz todos os pagamentos de uma parcela, voltando ela para "pendente".
 * @param removerTransacoesVinculadas Se `true`, remove também as receitas
 * automáticas geradas no financeiro por esses pagamentos. Se `false`, os
 * lançamentos são mantidos (só desvinculados).
 */
export async function resetParcela(
  parcelaId: string,
  removerTransacoesVinculadas: boolean = false,
): Promise<CobrancaResponse> {
  try {
    await assertAuthorized()
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  try {
    const snap = await adminDb
      .collection('cobranca_pagamentos')
      .where('parcelaId', '==', parcelaId)
      .get()

    const batch = adminDb.batch()
    let vinculosRemovidos = 0
    for (const doc of snap.docs) {
      batch.delete(doc.ref)
      const transacaoId = doc.data()?.transacaoId as string | null | undefined
      if (transacaoId) {
        if (removerTransacoesVinculadas) {
          batch.delete(adminDb.collection('transacoes').doc(transacaoId))
          vinculosRemovidos++
        } else {
          batch.update(adminDb.collection('transacoes').doc(transacaoId), {
            origemPagamentoId: null,
            origemCobrancaId: null,
            origemParcelaId: null,
          })
        }
      }
    }
    await batch.commit()

    revalidatePath('/dashboard/cobrancas')
    revalidatePath('/dashboard/financeiro')
    return {
      success:
        vinculosRemovidos > 0
          ? `Pagamentos da parcela removidos e ${vinculosRemovidos} receita${vinculosRemovidos === 1 ? '' : 's'} removida${vinculosRemovidos === 1 ? '' : 's'} do financeiro.`
          : 'Pagamentos da parcela removidos.',
    }
  } catch (err: any) {
    console.error('[resetParcela]', err)
    return { error: 'Erro ao desfazer pagamentos.' }
  }
}

export async function deletarCobranca(cobrancaId: string): Promise<CobrancaResponse> {
  try {
    await assertAuthorized()
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  try {
    // Excluir todas as parcelas e os pagamentos vinculados
    const [parcelasSnap, pagamentosSnap] = await Promise.all([
      adminDb.collection('cobranca_parcelas').where('cobrancaId', '==', cobrancaId).get(),
      adminDb.collection('cobranca_pagamentos').where('cobrancaId', '==', cobrancaId).get(),
    ])

    const batch = adminDb.batch()
    for (const doc of pagamentosSnap.docs) {
      batch.delete(doc.ref)
      // Estorna as receitas lançadas automaticamente no financeiro.
      const transacaoId = doc.data()?.transacaoId as string | null | undefined
      if (transacaoId) batch.delete(adminDb.collection('transacoes').doc(transacaoId))
    }
    for (const doc of parcelasSnap.docs) {
      batch.delete(doc.ref)
    }
    batch.delete(adminDb.collection('cobrancas').doc(cobrancaId))
    await batch.commit()

    revalidatePath('/dashboard/cobrancas')
    revalidatePath('/dashboard/financeiro')
    return { success: 'Cobrança removida.' }
  } catch (err: any) {
    console.error('[deletarCobranca]', err)
    return { error: 'Erro ao remover cobrança.' }
  }
}

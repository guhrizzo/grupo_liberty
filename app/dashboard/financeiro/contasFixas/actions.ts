'use server'

import { revalidatePath } from 'next/cache'
import type { DocumentData } from 'firebase-admin/firestore'
import { adminDb } from '@/utils/firebase/admin'
import { assertPageAccess } from '@/utils/permissions'
import { ehMesValido, hojeNoFuso, mesAtual, rotuloMesCurto } from '../periodo'
import { competenciasVencidas, idLancamentoContaFixa, ordenarPendencias, vencimentoNoMes } from './regras'
import type {
  ContaFixa,
  ContaFixaFieldErrors,
  ContaFixaPendente,
  ContaFixaPeriodicidade,
  ContaFixaResponse,
  PagamentoContaFixa,
} from './types'

const COLECAO = 'contas_fixas'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Quem tem acesso à aba `financeiro` pode fazer o CRUD dela. */
function assertAcesso() {
  return assertPageAccess('financeiro')
}

// Parser robusto pt-BR → número (aceita "1.234,56", "1234.56" ou "1234,56")
function parseValor(raw: unknown): number {
  if (typeof raw !== 'string') return NaN
  let s = raw.trim()
  if (!s) return NaN
  s = s.replace(/[^\d.,-]/g, '')
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }
  return parseFloat(s)
}

function mensagemDeErro(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function texto(formData: FormData, campo: string): string {
  return ((formData.get(campo) as string) || '').trim()
}

/** Campos editáveis de uma conta, validados. */
function validarConta(formData: FormData) {
  const nome = texto(formData, 'nome')
  const categoria = texto(formData, 'categoria') || 'Outros'
  const valor = parseValor(formData.get('valor'))
  const periodicidade: ContaFixaPeriodicidade =
    texto(formData, 'periodicidade') === 'anual' ? 'anual' : 'mensal'
  const diaVencimento = Number(texto(formData, 'diaVencimento'))
  const mesVencimentoRaw = Number(texto(formData, 'mesVencimento'))
  const observacao = texto(formData, 'observacao') || null

  const fieldErrors: ContaFixaFieldErrors = {}
  if (!nome) fieldErrors.nome = 'Informe o nome da conta.'
  if (!Number.isFinite(valor) || valor <= 0) {
    fieldErrors.valor = 'Valor inválido. Informe um número positivo.'
  }
  if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
    fieldErrors.diaVencimento = 'Informe um dia entre 1 e 31.'
  }
  const mesVencimento = periodicidade === 'anual' ? mesVencimentoRaw : null
  if (
    periodicidade === 'anual' &&
    (!Number.isInteger(mesVencimentoRaw) || mesVencimentoRaw < 1 || mesVencimentoRaw > 12)
  ) {
    fieldErrors.mesVencimento = 'Escolha o mês do vencimento.'
  }

  return {
    dados: { nome, categoria, valor, periodicidade, diaVencimento, mesVencimento, observacao },
    fieldErrors,
  }
}

function paraContaFixa(id: string, data: DocumentData | undefined = {}): ContaFixa {
  return {
    id,
    nome: data.nome || '',
    categoria: data.categoria || 'Outros',
    valor: data.valor ?? 0,
    periodicidade: data.periodicidade === 'anual' ? 'anual' : 'mensal',
    diaVencimento: data.diaVencimento ?? 1,
    mesVencimento: data.mesVencimento ?? null,
    ativa: data.ativa !== false,
    observacao: data.observacao ?? null,
    mesInicio: data.mesInicio || '0000-00',
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.created_by ?? null,
  }
}

// ─── Leituras ────────────────────────────────────────────────────────────────

/** Todas as contas fixas cadastradas (ativas e inativas), por nome. */
export async function getContasFixas(): Promise<ContaFixa[]> {
  try {
    await assertAcesso()
    const snapshot = await adminDb.collection(COLECAO).orderBy('nome').get()
    return snapshot.docs.map((doc) => paraContaFixa(doc.id, doc.data()))
  } catch (error) {
    console.error('Erro ao buscar contas fixas:', error)
    return []
  }
}

/**
 * Pagamentos de `mes` para as contas informadas. Cada pagamento é o lançamento
 * de ID determinístico `contafixa_<conta>_<mes>` — lidos direto por ID (uma
 * leitura por conta), sem consulta nem índice.
 */
export async function getPagamentosContasFixas(
  mes: string,
  contaIds: string[],
): Promise<PagamentoContaFixa[]> {
  if (!ehMesValido(mes) || contaIds.length === 0) return []
  try {
    await assertAcesso()
    const refs = contaIds.map((id) =>
      adminDb.collection('transacoes').doc(idLancamentoContaFixa(id, mes)),
    )
    const docs = await adminDb.getAll(...refs)
    const pagamentos: PagamentoContaFixa[] = []
    docs.forEach((doc, i) => {
      if (!doc.exists) return
      const data = doc.data() ?? {}
      pagamentos.push({
        contaId: contaIds[i],
        transacaoId: doc.id,
        valor: data.valor ?? 0,
        data: data.data || '',
      })
    })
    return pagamentos
  } catch (error) {
    console.error('Erro ao buscar pagamentos de contas fixas:', error)
    return []
  }
}

/**
 * Contas vencidas e não pagas em qualquer mês (até `MESES_PENDENCIA` para
 * trás). Relê as contas no servidor em vez de confiar em dados do cliente; o
 * pagamento de cada competência é o lançamento de ID determinístico.
 */
export async function getContasFixasPendentes(): Promise<ContaFixaPendente[]> {
  try {
    await assertAcesso()
    const hoje = hojeNoFuso()
    const snapshot = await adminDb.collection(COLECAO).get()
    const candidatas = snapshot.docs.flatMap((doc) => {
      const conta = paraContaFixa(doc.id, doc.data())
      return competenciasVencidas(conta, hoje).map((mes) => ({
        conta,
        mes,
        vencimento: vencimentoNoMes(conta, mes),
      }))
    })
    if (candidatas.length === 0) return []

    const docs = await adminDb.getAll(
      ...candidatas.map((c) =>
        adminDb.collection('transacoes').doc(idLancamentoContaFixa(c.conta.id, c.mes)),
      ),
    )
    return ordenarPendencias(candidatas.filter((_, i) => !docs[i].exists))
  } catch (error) {
    console.error('Erro ao buscar contas fixas pendentes:', error)
    return []
  }
}

// ─── Cadastro ────────────────────────────────────────────────────────────────

export async function createContaFixa(formData: FormData): Promise<ContaFixaResponse> {
  let user: Awaited<ReturnType<typeof assertAcesso>>
  try {
    user = await assertAcesso()
  } catch (err) {
    return { error: mensagemDeErro(err) }
  }

  const { dados, fieldErrors } = validarConta(formData)
  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  try {
    const now = new Date().toISOString()
    await adminDb.collection(COLECAO).add({
      ...dados,
      ativa: true,
      mesInicio: mesAtual(),
      created_by: user.uid,
      created_at: now,
      updated_at: now,
    })
    revalidatePath('/dashboard/financeiro')
    return { success: 'Conta fixa cadastrada!' }
  } catch (error) {
    return { error: `Erro ao cadastrar conta fixa: ${mensagemDeErro(error)}` }
  }
}

export async function updateContaFixa(id: string, formData: FormData): Promise<ContaFixaResponse> {
  try {
    await assertAcesso()
  } catch (err) {
    return { error: mensagemDeErro(err) }
  }
  if (!id) return { error: 'ID inválido.' }

  const { dados, fieldErrors } = validarConta(formData)
  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  try {
    const ref = adminDb.collection(COLECAO).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Conta fixa não encontrada.' }
    await ref.update({ ...dados, updated_at: new Date().toISOString() })
    revalidatePath('/dashboard/financeiro')
    return { success: 'Conta fixa atualizada!' }
  } catch (error) {
    return { error: `Erro ao atualizar conta fixa: ${mensagemDeErro(error)}` }
  }
}

export async function setContaFixaAtiva(id: string, ativa: boolean): Promise<ContaFixaResponse> {
  try {
    await assertAcesso()
  } catch (err) {
    return { error: mensagemDeErro(err) }
  }
  if (!id) return { error: 'ID inválido.' }

  try {
    const ref = adminDb.collection(COLECAO).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Conta fixa não encontrada.' }
    await ref.update({ ativa, updated_at: new Date().toISOString() })
    revalidatePath('/dashboard/financeiro')
    return { success: ativa ? 'Conta fixa reativada!' : 'Conta fixa desativada!' }
  } catch (error) {
    return { error: `Erro ao atualizar conta fixa: ${mensagemDeErro(error)}` }
  }
}

/** Remove só o cadastro — os lançamentos já gerados continuam no Financeiro. */
export async function deleteContaFixa(id: string): Promise<ContaFixaResponse> {
  try {
    await assertAcesso()
  } catch (err) {
    return { error: mensagemDeErro(err) }
  }
  if (!id) return { error: 'ID inválido.' }

  try {
    await adminDb.collection(COLECAO).doc(id).delete()
    revalidatePath('/dashboard/financeiro')
    return { success: 'Conta fixa removida!' }
  } catch (error) {
    return { error: `Erro ao remover conta fixa: ${mensagemDeErro(error)}` }
  }
}

// ─── Pagamento ───────────────────────────────────────────────────────────────

/**
 * Marca a conta como paga em `mes` (competência): cria a despesa no Financeiro
 * com ID determinístico. `create()` falha se o lançamento já existir, então um
 * segundo clique não duplica a despesa. Desfazer = `deleteTransacao` desse ID.
 */
export async function marcarContaFixaPaga(
  contaId: string,
  mes: string,
  formData: FormData,
): Promise<ContaFixaResponse> {
  let user: Awaited<ReturnType<typeof assertAcesso>>
  try {
    user = await assertAcesso()
  } catch (err) {
    return { error: mensagemDeErro(err) }
  }
  if (!contaId || !ehMesValido(mes)) return { error: 'Conta ou mês inválido.' }

  const valor = parseValor(formData.get('valor'))
  const data = texto(formData, 'data')
  const fieldErrors: ContaFixaFieldErrors = {}
  if (!Number.isFinite(valor) || valor <= 0) {
    fieldErrors.valor = 'Valor inválido. Informe um número positivo.'
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) fieldErrors.data = 'Informe a data do pagamento.'
  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  try {
    const contaDoc = await adminDb.collection(COLECAO).doc(contaId).get()
    if (!contaDoc.exists) return { error: 'Conta fixa não encontrada.' }
    const conta = paraContaFixa(contaDoc.id, contaDoc.data())

    const now = new Date().toISOString()
    await adminDb
      .collection('transacoes')
      .doc(idLancamentoContaFixa(contaId, mes))
      .create({
        descricao: `${conta.nome} (${rotuloMesCurto(mes)})`,
        categoria: 'Conta Fixa',
        tipo: 'despesa',
        valor,
        data,
        status: 'concluido',
        origemContaFixaId: contaId,
        competencia: mes,
        created_by: user.uid,
        created_at: now,
        updated_at: now,
      })

    revalidatePath('/dashboard/financeiro')
    return { success: 'Conta marcada como paga e lançada no Financeiro!' }
  } catch (error) {
    // 6 = ALREADY_EXISTS (gRPC) — o lançamento deste mês já existe.
    const code = (error as { code?: unknown } | null)?.code
    if (code === 6 || code === 'already-exists') {
      revalidatePath('/dashboard/financeiro')
      return { error: 'Esta conta já foi marcada como paga neste mês.' }
    }
    return { error: `Erro ao marcar conta como paga: ${mensagemDeErro(error)}` }
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import {
  type Transacao,
  type TransacaoCategoria,
  type TransacaoFieldErrors,
  type TransacaoResponse,
  type TransacaoStatus,
  type TransacaoTipo,
} from './types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getSessionUser() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) return null

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(session, true)
    return decodedClaims
  } catch {
    return null
  }
}

async function assertAdmin() {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')

  const claims: any = user
  const isAdminByClaim = claims.admin === true || claims.role === 'admin'
  if (isAdminByClaim) return { user }

  const profileDoc = await adminDb.collection('profiles').doc(user.uid).get()
  const profile = profileDoc.data()

  if (!profileDoc.exists || profile?.role !== 'admin') {
    throw new Error('Acesso negado. Você precisa ser administrador para realizar esta ação.')
  }

  return { user }
}

// Parser robusto pt-BR → número (aceita "1.234,56", "1234.56" ou "1234,56")
function parseValor(raw: unknown): number {
  if (typeof raw !== 'string') return NaN
  let s = raw.trim()
  if (!s) return NaN
  // remove caracteres não numéricos exceto . , -
  s = s.replace(/[^\d.,-]/g, '')
  // se tem ambos . e , assume pt-BR: . = milhar, , = decimal
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    // só vírgula: trata como decimal
    s = s.replace(',', '.')
  }
  return parseFloat(s)
}

// ─── Server Actions ──────────────────────────────────────────────────────────

/**
 * Lista todas as transações, mais recentes primeiro.
 */
export async function getTransacoes(): Promise<Transacao[]> {
  try {
    const snapshot = await adminDb
      .collection('transacoes')
      .orderBy('data', 'desc')
      .get()

    const items: Transacao[] = []
    snapshot.forEach((doc: any) => {
      const data = doc.data()
      items.push({
        id: doc.id,
        descricao: data.descricao || '',
        categoria: (data.categoria as TransacaoCategoria) || 'Outros',
        tipo: data.tipo === 'despesa' ? 'despesa' : 'receita',
        valor: data.valor ?? 0,
        data: data.data || '',
        status: data.status === 'pendente' ? 'pendente' : 'concluido',
        created_at: data.created_at,
        updated_at: data.updated_at,
        created_by: data.created_by || null,
        origemPagamentoId: data.origemPagamentoId ?? null,
        origemCobrancaId: data.origemCobrancaId ?? null,
        origemParcelaId: data.origemParcelaId ?? null,
      })
    })

    return items
  } catch (error) {
    console.error('Erro ao buscar transações:', error)
    return []
  }
}

/**
 * Cadastra uma nova transação financeira.
 */
export async function createTransacao(formData: FormData): Promise<TransacaoResponse> {
  let user: any
  try {
    const res = await assertAdmin()
    user = res.user
  } catch (err: any) {
    return { error: err.message }
  }

  const descricao = ((formData.get('descricao') as string) || '').trim()
  const categoriaRaw = ((formData.get('categoria') as string) || '').trim()
  // Aceita as categorias predefinidas ou um nome customizado (quando o
  // usuário escolhe "Outros" e informa um nome específico no formulário).
  const categoria: TransacaoCategoria = (categoriaRaw || 'Outros') as TransacaoCategoria
  const tipo: TransacaoTipo = (formData.get('tipo') as string) === 'despesa' ? 'despesa' : 'receita'
  const valorRaw = (formData.get('valor') as string) || ''
  const valor = parseValor(valorRaw)
  const data = ((formData.get('data') as string) || '').trim() || new Date().toISOString().split('T')[0]
  const status: TransacaoStatus =
    (formData.get('status') as string) === 'pendente' ? 'pendente' : 'concluido'

  const fieldErrors: TransacaoFieldErrors = {}
  if (!descricao) fieldErrors.descricao = 'Informe uma descrição para o lançamento.'
  if (!Number.isFinite(valor) || valor <= 0) {
    fieldErrors.valor = 'Valor inválido. Informe um número positivo.'
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  try {
    const docRef = adminDb.collection('transacoes').doc()
    const now = new Date().toISOString()

    const nova = {
      descricao,
      categoria,
      tipo,
      valor,
      data,
      status,
      created_by: user.uid,
      created_at: now,
      updated_at: now,
    }

    await docRef.set(nova)

    revalidatePath('/dashboard/financeiro')
    return {
      success: 'Lançamento registrado com sucesso!',
      transacao: { id: docRef.id, ...nova },
    }
  } catch (error: any) {
    return { error: `Erro ao registrar lançamento: ${error.message}` }
  }
}

/**
 * Atualiza uma transação financeira existente.
 */
export async function updateTransacao(
  id: string,
  formData: FormData,
): Promise<TransacaoResponse> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  if (!id) return { error: 'ID inválido.' }

  const descricao = ((formData.get('descricao') as string) || '').trim()
  const categoriaRaw = ((formData.get('categoria') as string) || '').trim()
  // Aceita as categorias predefinidas ou um nome customizado (quando o
  // usuário escolhe "Outros" e informa um nome específico no formulário).
  const categoria: TransacaoCategoria = (categoriaRaw || 'Outros') as TransacaoCategoria
  const tipo: TransacaoTipo = (formData.get('tipo') as string) === 'despesa' ? 'despesa' : 'receita'
  const valorRaw = (formData.get('valor') as string) || ''
  const valor = parseValor(valorRaw)
  const data = ((formData.get('data') as string) || '').trim() || new Date().toISOString().split('T')[0]
  const status: TransacaoStatus =
    (formData.get('status') as string) === 'pendente' ? 'pendente' : 'concluido'

  const fieldErrors: TransacaoFieldErrors = {}
  if (!descricao) fieldErrors.descricao = 'Informe uma descrição para o lançamento.'
  if (!Number.isFinite(valor) || valor <= 0) {
    fieldErrors.valor = 'Valor inválido. Informe um número positivo.'
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  try {
    const docRef = adminDb.collection('transacoes').doc(id)
    const doc = await docRef.get()
    if (!doc.exists) return { error: 'Lançamento não encontrado.' }

    const now = new Date().toISOString()
    const atualizacao = {
      descricao,
      categoria,
      tipo,
      valor,
      data,
      status,
      updated_at: now,
    }

    await docRef.update(atualizacao)

    revalidatePath('/dashboard/financeiro')
    return {
      success: 'Lançamento atualizado com sucesso!',
      transacao: { id, ...(doc.data() as any), ...atualizacao } as Transacao,
    }
  } catch (error: any) {
    return { error: `Erro ao atualizar lançamento: ${error.message}` }
  }
}

/**
 * Remove uma transação financeira.
 * @param removerPagamentoVinculado Se o lançamento veio de um pagamento de
 * cobrança (`origemPagamentoId`), controla o que fazer com esse pagamento:
 * `true` remove ele também (em /dashboard/cobrancas); `false` (padrão) mantém
 * o pagamento intacto, só removendo o lançamento do financeiro.
 */
export async function deleteTransacao(
  id: string,
  removerPagamentoVinculado: boolean = false,
): Promise<{ success?: string; error?: string }> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  if (!id) return { error: 'ID inválido.' }

  try {
    const docRef = adminDb.collection('transacoes').doc(id)
    const doc = await docRef.get()
    if (!doc.exists) return { error: 'Lançamento não encontrado.' }

    const origemPagamentoId = doc.data()?.origemPagamentoId as string | null | undefined

    const batch = adminDb.batch()
    batch.delete(docRef)
    if (origemPagamentoId) {
      const pagamentoRef = adminDb.collection('cobranca_pagamentos').doc(origemPagamentoId)
      if (removerPagamentoVinculado) {
        batch.delete(pagamentoRef)
      } else {
        // Mantém o pagamento na cobrança, só desvincula (o lançamento de
        // origem deixará de existir).
        batch.update(pagamentoRef, { transacaoId: null })
      }
    }
    await batch.commit()

    revalidatePath('/dashboard/financeiro')
    if (origemPagamentoId) revalidatePath('/dashboard/cobrancas')

    return {
      success:
        origemPagamentoId && removerPagamentoVinculado
          ? 'Lançamento removido e pagamento correspondente removido da cobrança!'
          : 'Lançamento removido com sucesso!',
    }
  } catch (error: any) {
    return { error: `Erro ao remover lançamento: ${error.message}` }
  }
}

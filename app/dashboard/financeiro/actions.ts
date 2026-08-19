'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb, adminStorage } from '@/utils/firebase/admin'
import { ehMesValido, hojeNoFuso, intervaloDoMes } from './periodo'
import {
  type Transacao,
  type TransacaoCategoria,
  type TransacaoComprovante,
  type TransacaoComprovanteResponse,
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
 * Lista as transações de um mês (`YYYY-MM`), mais recentes primeiro.
 *
 * Sem `mes`, devolve a collection inteira — comportamento antigo, mantido para
 * chamadas que precisem do histórico completo.
 *
 * O filtro é um range no próprio campo `data`, que é gravado como string
 * `YYYY-MM-DD`; nesse formato a ordem lexicográfica é igual à cronológica, então
 * o range é exato. Como o range e o `orderBy` são no mesmo campo, o índice
 * automático de campo único do Firestore já atende — não precisa de índice
 * composto. Auditei a collection antes de trocar a consulta: os 64 documentos
 * existentes têm `data` string no formato certo, então nenhum lançamento fica
 * fora do filtro.
 */
export async function getTransacoes(mes?: string): Promise<Transacao[]> {
  try {
    const colecao = adminDb.collection('transacoes')

    const consulta = ehMesValido(mes)
      ? (() => {
          const { inicio, fim } = intervaloDoMes(mes)
          return colecao.where('data', '>=', inicio).where('data', '<=', fim)
        })()
      : colecao

    const snapshot = await consulta.orderBy('data', 'desc').get()

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
        comprovante: data.comprovante ?? null,
      })
    })

    return items
  } catch (error) {
    console.error('Erro ao buscar transações:', error)
    return []
  }
}

/**
 * Mês do lançamento mais antigo e do mais recente (`YYYY-MM`), para delimitar o
 * seletor de período.
 *
 * Custa 2 leituras de documento (uma ponta cada) — a lista de meses é derivada
 * daí no cliente, sem varrer a collection. O limite superior existe porque um
 * lançamento pendente pode ter data futura; sem ele, esses meses ficariam
 * inalcançáveis pelo seletor.
 */
export async function getIntervaloDeMeses(): Promise<{
  primeiro: string | null
  ultimo: string | null
}> {
  const mesDaPonta = async (direcao: 'asc' | 'desc') => {
    const snapshot = await adminDb
      .collection('transacoes')
      .orderBy('data', direcao)
      .limit(1)
      .get()

    if (snapshot.empty) return null
    const data = snapshot.docs[0].data()?.data
    return typeof data === 'string' && data.length >= 7 ? data.slice(0, 7) : null
  }

  try {
    const [primeiro, ultimo] = await Promise.all([mesDaPonta('asc'), mesDaPonta('desc')])
    return { primeiro, ultimo }
  } catch (error) {
    console.error('Erro ao buscar o intervalo de meses:', error)
    return { primeiro: null, ultimo: null }
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
  // `hojeNoFuso()` e não `toISOString()`: em UTC, um lançamento salvo entre
  // 21:00 e 23:59 do último dia do mês cairia no dia 1 do mês seguinte e
  // sumiria da tela onde acabou de ser criado.
  const data = ((formData.get('data') as string) || '').trim() || hojeNoFuso()
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
  // `hojeNoFuso()` e não `toISOString()`: em UTC, um lançamento salvo entre
  // 21:00 e 23:59 do último dia do mês cairia no dia 1 do mês seguinte e
  // sumiria da tela onde acabou de ser criado.
  const data = ((formData.get('data') as string) || '').trim() || hojeNoFuso()
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
    const comprovante = doc.data()?.comprovante as { storagePath?: string } | null | undefined

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

    // Best-effort: remove também o comprovante anexado a este lançamento
    // (Storage). Não bloqueia a exclusão principal se falhar.
    if (comprovante?.storagePath) {
      try {
        const bucket = adminStorage.bucket()
        const fileRef = bucket.file(comprovante.storagePath)
        const [exists] = await fileRef.exists()
        if (exists) await fileRef.delete()
      } catch (storageErr) {
        console.error('Erro ao remover comprovante do Storage:', storageErr)
      }
    }

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

// ─── Comprovante (nota fiscal ou recibo em PDF/imagem) ──────────────────────
// Um único arquivo por lançamento: anexar um novo substitui o anterior
// (remove o antigo do Storage antes de gravar o novo).

const MAX_COMPROVANTE_SIZE = 10 * 1024 * 1024 // 10MB
const COMPROVANTE_TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function sanitizeFileName(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-_ .]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 120) || 'comprovante'
  )
}

function extensaoPorTipo(contentType: string, fileName: string): string {
  switch (contentType) {
    case 'application/pdf':
      return 'pdf'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/jpeg':
      return 'jpg'
    default: {
      const match = fileName.match(/\.([a-zA-Z0-9]+)$/)
      return match ? match[1].toLowerCase() : 'bin'
    }
  }
}

/**
 * Anexa (ou substitui) o comprovante de um lançamento. Recebe FormData com:
 * - transacaoId: string
 * - arquivo: File (application/pdf, image/jpeg, image/png ou image/webp — máx. 10MB)
 *
 * Só um comprovante por lançamento: se já existir um, o arquivo antigo é
 * removido do Storage antes de gravar o novo.
 */
export async function anexarComprovanteTransacao(
  formData: FormData,
): Promise<TransacaoComprovanteResponse> {
  let user: any
  try {
    const res = await assertAdmin()
    user = res.user
  } catch (err: any) {
    return { error: err.message }
  }

  const transacaoId = ((formData.get('transacaoId') as string) || '').trim()
  const file = formData.get('arquivo')

  if (!transacaoId) return { error: 'Lançamento não especificado.' }
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Selecione um arquivo (PDF, JPG, PNG ou WEBP).' }
  }
  if (file.size > MAX_COMPROVANTE_SIZE) {
    return { error: 'Arquivo excede o limite de 10MB.' }
  }
  if (!COMPROVANTE_TIPOS_PERMITIDOS.includes(file.type)) {
    return { error: 'Formato não suportado. Envie um PDF, JPG, PNG ou WEBP.' }
  }

  try {
    const transacaoRef = adminDb.collection('transacoes').doc(transacaoId)
    const transacaoDoc = await transacaoRef.get()
    if (!transacaoDoc.exists) return { error: 'Lançamento não encontrado.' }

    const bucket = adminStorage.bucket()

    // Remove o comprovante anterior, se houver — só um por lançamento.
    const comprovanteAnterior = transacaoDoc.data()?.comprovante as
      | { storagePath?: string }
      | null
      | undefined
    if (comprovanteAnterior?.storagePath) {
      try {
        const fileRefAnterior = bucket.file(comprovanteAnterior.storagePath)
        const [exists] = await fileRefAnterior.exists()
        if (exists) await fileRefAnterior.delete()
      } catch (storageErr) {
        console.error('Erro ao remover comprovante anterior do Storage:', storageErr)
      }
    }

    const contentType = file.type
    const ext = extensaoPorTipo(contentType, file.name)
    // Nome com timestamp: evita colisão com o cache do arquivo antigo (mesmo
    // storagePath reaproveitado logo após a exclusão acima).
    const storagePath = `transacoes/${transacaoId}/comprovante_${Date.now()}.${ext}`
    const fileName = sanitizeFileName(file.name)
    const now = new Date().toISOString()

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileRef = bucket.file(storagePath)

    await fileRef.save(buffer, {
      metadata: {
        contentType,
        metadata: {
          transacaoId,
          uploadedBy: user.uid,
        },
      },
    })

    const comprovante: TransacaoComprovante = {
      fileName,
      contentType,
      size: file.size,
      storagePath,
      uploadedByUid: user.uid,
      uploadedByEmail: user.email ?? null,
      uploadedAt: now,
    }

    await transacaoRef.update({ comprovante })

    revalidatePath('/dashboard/financeiro')
    return { success: 'Comprovante anexado com sucesso.', comprovante }
  } catch (error: any) {
    return { error: `Erro ao anexar comprovante: ${error.message}` }
  }
}

/**
 * Remove o comprovante anexado a um lançamento.
 */
export async function removerComprovanteTransacao(
  transacaoId: string,
): Promise<{ success?: string; error?: string }> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  if (!transacaoId) return { error: 'ID inválido.' }

  try {
    const transacaoRef = adminDb.collection('transacoes').doc(transacaoId)
    const doc = await transacaoRef.get()
    if (!doc.exists) return { error: 'Lançamento não encontrado.' }

    const comprovante = doc.data()?.comprovante as { storagePath?: string } | null | undefined
    if (!comprovante) return { error: 'Este lançamento não tem comprovante anexado.' }

    if (comprovante.storagePath) {
      try {
        const bucket = adminStorage.bucket()
        const fileRef = bucket.file(comprovante.storagePath)
        const [exists] = await fileRef.exists()
        if (exists) await fileRef.delete()
      } catch (storageErr) {
        console.error('Erro ao remover comprovante do Storage:', storageErr)
      }
    }

    await transacaoRef.update({ comprovante: null })
    revalidatePath('/dashboard/financeiro')

    return { success: 'Comprovante removido com sucesso.' }
  } catch (error: any) {
    return { error: `Erro ao remover comprovante: ${error.message}` }
  }
}

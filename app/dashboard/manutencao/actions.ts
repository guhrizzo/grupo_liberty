'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb, adminStorage } from '@/utils/firebase/admin'
import { recalcularCustoEfetivoTotal } from '@/app/dashboard/veiculos/actions'
import {
  MANUTENCAO_STATUS,
  isManutencaoBaixada,
  valorManutencao,
  type BaixaManutencao,
  type BaixaManutencaoResponse,
  type Manutencao,
  type ManutencaoComprovante,
  type ManutencaoFieldErrors,
  type ManutencaoResponse,
  type ManutencaoStatus,
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

function parseCusto(value: unknown): number {
  if (typeof value !== 'string' || !value) return 0
  const digits = value.replace(/\D/g, '')
  if (!digits) return 0
  // pt-BR mask: trata os últimos 2 dígitos como centavos.
  const cents = parseInt(digits.slice(-2), 10) || 0
  const reais = parseInt(digits.slice(0, -2) || '0', 10) || 0
  return reais + cents / 100
}

function parsePecasConserto(value: unknown): Manutencao['pecasConserto'] {
  if (!value) return null
  let raw: unknown = value
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!Array.isArray(raw)) return null
  const items: { nome: string; valor: number }[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const nome = String(obj.nome ?? '').trim()
    const valorNum =
      typeof obj.valor === 'number'
        ? obj.valor
        : obj.valor != null
          ? Number(obj.valor)
          : 0
    if (!nome) continue
    items.push({ nome, valor: Number.isFinite(valorNum) ? valorNum : 0 })
  }
  return items.length > 0 ? items : null
}

// ─── Server Actions ──────────────────────────────────────────────────────────

/**
 * Lista todas as manutenções cadastradas, mais recentes primeiro.
 */
export async function getManutencoes(): Promise<Manutencao[]> {
  try {
    const snapshot = await adminDb
      .collection('manutencoes')
      .orderBy('dataAgendada', 'desc')
      .get()

    const items: Manutencao[] = []
    snapshot.forEach((doc: any) => {
      const data = doc.data()
      items.push({
        id: doc.id,
        veiculoId: data.veiculoId || '',
        veiculoLabel: data.veiculoLabel || '',
        tipo: data.tipo || '',
        descricao: data.descricao || null,
        oficina: data.oficina || '',
        responsavel: data.responsavel || '',
        custo: data.custo ?? 0,
        dataAgendada: data.dataAgendada || '',
        dataConclusao: data.dataConclusao || null,
        status: (data.status as ManutencaoStatus) || 'agendada',
        pecasConserto: parsePecasConserto(data.pecasConserto),
        baixa: (data.baixa as BaixaManutencao) ?? null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        created_by: data.created_by || null,
      })
    })

    return items
  } catch (error) {
    console.error('Erro ao buscar manutenções:', error)
    return []
  }
}

/**
 * Cadastra uma nova manutenção.
 */
export async function createManutencao(formData: FormData): Promise<ManutencaoResponse> {
  let user: any
  try {
    const res = await assertAdmin()
    user = res.user
  } catch (err: any) {
    return { error: err.message }
  }

  const veiculoId = ((formData.get('veiculoId') as string) || '').trim()
  const veiculoLabel = ((formData.get('veiculoLabel') as string) || '').trim()
  const tipo = ((formData.get('tipo') as string) || '').trim()
  const descricao = ((formData.get('descricao') as string) || '').trim() || null
  const oficina = ((formData.get('oficina') as string) || '').trim()
  const responsavel = ((formData.get('responsavel') as string) || '').trim()
  // O valor da manutenção não é informado no cadastro — só na baixa
  // (`darBaixaManutencao`). Nasce zerada e sem baixa.
  const dataAgendada = ((formData.get('dataAgendada') as string) || '').trim()
  const dataConclusao = ((formData.get('dataConclusao') as string) || '').trim() || null
  const statusRaw = ((formData.get('status') as string) || '').trim()
  const status: ManutencaoStatus = (
    MANUTENCAO_STATUS.includes(statusRaw as ManutencaoStatus)
      ? statusRaw
      : 'agendada'
  ) as ManutencaoStatus
  const pecasConserto = parsePecasConserto(formData.get('pecasConserto'))

  const fieldErrors: ManutencaoFieldErrors = {}
  if (!veiculoLabel && !veiculoId) {
    fieldErrors.veiculoLabel = 'Selecione ou informe o veículo.'
  }
  if (!tipo) fieldErrors.tipo = 'Informe o tipo de manutenção.'
  if (!oficina) fieldErrors.oficina = 'Informe a oficina.'
  if (!responsavel) fieldErrors.responsavel = 'Informe o responsável.'
  if (!dataAgendada) fieldErrors.dataAgendada = 'Informe a data agendada.'

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  try {
    const docRef = adminDb.collection('manutencoes').doc()
    const now = new Date().toISOString()

    const nova = {
      veiculoId,
      veiculoLabel,
      tipo,
      descricao,
      oficina,
      responsavel,
      custo: 0,
      baixa: null as BaixaManutencao | null,
      dataAgendada,
      dataConclusao,
      status,
      pecasConserto,
      created_by: user.uid,
      created_at: now,
      updated_at: now,
    }

    await docRef.set(nova)

    if (veiculoId) await recalcularCustoEfetivoTotal(veiculoId)

    revalidatePath('/dashboard/manutencao')
    revalidatePath('/dashboard/veiculos')
    return {
      success: 'Manutenção cadastrada com sucesso!',
      manutencao: { id: docRef.id, ...nova },
    }
  } catch (error: any) {
    return { error: `Erro ao cadastrar manutenção: ${error.message}` }
  }
}

/**
 * Atualiza uma manutenção existente.
 */
export async function updateManutencao(
  id: string,
  formData: FormData,
): Promise<ManutencaoResponse> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  if (!id) return { error: 'ID inválido.' }

  const veiculoId = ((formData.get('veiculoId') as string) || '').trim()
  const veiculoLabel = ((formData.get('veiculoLabel') as string) || '').trim()
  const tipo = ((formData.get('tipo') as string) || '').trim()
  const descricao = ((formData.get('descricao') as string) || '').trim() || null
  const oficina = ((formData.get('oficina') as string) || '').trim()
  const responsavel = ((formData.get('responsavel') as string) || '').trim()
  // `custo` e `baixa` não são editados aqui — só pelo fluxo de baixa/estorno.
  const dataAgendada = ((formData.get('dataAgendada') as string) || '').trim()
  const dataConclusao = ((formData.get('dataConclusao') as string) || '').trim() || null
  const statusRaw = ((formData.get('status') as string) || '').trim()
  const status: ManutencaoStatus = (
    MANUTENCAO_STATUS.includes(statusRaw as ManutencaoStatus)
      ? statusRaw
      : 'agendada'
  ) as ManutencaoStatus
  const pecasConserto = parsePecasConserto(formData.get('pecasConserto'))

  const fieldErrors: ManutencaoFieldErrors = {}
  if (!veiculoLabel && !veiculoId) {
    fieldErrors.veiculoLabel = 'Selecione ou informe o veículo.'
  }
  if (!tipo) fieldErrors.tipo = 'Informe o tipo de manutenção.'
  if (!oficina) fieldErrors.oficina = 'Informe a oficina.'
  if (!responsavel) fieldErrors.responsavel = 'Informe o responsável.'
  if (!dataAgendada) fieldErrors.dataAgendada = 'Informe a data agendada.'

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  try {
    const docRef = adminDb.collection('manutencoes').doc(id)
    const doc = await docRef.get()
    if (!doc.exists) return { error: 'Manutenção não encontrada.' }
    const veiculoIdAnterior = (doc.data()?.veiculoId as string) || ''

    const now = new Date().toISOString()
    const atualizacao = {
      veiculoId,
      veiculoLabel,
      tipo,
      descricao,
      oficina,
      responsavel,
      dataAgendada,
      dataConclusao,
      status,
      pecasConserto,
      updated_at: now,
    }

    await docRef.update(atualizacao)

    if (veiculoId) await recalcularCustoEfetivoTotal(veiculoId)
    if (veiculoIdAnterior && veiculoIdAnterior !== veiculoId) {
      await recalcularCustoEfetivoTotal(veiculoIdAnterior)
    }

    revalidatePath('/dashboard/manutencao')
    revalidatePath('/dashboard/veiculos')
    return {
      success: 'Manutenção atualizada com sucesso!',
      manutencao: { id, ...doc.data(), ...atualizacao } as Manutencao,
    }
  } catch (error: any) {
    return { error: `Erro ao atualizar manutenção: ${error.message}` }
  }
}

/**
 * Remove uma manutenção.
 */
export async function deleteManutencao(
  id: string,
): Promise<{ success?: string; error?: string }> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  if (!id) return { error: 'ID inválido.' }

  try {
    const docRef = adminDb.collection('manutencoes').doc(id)
    const doc = await docRef.get()
    if (!doc.exists) return { error: 'Manutenção não encontrada.' }
    const dados = doc.data() || {}
    const veiculoIdDaManutencao = (dados.veiculoId as string) || ''

    // Best-effort: apaga o comprovante da baixa do Storage.
    const storagePathComprovante = (dados.baixa as BaixaManutencao | null)?.comprovante
      ?.storagePath
    if (storagePathComprovante) {
      try {
        const fileRef = adminStorage.bucket().file(storagePathComprovante)
        const [exists] = await fileRef.exists()
        if (exists) await fileRef.delete()
      } catch (storageErr) {
        console.error('Erro ao remover comprovante da manutenção do Storage:', storageErr)
      }
    }

    await docRef.delete()

    if (veiculoIdDaManutencao) await recalcularCustoEfetivoTotal(veiculoIdDaManutencao)

    revalidatePath('/dashboard/manutencao')
    revalidatePath('/dashboard/veiculos')
    return { success: 'Manutenção removida com sucesso!' }
  } catch (error: any) {
    return { error: `Erro ao remover manutenção: ${error.message}` }
  }
}

/**
 * Manutenções **baixadas** de um único veículo, resumidas para compor o
 * "Custo efetivo total" no cadastro de veículo. Leitura sem gate de admin —
 * mesma postura de `getManutencoes`; devolve só tipo e valor.
 */
export async function listarManutencoesVeiculo(
  veiculoId: string,
): Promise<Array<{ id: string; tipo: string; custo: number }>> {
  if (!veiculoId) return []
  try {
    const snap = await adminDb
      .collection('manutencoes')
      .where('veiculoId', '==', veiculoId)
      .get()
    const itens: Array<{ id: string; tipo: string; custo: number }> = []
    for (const doc of snap.docs) {
      const data = doc.data()
      const m = {
        baixa: (data.baixa as BaixaManutencao) ?? null,
        custo: typeof data.custo === 'number' ? data.custo : Number(data.custo) || 0,
        status: (data.status as ManutencaoStatus) || 'agendada',
      }
      if (!isManutencaoBaixada(m)) continue
      const valor = valorManutencao(m)
      if (valor <= 0) continue
      itens.push({
        id: doc.id,
        tipo: (data.tipo as string) || 'Manutenção',
        custo: valor,
      })
    }
    return itens
  } catch (error) {
    console.error('Erro ao listar manutenções do veículo:', error)
    return []
  }
}

/**
 * Lista todas as manutenções vinculadas a um conjunto de veículos.
 * Usado para mostrar manutenções recentes nas propostas.
 */
export async function getManutencoesPorVeiculos(
  veiculoIds: string[],
): Promise<Manutencao[]> {
  if (!veiculoIds || veiculoIds.length === 0) return []
  try {
    await assertAdmin()
  } catch {
    // falha silenciosa — propostas devem funcionar mesmo se a lista falhar
    return []
  }
  try {
    const items: Manutencao[] = []
    // Firestore 'in' aceita até 30 valores por consulta — chunking de segurança.
    const chunks: string[][] = []
    for (let i = 0; i < veiculoIds.length; i += 30) {
      chunks.push(veiculoIds.slice(i, i + 30))
    }
    for (const chunk of chunks) {
      const snap = await adminDb
        .collection('manutencoes')
        .where('veiculoId', 'in', chunk)
        .orderBy('dataAgendada', 'desc')
        .get()
      snap.forEach((doc: any) => {
        const data = doc.data()
        items.push({
          id: doc.id,
          veiculoId: data.veiculoId || '',
          veiculoLabel: data.veiculoLabel || '',
          tipo: data.tipo || '',
          descricao: data.descricao || null,
          oficina: data.oficina || '',
          responsavel: data.responsavel || '',
          custo: data.custo ?? 0,
          dataAgendada: data.dataAgendada || '',
          dataConclusao: data.dataConclusao || null,
          status: (data.status as ManutencaoStatus) || 'agendada',
          pecasConserto: parsePecasConserto(data.pecasConserto),
          baixa: (data.baixa as BaixaManutencao) ?? null,
          created_at: data.created_at,
          updated_at: data.updated_at,
          created_by: data.created_by || null,
        })
      })
    }
    return items
  } catch (err) {
    console.error('Erro ao buscar manutenções por veículo:', err)
    return []
  }
}

// ─── Baixa da manutenção (valor + comprovante opcional) ─────────────────────
// Só na baixa o valor da manutenção é definido. Um comprovante por manutenção
// (mesmo formato do módulo Financeiro).

const MAX_COMPROVANTE_SIZE = 10 * 1024 * 1024 // 10MB
const COMPROVANTE_TIPOS_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]

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
 * Dá baixa numa manutenção: registra o valor pago (obrigatório) e, opcionalmente,
 * anexa um comprovante (PDF ou imagem). Marca a manutenção como Concluída e
 * preenche a data de conclusão se estiver vazia. Recebe FormData com:
 * - manutencaoId: string
 * - valor: string (máscara pt-BR)
 * - arquivo: File opcional (PDF/JPG/PNG/WEBP, máx. 10MB)
 */
export async function darBaixaManutencao(
  formData: FormData,
): Promise<BaixaManutencaoResponse> {
  let user: { uid: string; email?: string | null }
  try {
    user = (await assertAdmin()).user as { uid: string; email?: string | null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  const manutencaoId = ((formData.get('manutencaoId') as string) || '').trim()
  const valor = parseCusto((formData.get('valor') as string) || '')
  const file = formData.get('arquivo')

  if (!manutencaoId) return { error: 'Manutenção não especificada.' }
  if (!(valor > 0)) return { error: 'Informe o valor pago na manutenção.' }

  const temArquivo = file instanceof File && file.size > 0
  if (temArquivo) {
    if (file.size > MAX_COMPROVANTE_SIZE) {
      return { error: 'Arquivo excede o limite de 10MB.' }
    }
    if (!COMPROVANTE_TIPOS_PERMITIDOS.includes(file.type)) {
      return { error: 'Formato não suportado. Envie um PDF, JPG, PNG ou WEBP.' }
    }
  }

  try {
    const docRef = adminDb.collection('manutencoes').doc(manutencaoId)
    const doc = await docRef.get()
    if (!doc.exists) return { error: 'Manutenção não encontrada.' }

    const dados = doc.data() || {}
    if (dados.baixa) {
      return { error: 'Esta manutenção já teve baixa. Estorne antes de refazer.' }
    }

    const now = new Date().toISOString()
    let comprovante: ManutencaoComprovante | null = null

    if (temArquivo) {
      const contentType = file.type
      const ext = extensaoPorTipo(contentType, file.name)
      const storagePath = `manutencoes/${manutencaoId}/comprovante_${Date.now()}.${ext}`
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await adminStorage
        .bucket()
        .file(storagePath)
        .save(buffer, {
          metadata: {
            contentType,
            metadata: { manutencaoId, uploadedBy: user.uid },
          },
        })
      comprovante = {
        fileName: sanitizeFileName(file.name),
        contentType,
        size: file.size,
        storagePath,
        uploadedByUid: user.uid,
        uploadedByEmail: user.email ?? null,
        uploadedAt: now,
      }
    }

    const baixa: BaixaManutencao = {
      valor,
      comprovante,
      baixadoEm: now,
      baixadoPorUid: user.uid,
      baixadoPorEmail: user.email ?? null,
    }

    const dataConclusaoAtual = (dados.dataConclusao as string) || ''
    const atualizacao = {
      baixa,
      custo: valor,
      status: 'concluida' as ManutencaoStatus,
      dataConclusao: dataConclusaoAtual || now.slice(0, 10),
      updated_at: now,
    }

    await docRef.update(atualizacao)

    const veiculoId = (dados.veiculoId as string) || ''
    if (veiculoId) await recalcularCustoEfetivoTotal(veiculoId)

    revalidatePath('/dashboard/manutencao')
    revalidatePath('/dashboard/veiculos')
    return {
      success: 'Baixa registrada com sucesso!',
      manutencao: { id: manutencaoId, ...dados, ...atualizacao } as Manutencao,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'erro inesperado'
    return { error: `Erro ao dar baixa na manutenção: ${msg}` }
  }
}

/**
 * Estorna a baixa de uma manutenção: zera o valor e apaga o comprovante.
 * O status não é alterado.
 */
export async function estornarBaixaManutencao(
  id: string,
): Promise<{ success?: string; error?: string }> {
  try {
    await assertAdmin()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  if (!id) return { error: 'ID inválido.' }

  try {
    const docRef = adminDb.collection('manutencoes').doc(id)
    const doc = await docRef.get()
    if (!doc.exists) return { error: 'Manutenção não encontrada.' }

    const dados = doc.data() || {}
    const baixa = (dados.baixa as BaixaManutencao | null) ?? null
    if (!baixa) return { error: 'Esta manutenção não tem baixa para estornar.' }

    if (baixa.comprovante?.storagePath) {
      try {
        const fileRef = adminStorage.bucket().file(baixa.comprovante.storagePath)
        const [exists] = await fileRef.exists()
        if (exists) await fileRef.delete()
      } catch (storageErr) {
        console.error('Erro ao remover comprovante da manutenção do Storage:', storageErr)
      }
    }

    await docRef.update({
      baixa: null,
      custo: 0,
      updated_at: new Date().toISOString(),
    })

    const veiculoId = (dados.veiculoId as string) || ''
    if (veiculoId) await recalcularCustoEfetivoTotal(veiculoId)

    revalidatePath('/dashboard/manutencao')
    revalidatePath('/dashboard/veiculos')
    return { success: 'Baixa estornada com sucesso!' }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'erro inesperado'
    return { error: `Erro ao estornar baixa: ${msg}` }
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import {
  MANUTENCAO_STATUS,
  type Manutencao,
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
  const custoRaw = (formData.get('custo') as string) || ''
  const custo = parseCusto(custoRaw)
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
      custo,
      dataAgendada,
      dataConclusao,
      status,
      pecasConserto,
      created_by: user.uid,
      created_at: now,
      updated_at: now,
    }

    await docRef.set(nova)

    revalidatePath('/dashboard/manutencao')
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
  const custoRaw = (formData.get('custo') as string) || ''
  const custo = parseCusto(custoRaw)
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

    const now = new Date().toISOString()
    const atualizacao = {
      veiculoId,
      veiculoLabel,
      tipo,
      descricao,
      oficina,
      responsavel,
      custo,
      dataAgendada,
      dataConclusao,
      status,
      pecasConserto,
      updated_at: now,
    }

    await docRef.update(atualizacao)

    revalidatePath('/dashboard/manutencao')
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

    await docRef.delete()
    revalidatePath('/dashboard/manutencao')
    return { success: 'Manutenção removida com sucesso!' }
  } catch (error: any) {
    return { error: `Erro ao remover manutenção: ${error.message}` }
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

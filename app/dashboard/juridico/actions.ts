'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { assertJuridicoAccess } from '@/utils/permissions'
import {
  PROCESSO_STATUS,
  type Processo,
  type ProcessoFieldErrors,
  type ProcessoResponse,
  type ProcessoStatus,
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

// ─── Server Actions ──────────────────────────────────────────────────────────

/**
 * Lista todos os processos cadastrados, mais recentes primeiro.
 */
export async function getProcessos(): Promise<Processo[]> {
  try {
    const snapshot = await adminDb
      .collection('processos')
      .orderBy('created_at', 'desc')
      .get()

    const items: Processo[] = []
    snapshot.forEach((doc: any) => {
      const data = doc.data()
      items.push({
        id: doc.id,
        titulo: data.titulo || '',
        cliente: data.cliente || '',
        tipo: data.tipo || '',
        numero: data.numero || null,
        status: (data.status as ProcessoStatus) || 'em_andamento',
        responsavel: data.responsavel || '',
        prazo: data.prazo || null,
        observacoes: data.observacoes || null,
        veiculoId: data.veiculoId || null,
        veiculoResumo: data.veiculoResumo || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        created_by: data.created_by || null,
      })
    })

    return items
  } catch (error) {
    console.error('Erro ao buscar processos:', error)
    return []
  }
}

/**
 * Cadastra um novo processo.
 */
export async function createProcesso(formData: FormData): Promise<ProcessoResponse> {
  let user: any
  try {
    const res = await assertAdmin()
    user = res.user
  } catch (err: any) {
    return { error: err.message }
  }

  const titulo = ((formData.get('titulo') as string) || '').trim()
  const cliente = ((formData.get('cliente') as string) || '').trim()
  const tipo = ((formData.get('tipo') as string) || '').trim()
  const numero = ((formData.get('numero') as string) || '').trim() || null
  const statusRaw = ((formData.get('status') as string) || '').trim()
  const status: ProcessoStatus = (
    PROCESSO_STATUS.includes(statusRaw as ProcessoStatus)
      ? statusRaw
      : 'em_andamento'
  ) as ProcessoStatus
  const responsavel = ((formData.get('responsavel') as string) || '').trim()
  const prazo = ((formData.get('prazo') as string) || '').trim() || null
  const observacoes = ((formData.get('observacoes') as string) || '').trim() || null
  const veiculoId = ((formData.get('veiculoId') as string) || '').trim() || null
  const veiculoResumo = ((formData.get('veiculoResumo') as string) || '').trim() || null

  const fieldErrors: ProcessoFieldErrors = {}
  if (!titulo) fieldErrors.titulo = 'Informe o título do processo.'
  if (!cliente) fieldErrors.cliente = 'Informe o cliente.'
  if (!tipo) fieldErrors.tipo = 'Selecione o tipo.'
  if (!responsavel) fieldErrors.responsavel = 'Informe o responsável.'

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  try {
    const docRef = adminDb.collection('processos').doc()
    const now = new Date().toISOString()

    const novo = {
      titulo,
      cliente,
      tipo,
      numero,
      status,
      responsavel,
      prazo,
      observacoes,
      veiculoId,
      veiculoResumo,
      created_by: user.uid,
      created_at: now,
      updated_at: now,
    }

    await docRef.set(novo)

    revalidatePath('/dashboard/juridico')
    return {
      success: 'Processo cadastrado com sucesso!',
      processo: { id: docRef.id, ...novo },
    }
  } catch (error: any) {
    return { error: `Erro ao cadastrar processo: ${error.message}` }
  }
}

/**
 * Atualiza um processo existente.
 */
export async function updateProcesso(
  id: string,
  formData: FormData,
): Promise<ProcessoResponse> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  if (!id) return { error: 'ID inválido.' }

  const titulo = ((formData.get('titulo') as string) || '').trim()
  const cliente = ((formData.get('cliente') as string) || '').trim()
  const tipo = ((formData.get('tipo') as string) || '').trim()
  const numero = ((formData.get('numero') as string) || '').trim() || null
  const statusRaw = ((formData.get('status') as string) || '').trim()
  const status: ProcessoStatus = (
    PROCESSO_STATUS.includes(statusRaw as ProcessoStatus)
      ? statusRaw
      : 'em_andamento'
  ) as ProcessoStatus
  const responsavel = ((formData.get('responsavel') as string) || '').trim()
  const prazo = ((formData.get('prazo') as string) || '').trim() || null
  const observacoes = ((formData.get('observacoes') as string) || '').trim() || null
  const veiculoId = ((formData.get('veiculoId') as string) || '').trim() || null
  const veiculoResumo = ((formData.get('veiculoResumo') as string) || '').trim() || null

  const fieldErrors: ProcessoFieldErrors = {}
  if (!titulo) fieldErrors.titulo = 'Informe o título do processo.'
  if (!cliente) fieldErrors.cliente = 'Informe o cliente.'
  if (!tipo) fieldErrors.tipo = 'Selecione o tipo.'
  if (!responsavel) fieldErrors.responsavel = 'Informe o responsável.'

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  try {
    const docRef = adminDb.collection('processos').doc(id)
    const doc = await docRef.get()
    if (!doc.exists) return { error: 'Processo não encontrado.' }

    const now = new Date().toISOString()
    const atualizacao = {
      titulo,
      cliente,
      tipo,
      numero,
      status,
      responsavel,
      prazo,
      observacoes,
      veiculoId,
      veiculoResumo,
      updated_at: now,
    }

    await docRef.update(atualizacao)

    revalidatePath('/dashboard/juridico')
    return {
      success: 'Processo atualizado com sucesso!',
      processo: { id, ...doc.data(), ...atualizacao } as Processo,
    }
  } catch (error: any) {
    return { error: `Erro ao atualizar processo: ${error.message}` }
  }
}

/**
 * Remove um processo.
 */
export async function deleteProcesso(
  id: string,
): Promise<{ success?: string; error?: string }> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  if (!id) return { error: 'ID inválido.' }

  try {
    const docRef = adminDb.collection('processos').doc(id)
    const doc = await docRef.get()
    if (!doc.exists) return { error: 'Processo não encontrado.' }

    await docRef.delete()
    revalidatePath('/dashboard/juridico')
    return { success: 'Processo removido com sucesso!' }
  } catch (error: any) {
    return { error: `Erro ao remover processo: ${error.message}` }
  }
}

/**
 * Mapa veiculoId -> nome do cliente, a partir dos contratos cadastrados.
 * Usado para exibir o cliente de cada veículo no seletor de veículos do
 * processo e para sugerir automaticamente o campo "Cliente" ao selecionar
 * um veículo. Para veículos com mais de um contrato, prioriza o com status
 * 'ativo'; na ausência, usa o mais recente. Retorna mapa vazio se o usuário
 * não tiver acesso ao jurídico ou em caso de erro.
 */
export async function getClientesPorVeiculo(): Promise<Record<string, string>> {
  try {
    await assertJuridicoAccess()
  } catch {
    return {}
  }

  try {
    const snapshot = await adminDb.collection('contratos').get()

    const porVeiculo = new Map<string, FirebaseFirestore.DocumentData[]>()
    for (const doc of snapshot.docs) {
      const data = doc.data()
      const veiculoId = data.veiculoId as string | undefined
      if (!veiculoId) continue
      const lista = porVeiculo.get(veiculoId) ?? []
      lista.push(data)
      porVeiculo.set(veiculoId, lista)
    }

    const mapa: Record<string, string> = {}
    for (const [veiculoId, contratos] of porVeiculo) {
      const ordenados = [...contratos].sort((a, b) =>
        (b.criadoEm || '').localeCompare(a.criadoEm || ''),
      )
      const escolhido = ordenados.find((c) => c.status === 'ativo') || ordenados[0]
      if (escolhido?.clienteNome) mapa[veiculoId] = escolhido.clienteNome as string
    }

    return mapa
  } catch (error) {
    console.error('Erro ao buscar clientes por veículo:', error)
    return {}
  }
}

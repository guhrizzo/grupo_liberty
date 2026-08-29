'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { assertJuridicoAccess } from '@/utils/permissions'
import { encrypt, decrypt } from '@/utils/crypto'
import {
  PROCESSO_STATUS,
  ANOTACAO_MARCADORES,
  type Processo,
  type ProcessoFieldErrors,
  type ProcessoResponse,
  type ProcessoStatus,
  type Anotacao,
  type AnotacaoEscopo,
  type AnotacaoMarcador,
  type AnotacaoResponse,
  type AnotacoesContagem,
} from './types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Descriptografa um CPF salvo. Registros gravados antes da criptografia
 * (texto plano, sem o separador ':' do formato 'ivHex:encryptedHex') caem no
 * fallback e retornam o valor bruto, para não quebrar processos já cadastrados.
 */
function decryptCpfOrRaw(value: string | null | undefined): string {
  if (!value) return ''
  if (!value.includes(':')) return value
  return decrypt(value) || value
}

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
        clienteCpf: decryptCpfOrRaw(data.clienteCpf) || null,
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
  const clienteCpf = ((formData.get('clienteCpf') as string) || '').trim()
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
  if (clienteCpf && clienteCpf.replace(/\D/g, '').length < 11) {
    fieldErrors.clienteCpf = 'CPF incompleto.'
  }
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
      clienteCpf: clienteCpf ? encrypt(clienteCpf) : null,
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
  const clienteCpf = ((formData.get('clienteCpf') as string) || '').trim()
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
  if (clienteCpf && clienteCpf.replace(/\D/g, '').length < 11) {
    fieldErrors.clienteCpf = 'CPF incompleto.'
  }
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
      clienteCpf: clienteCpf ? encrypt(clienteCpf) : null,
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

export interface ClienteVeiculoInfo {
  nome: string
  cpf: string | null
}

/**
 * Mapa veiculoId -> { nome, cpf } do cliente, a partir dos contratos
 * cadastrados (CPF/CNPJ do contrato é salvo em texto plano — ver
 * app/dashboard/contratos/actions.ts). Usado para exibir o cliente de cada
 * veículo no seletor de veículos do processo e para sugerir automaticamente
 * os campos "Cliente" e "CPF do cliente" ao selecionar um veículo. Para
 * veículos com mais de um contrato, prioriza o com status 'ativo'; na
 * ausência, usa o mais recente. Retorna mapa vazio se o usuário não tiver
 * acesso ao jurídico ou em caso de erro.
 */
export async function getClientesPorVeiculo(): Promise<Record<string, ClienteVeiculoInfo>> {
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

    const mapa: Record<string, ClienteVeiculoInfo> = {}
    for (const [veiculoId, contratos] of porVeiculo) {
      const ordenados = [...contratos].sort((a, b) =>
        (b.criadoEm || '').localeCompare(a.criadoEm || ''),
      )
      const escolhido = ordenados.find((c) => c.status === 'ativo') || ordenados[0]
      if (escolhido?.clienteNome) {
        mapa[veiculoId] = {
          nome: escolhido.clienteNome as string,
          cpf: (escolhido.clienteCpfCnpj as string) || null,
        }
      }
    }

    return mapa
  } catch (error) {
    console.error('Erro ao buscar clientes por veículo:', error)
    return {}
  }
}

// ─── Anotações do módulo jurídico ────────────────────────────────────────────

const ANOTACOES_COLLECTION = 'juridico_anotacoes'
const ANOTACAO_MAX_LEN = 5000

function anotacaoErro(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

function serializeAnotacao(id: string, data: FirebaseFirestore.DocumentData): Anotacao {
  const escopo: AnotacaoEscopo = data.escopo === 'processo' ? 'processo' : 'geral'
  const marcador = ANOTACAO_MARCADORES.includes(data.marcador)
    ? (data.marcador as AnotacaoMarcador)
    : null
  return {
    id,
    escopo,
    processoId: escopo === 'processo' ? (data.processoId ?? null) : null,
    texto: typeof data.texto === 'string' ? data.texto : '',
    marcador,
    autorUid: data.autorUid ?? '',
    autorNome: data.autorNome || data.autorEmail || 'Usuário',
    created_at: data.created_at,
    updated_at: data.updated_at ?? data.created_at,
  }
}

/** Ordena por created_at desc em memória (fallback quando não há índice composto). */
function ordenarAnotacoes(itens: Anotacao[]): Anotacao[] {
  return itens.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

/**
 * Lista as anotações gerais (mural do setor jurídico), mais recentes primeiro.
 * Gate: assertJuridicoAccess (admin ou advogado).
 */
export async function getAnotacoesGerais(): Promise<Anotacao[]> {
  try {
    await assertJuridicoAccess()
  } catch {
    return []
  }

  try {
    const snapshot = await adminDb
      .collection(ANOTACOES_COLLECTION)
      .where('escopo', '==', 'geral')
      .get()
    return ordenarAnotacoes(snapshot.docs.map((d) => serializeAnotacao(d.id, d.data())))
  } catch (error) {
    console.error('Erro ao buscar anotações gerais:', error)
    return []
  }
}

/**
 * Lista as anotações vinculadas a um processo, mais recentes primeiro.
 * Gate: assertJuridicoAccess (admin ou advogado).
 */
export async function getAnotacoesProcesso(processoId: string): Promise<Anotacao[]> {
  try {
    await assertJuridicoAccess()
  } catch {
    return []
  }

  const id = (processoId || '').trim()
  if (!id) return []

  try {
    const snapshot = await adminDb
      .collection(ANOTACOES_COLLECTION)
      .where('escopo', '==', 'processo')
      .where('processoId', '==', id)
      .get()
    return ordenarAnotacoes(snapshot.docs.map((d) => serializeAnotacao(d.id, d.data())))
  } catch (error) {
    console.error('Erro ao buscar anotações do processo:', error)
    return []
  }
}

/**
 * Contagem de anotações (geral + por processo) para exibir badges na tela
 * sem precisar carregar as listas completas.
 */
export async function getAnotacoesContagem(): Promise<AnotacoesContagem> {
  const vazio: AnotacoesContagem = { geral: 0, porProcesso: {} }
  try {
    await assertJuridicoAccess()
  } catch {
    return vazio
  }

  try {
    const snapshot = await adminDb.collection(ANOTACOES_COLLECTION).get()
    const contagem: AnotacoesContagem = { geral: 0, porProcesso: {} }
    for (const doc of snapshot.docs) {
      const data = doc.data()
      if (data.escopo === 'processo' && data.processoId) {
        contagem.porProcesso[data.processoId] =
          (contagem.porProcesso[data.processoId] ?? 0) + 1
      } else {
        contagem.geral += 1
      }
    }
    return contagem
  } catch (error) {
    console.error('Erro ao contar anotações:', error)
    return vazio
  }
}

/**
 * Cria uma anotação. Recebe FormData com:
 * - escopo: 'geral' | 'processo'
 * - processoId: string (obrigatório quando escopo === 'processo')
 * - texto: string
 * - marcador: string opcional
 * Gate: assertJuridicoAccess (admin ou advogado — ambos podem criar).
 */
export async function createAnotacao(formData: FormData): Promise<AnotacaoResponse> {
  let user
  try {
    user = await assertJuridicoAccess()
  } catch (err) {
    return { error: anotacaoErro(err, 'Acesso negado.') }
  }

  const escopo: AnotacaoEscopo =
    (formData.get('escopo') as string) === 'processo' ? 'processo' : 'geral'
  const processoId = ((formData.get('processoId') as string) || '').trim() || null
  const texto = ((formData.get('texto') as string) || '').trim()
  const marcadorRaw = ((formData.get('marcador') as string) || '').trim()
  const marcador: AnotacaoMarcador | null = ANOTACAO_MARCADORES.includes(
    marcadorRaw as AnotacaoMarcador,
  )
    ? (marcadorRaw as AnotacaoMarcador)
    : null

  if (!texto) return { error: 'Escreva o texto da anotação.' }
  if (texto.length > ANOTACAO_MAX_LEN) {
    return { error: `A anotação excede o limite de ${ANOTACAO_MAX_LEN} caracteres.` }
  }
  if (escopo === 'processo' && !processoId) {
    return { error: 'Processo não especificado.' }
  }

  try {
    if (escopo === 'processo' && processoId) {
      const processoDoc = await adminDb.collection('processos').doc(processoId).get()
      if (!processoDoc.exists) return { error: 'Processo não encontrado.' }
    }

    const now = new Date().toISOString()
    const docRef = adminDb.collection(ANOTACOES_COLLECTION).doc()
    const novo = {
      escopo,
      processoId: escopo === 'processo' ? processoId : null,
      texto,
      marcador,
      autorUid: user.uid,
      autorNome: user.name || user.email || 'Usuário',
      autorEmail: user.email ?? null,
      created_at: now,
      updated_at: now,
    }
    await docRef.set(novo)

    revalidatePath('/dashboard/juridico')
    return {
      success: 'Anotação adicionada.',
      anotacao: serializeAnotacao(docRef.id, novo),
    }
  } catch (error) {
    return { error: `Erro ao salvar anotação: ${anotacaoErro(error, 'erro inesperado')}` }
  }
}

/**
 * Edita uma anotação. Permitido apenas ao autor ou a um admin.
 * Recebe FormData com: texto, marcador (opcional).
 */
export async function updateAnotacao(
  id: string,
  formData: FormData,
): Promise<AnotacaoResponse> {
  let user
  try {
    user = await assertJuridicoAccess()
  } catch (err) {
    return { error: anotacaoErro(err, 'Acesso negado.') }
  }

  if (!id) return { error: 'ID inválido.' }

  const texto = ((formData.get('texto') as string) || '').trim()
  const marcadorRaw = ((formData.get('marcador') as string) || '').trim()
  const marcador: AnotacaoMarcador | null = ANOTACAO_MARCADORES.includes(
    marcadorRaw as AnotacaoMarcador,
  )
    ? (marcadorRaw as AnotacaoMarcador)
    : null

  if (!texto) return { error: 'Escreva o texto da anotação.' }
  if (texto.length > ANOTACAO_MAX_LEN) {
    return { error: `A anotação excede o limite de ${ANOTACAO_MAX_LEN} caracteres.` }
  }

  try {
    const docRef = adminDb.collection(ANOTACOES_COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) return { error: 'Anotação não encontrada.' }

    const data = doc.data() as { autorUid?: string }
    if (data.autorUid !== user.uid && user.role !== 'admin') {
      return { error: 'Você só pode editar suas próprias anotações.' }
    }

    const now = new Date().toISOString()
    await docRef.update({ texto, marcador, updated_at: now })

    revalidatePath('/dashboard/juridico')
    return {
      success: 'Anotação atualizada.',
      anotacao: serializeAnotacao(id, { ...doc.data(), texto, marcador, updated_at: now }),
    }
  } catch (error) {
    return { error: `Erro ao atualizar anotação: ${anotacaoErro(error, 'erro inesperado')}` }
  }
}

/**
 * Remove uma anotação. Permitido ao autor ou a um admin.
 */
export async function deleteAnotacao(
  id: string,
): Promise<{ success?: string; error?: string }> {
  let user
  try {
    user = await assertJuridicoAccess()
  } catch (err) {
    return { error: anotacaoErro(err, 'Acesso negado.') }
  }

  if (!id) return { error: 'ID inválido.' }

  try {
    const docRef = adminDb.collection(ANOTACOES_COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) return { error: 'Anotação não encontrada.' }

    const data = doc.data() as { autorUid?: string }
    if (data.autorUid !== user.uid && user.role !== 'admin') {
      return { error: 'Você só pode remover suas próprias anotações.' }
    }

    await docRef.delete()
    revalidatePath('/dashboard/juridico')
    return { success: 'Anotação removida.' }
  } catch (error) {
    return { error: `Erro ao remover anotação: ${anotacaoErro(error, 'erro inesperado')}` }
  }
}

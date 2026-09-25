'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { adminAuth, adminDb, adminStorage } from '@/utils/firebase/admin'
import { assertPodeGerarContratos } from '@/utils/permissions'
import { validarCPF } from '@/utils/validadorCpf'
import { encrypt } from '@/utils/crypto'

async function getSessionUser() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) return null

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(session, true)
    return decodedClaims
  } catch (error) {
    return null
  }
}

export async function enviarPropostaAction(formData: FormData) {
  const user = await getSessionUser()

  const veiculoId = (formData.get('veiculo_id') as string)?.trim()
  const nome = (formData.get('nome') as string)?.trim()
  const cpf = (formData.get('cpf') as string)?.trim()
  const telefone = (formData.get('telefone') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const valorStr = (formData.get('valor') as string)?.trim()
  const mensagem = (formData.get('mensagem') as string)?.trim()

  if (!veiculoId) {
    return { error: 'Veículo não especificado.' }
  }

  if (!nome || nome.length < 2) {
    return { error: 'Informe seu nome completo.' }
  }

  if (!cpf || !validarCPF(cpf)) {
    return { error: 'O CPF informado é inválido ou mal formatado.' }
  }

  if (!telefone || telefone.length < 8) {
    return { error: 'Informe um telefone/WhatsApp de contato válido.' }
  }

  if (!email || !email.includes('@')) {
    return { error: 'Informe um endereço de e-mail válido.' }
  }

  if (!mensagem) {
    return { error: 'A mensagem de interesse é obrigatória.' }
  }

  const valor = valorStr ? parseFloat(valorStr.replace(',', '.')) : null

  if (valor !== null && (isNaN(valor) || valor <= 0)) {
    return { error: 'Valor da proposta inválido.' }
  }

  // Criptografar CPF para salvar de forma segura no Firestore
  const cpfCriptografado = encrypt(cpf.replace(/\D/g, ''))

  try {
    const docRef = adminDb.collection('propostas').doc()
    await docRef.set({
      veiculo_id: veiculoId,
      user_id: user ? user.uid : null,
      nome,
      cpf: cpfCriptografado,
      telefone,
      email,
      valor,
      mensagem,
      status: 'pendente',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    revalidatePath(`/veiculos/${veiculoId}`)
    return { success: 'Proposta enviada com sucesso! Nossa equipe entrará em contato.' }
  } catch (error: any) {
    console.error('Erro ao enviar proposta:', error)
    return { error: `Erro ao enviar proposta: ${error.message}` }
  }
}

// ─── Contratos anexados ao veículo (PDFs manuais) ───────────────────────────

const MAX_PDF_SIZE = 10 * 1024 * 1024 // 10MB

function sanitizeString(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function sanitizeOptional(value: unknown, maxLength = 500): string | null {
  const v = sanitizeString(value, maxLength)
  return v || null
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_ .]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'contrato'
}

export interface VeiculoContrato {
  id: string
  veiculoId: string
  fileName: string
  descricao: string | null
  storagePath: string
  contentType: string
  size: number
  uploadedByUid: string
  uploadedByEmail: string | null
  uploadedAt: string
  /**
   * Marcado no upload ("Adicionar ao Jurídico"). Quando true, o contrato
   * também aparece na aba /dashboard/juridico com um selo indicando que
   * veio do setor de Contratos.
   */
  enviarJuridico?: boolean
  /**
   * Preenchido quando o contrato é transformado em um processo real no
   * módulo Jurídico ("Registrar como processo"). Guarda o id do processo
   * criado na coleção `processos`.
   */
  processoId?: string | null
  /** Data ISO em que o contrato foi convertido em processo. */
  convertidoEmProcessoEm?: string | null
  /**
   * Tipo do contrato. `categoriaId` referencia a coleção `contrato_categorias`;
   * `categoriaNome` é desnormalizado para exibir sem join. Contratos anexados
   * antes deste recurso ficam com ambos `null` ("Sem categoria").
   */
  categoriaId?: string | null
  categoriaNome?: string | null
  /** Origem do contrato: 'contrato_gerado' (Novo Contrato) ou undefined (anexado manualmente). */
  origem?: 'contrato_gerado'
  /** ID do contrato na coleção `contratos` quando origem === 'contrato_gerado'. */
  contratoId?: string
  clienteNome?: string
}

export type VeiculoContratoResponse = {
  success?: string
  error?: string
  contrato?: VeiculoContrato
}

function serializeVeiculoContrato(
  id: string,
  data: FirebaseFirestore.DocumentData,
): VeiculoContrato {
  return {
    id,
    veiculoId: data.veiculoId,
    fileName: data.fileName,
    descricao: data.descricao ?? null,
    storagePath: data.storagePath,
    contentType: data.contentType,
    size: typeof data.size === 'number' ? data.size : Number(data.size) || 0,
    uploadedByUid: data.uploadedByUid,
    uploadedByEmail: data.uploadedByEmail ?? null,
    uploadedAt: data.uploadedAt,
    enviarJuridico: data.enviarJuridico === true,
    categoriaId: data.categoriaId ?? null,
    categoriaNome: data.categoriaNome ?? null,
    processoId: data.processoId ?? null,
    convertidoEmProcessoEm: data.convertidoEmProcessoEm ?? null,
  }
}

/**
 * Lista todos os contratos (PDFs anexados) de um veículo.
 * Gate: assertPodeGerarContratos (admin OU permissions.contratos).
 */
export async function listarContratosVeiculoAction(
  veiculoId: string,
): Promise<VeiculoContrato[]> {
  try {
    await assertPodeGerarContratos()
  } catch {
    return []
  }

  const id = sanitizeString(veiculoId, 200)
  if (!id) return []

  let docsData: VeiculoContrato[] = []

  try {
    const snapshot = await adminDb
      .collection('veiculo_contratos')
      .where('veiculoId', '==', id)
      .orderBy('uploadedAt', 'desc')
      .get()

    docsData = snapshot.docs.map((doc) => serializeVeiculoContrato(doc.id, doc.data()))
  } catch {
    // Fallback caso o índice composto do Firestore ainda esteja em construção no console do Firebase
    const snapshot = await adminDb
      .collection('veiculo_contratos')
      .where('veiculoId', '==', id)
      .get()

    docsData = snapshot.docs
      .map((doc) => serializeVeiculoContrato(doc.id, doc.data()))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
  }

  return docsData
}

/**
 * Lista todos os contratos (PDFs anexados) de todos os veículos.
 * Usado em /dashboard/contratos para visualização geral.
 * Gate: assertPodeGerarContratos (admin OU permissions.contratos).
 */
export async function listarTodosContratosVeiculoAction(): Promise<VeiculoContrato[]> {
  try {
    await assertPodeGerarContratos()
  } catch {
    return []
  }

  const snapshot = await adminDb
    .collection('veiculo_contratos')
    .orderBy('uploadedAt', 'desc')
    .get()

  return snapshot.docs
    .map((doc) => serializeVeiculoContrato(doc.id, doc.data()))
}

/**
 * Lista contratos gerados via "Novo Contrato" (coleção `contratos`)
 * vinculados a um veículo específico. Retorna no mesmo formato
 * VeiculoContrato para serem exibidos em conjunto na página do veículo.
 * NOTA: Geração de contratos está desativada. Mantido para reativação futura.
 */
export async function listarContratosGeradosVeiculoAction(
  veiculoId: string,
): Promise<VeiculoContrato[]> {
  // Geração de contratos desativada — sempre retorna vazio.
  void veiculoId
  return []
}

/**
 * Anexar contrato = 3 passos, para o PDF não passar pela Vercel (que recusa
 * corpos acima de ~4,5MB antes de chegar no código):
 *   1. `iniciarUploadContratoVeiculoAction` valida permissão/veículo/categoria
 *      e abre uma sessão de upload resumível no Storage;
 *   2. o navegador envia o PDF direto para a URL da sessão
 *      (ver `anexarContratoVeiculo` em ./anexarContrato.ts);
 *   3. `concluirUploadContratoVeiculoAction` confere o arquivo enviado e grava
 *      o documento em `veiculo_contratos`.
 */

function storagePathContrato(veiculoId: string, contratoId: string): string {
  return `veiculos/${veiculoId}/contratos/${contratoId}.pdf`
}

async function validarVeiculoECategoria(
  veiculoId: string,
  categoriaId: string,
): Promise<{ error: string } | { categoriaNome: string }> {
  const veiculoDoc = await adminDb.collection('veiculos').doc(veiculoId).get()
  if (!veiculoDoc.exists) return { error: 'Veículo não encontrado.' }

  const categoriaDoc = await adminDb
    .collection('contrato_categorias')
    .doc(categoriaId)
    .get()
  if (!categoriaDoc.exists) return { error: 'Categoria inválida.' }

  return { categoriaNome: String(categoriaDoc.data()!.nome ?? '') }
}

export interface IniciarUploadContratoInput {
  veiculoId: string
  categoriaId: string
  fileName: string
  fileType: string
  size: number
}

export async function iniciarUploadContratoVeiculoAction(
  input: IniciarUploadContratoInput,
): Promise<{ error?: string; contratoId?: string; uploadUrl?: string }> {
  let user: Awaited<ReturnType<typeof assertPodeGerarContratos>>
  try {
    user = await assertPodeGerarContratos()
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  const veiculoId = sanitizeString(input?.veiculoId, 200)
  const categoriaId = sanitizeString(input?.categoriaId, 200)
  const fileName = sanitizeString(input?.fileName, 500)
  const size = Number(input?.size)

  if (!veiculoId) return { error: 'Veículo não especificado.' }
  if (!fileName || !Number.isFinite(size) || size <= 0) {
    return { error: 'Selecione um arquivo PDF.' }
  }
  if (size > MAX_PDF_SIZE) {
    return { error: 'Arquivo excede o limite de 10MB.' }
  }
  const isPdf =
    input.fileType === 'application/pdf' ||
    fileName.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    return { error: 'Apenas arquivos PDF são permitidos.' }
  }
  if (!categoriaId) {
    return { error: 'Selecione o tipo de contrato.' }
  }

  try {
    const validacao = await validarVeiculoECategoria(veiculoId, categoriaId)
    if ('error' in validacao) return validacao

    const contratoId = adminDb.collection('veiculo_contratos').doc().id
    const fileRef = adminStorage
      .bucket()
      .file(storagePathContrato(veiculoId, contratoId))

    // O `origin` da requisição libera o CORS da sessão para o navegador que
    // vai fazer o PUT, sem precisar configurar CORS no bucket.
    const origin = (await headers()).get('origin') ?? undefined
    const [uploadUrl] = await fileRef.createResumableUpload({
      origin,
      metadata: {
        contentType: 'application/pdf',
        metadata: { veiculoId, contratoId, uploadedBy: user.uid },
      },
    })

    return { contratoId, uploadUrl }
  } catch (err: unknown) {
    console.error('Erro ao iniciar upload de contrato:', err)
    return { error: 'Erro ao preparar o envio do contrato.' }
  }
}

export interface ConcluirUploadContratoInput {
  veiculoId: string
  contratoId: string
  categoriaId: string
  fileName: string
  descricao?: string | null
  enviarJuridico?: boolean
}

export async function concluirUploadContratoVeiculoAction(
  input: ConcluirUploadContratoInput,
): Promise<VeiculoContratoResponse> {
  let user: Awaited<ReturnType<typeof assertPodeGerarContratos>>
  try {
    user = await assertPodeGerarContratos()
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  const veiculoId = sanitizeString(input?.veiculoId, 200)
  const contratoId = sanitizeString(input?.contratoId, 200)
  const categoriaId = sanitizeString(input?.categoriaId, 200)
  const descricao = sanitizeOptional(input?.descricao, 500)
  const enviarJuridico = input?.enviarJuridico === true

  if (!veiculoId || !contratoId || !categoriaId) {
    return { error: 'Dados inválidos.' }
  }
  // Os ids viram caminho no Storage — nada de "/" ou "..".
  if (!/^[A-Za-z0-9_-]+$/.test(veiculoId) || !/^[A-Za-z0-9]+$/.test(contratoId)) {
    return { error: 'Dados inválidos.' }
  }

  const storagePath = storagePathContrato(veiculoId, contratoId)
  const fileRef = adminStorage.bucket().file(storagePath)

  try {
    const contratoRef = adminDb.collection('veiculo_contratos').doc(contratoId)
    if ((await contratoRef.get()).exists) {
      return { error: 'Contrato já registrado.' }
    }

    const [existe] = await fileRef.exists()
    if (!existe) {
      return { error: 'O arquivo não chegou ao servidor. Tente anexar novamente.' }
    }

    // Metadados vêm da sessão aberta no passo 1 — o navegador não os altera.
    const [meta] = await fileRef.getMetadata()
    const size = Number(meta.size)
    if (meta.metadata?.uploadedBy !== user.uid) {
      return { error: 'Acesso negado.' }
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_PDF_SIZE) {
      await fileRef.delete().catch(() => {})
      return { error: 'Arquivo excede o limite de 10MB.' }
    }

    const validacao = await validarVeiculoECategoria(veiculoId, categoriaId)
    if ('error' in validacao) {
      await fileRef.delete().catch(() => {})
      return validacao
    }

    const contrato: VeiculoContrato = {
      id: contratoId,
      veiculoId,
      fileName: sanitizeFileName(sanitizeString(input.fileName, 500)),
      descricao,
      storagePath,
      contentType: 'application/pdf',
      size,
      uploadedByUid: user.uid,
      uploadedByEmail: user.email,
      uploadedAt: new Date().toISOString(),
      enviarJuridico,
      categoriaId,
      categoriaNome: validacao.categoriaNome,
    }

    await contratoRef.set(contrato)

    revalidatePath(`/veiculos/${veiculoId}`)
    if (enviarJuridico) revalidatePath('/dashboard/juridico')
    return { success: 'Contrato anexado com sucesso.', contrato }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao anexar contrato.'
    console.error('Erro ao concluir upload de contrato:', err)
    return { error: message }
  }
}

/**
 * Remove um contrato anexado de um veículo. Recebe FormData com:
 * - veiculoId: string
 * - contratoId: string
 */
export async function removerContratoVeiculoAction(
  formData: FormData,
): Promise<{ success?: string; error?: string }> {
  try {
    await assertPodeGerarContratos()
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  const veiculoId = sanitizeString(formData.get('veiculoId'), 200)
  const contratoId = sanitizeString(formData.get('contratoId'), 200)

  if (!veiculoId || !contratoId) {
    return { error: 'Dados inválidos.' }
  }

  try {
    const docRef = adminDb.collection('veiculo_contratos').doc(contratoId)
    const doc = await docRef.get()

    if (!doc.exists) {
      return { error: 'Contrato não encontrado.' }
    }

    const data = doc.data() as { veiculoId?: string; storagePath?: string }
    if (data.veiculoId !== veiculoId) {
      return { error: 'Acesso negado. Contrato não pertence a este veículo.' }
    }

    if (data.storagePath) {
      try {
        const bucket = adminStorage.bucket()
        const fileRef = bucket.file(data.storagePath)
        const [exists] = await fileRef.exists()
        if (exists) await fileRef.delete()
      } catch (storageErr) {
        console.error('Erro ao remover PDF do Storage:', storageErr)
      }
    }

    await docRef.delete()
    revalidatePath(`/veiculos/${veiculoId}`)
    revalidatePath('/dashboard/juridico')
    return { success: 'Contrato removido com sucesso.' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao remover contrato.'
    console.error('Erro ao remover contrato do veículo:', err)
    return { error: message }
  }
}


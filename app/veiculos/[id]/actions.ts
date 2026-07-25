'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb, adminStorage } from '@/utils/firebase/admin'
import { assertPodeGerarContratos } from '@/utils/permissions'

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

  try {
    const docRef = adminDb.collection('propostas').doc()
    await docRef.set({
      veiculo_id: veiculoId,
      user_id: user ? user.uid : null,
      nome,
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
 * Anexa um PDF de contrato ao veículo. Recebe FormData com:
 * - veiculoId: string
 * - pdf: File (application/pdf, máx. 10MB)
 * - descricao: string opcional
 */
export async function anexarContratoVeiculoAction(
  formData: FormData,
): Promise<VeiculoContratoResponse> {
  let user: Awaited<ReturnType<typeof assertPodeGerarContratos>>
  try {
    user = await assertPodeGerarContratos()
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }

  const veiculoId = sanitizeString(formData.get('veiculoId'), 200)
  const file = formData.get('pdf')
  const descricao = sanitizeOptional(formData.get('descricao'), 500)

  if (!veiculoId) return { error: 'Veículo não especificado.' }
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Selecione um arquivo PDF.' }
  }
  if (file.size > MAX_PDF_SIZE) {
    return { error: 'Arquivo excede o limite de 10MB.' }
  }
  const isPdf =
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    return { error: 'Apenas arquivos PDF são permitidos.' }
  }

  try {
    const veiculoDoc = await adminDb.collection('veiculos').doc(veiculoId).get()
    if (!veiculoDoc.exists) {
      return { error: 'Veículo não encontrado.' }
    }

    const contratoRef = adminDb.collection('veiculo_contratos').doc()
    const contratoId = contratoRef.id
    const storagePath = `veiculos/${veiculoId}/contratos/${contratoId}.pdf`
    const fileName = sanitizeFileName(file.name)
    const now = new Date().toISOString()

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const bucket = adminStorage.bucket()
    const fileRef = bucket.file(storagePath)

    let storageOk = false
    try {
      await fileRef.save(buffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            veiculoId,
            contratoId,
            uploadedBy: user.uid,
            descricao: descricao ?? '',
          },
        },
      })
      storageOk = true

      const contrato: VeiculoContrato = {
        id: contratoId,
        veiculoId,
        fileName,
        descricao,
        storagePath,
        contentType: 'application/pdf',
        size: file.size,
        uploadedByUid: user.uid,
        uploadedByEmail: user.email,
        uploadedAt: now,
      }

      await contratoRef.set(contrato)

      revalidatePath(`/veiculos/${veiculoId}`)
      return { success: 'Contrato anexado com sucesso.', contrato }
    } catch (innerErr: unknown) {
      // Cleanup: se o upload no Storage sucedeu mas o set no Firestore falhou,
      // remove o arquivo órfão.
      if (storageOk) {
        try {
          await fileRef.delete()
        } catch (cleanupErr) {
          console.error('Falha ao limpar PDF órfão no Storage:', cleanupErr)
        }
      }
      throw innerErr
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao anexar contrato.'
    console.error('Erro ao anexar contrato do veículo:', err)
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
    return { success: 'Contrato removido com sucesso.' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao remover contrato.'
    console.error('Erro ao remover contrato do veículo:', err)
    return { error: message }
  }
}


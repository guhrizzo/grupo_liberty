'use server'

// Modelos de contrato: arquivos em branco (Word/PDF) que a equipe baixa para
// preencher. Upload direto do navegador para o Storage, como nos contratos
// dos veículos (app/veiculos/[id]/actions.ts) — a Vercel limita o corpo a
// ~4,5MB:
//   1. iniciarUploadModeloAction → abre uma sessão resumível e devolve a URL;
//   2. o navegador faz PUT do arquivo nessa URL;
//   3. concluirUploadModeloAction → confere o arquivo e grava o documento.

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { adminDb, adminStorage } from '@/utils/firebase/admin'
import { assertPageAccess, type SessionUser } from '@/utils/permissions'
import {
  MODELO_NOME_MAX,
  MODELO_TAMANHO_MAX,
  MODELO_TIPOS,
  extensaoDoArquivo,
  type ModeloContrato,
  type ModeloResponse,
} from './types'

const COLECAO = 'contrato_modelos'

function caminhoStorage(id: string, extensao: string) {
  return `contrato_modelos/${id}.${extensao}`
}

function limparNome(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, MODELO_NOME_MAX)
}

function serialize(id: string, d: FirebaseFirestore.DocumentData): ModeloContrato {
  return {
    id,
    nome: d.nome ?? '',
    fileName: d.fileName ?? '',
    contentType: d.contentType ?? '',
    extensao: d.extensao ?? '',
    size: d.size ?? 0,
    storagePath: d.storagePath ?? '',
    uploadedByUid: d.uploadedByUid ?? '',
    uploadedByEmail: d.uploadedByEmail ?? null,
    uploadedAt: d.uploadedAt ?? '',
  }
}

async function acesso(): Promise<{ user: SessionUser } | { error: string }> {
  try {
    return { user: await assertPageAccess('contratos') }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Acesso negado.' }
  }
}

export async function listarModelosContrato(): Promise<ModeloContrato[]> {
  const a = await acesso()
  if ('error' in a) return []
  try {
    const snap = await adminDb.collection(COLECAO).get()
    return snap.docs
      .map((d) => serialize(d.id, d.data()))
      .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'))
  } catch (err) {
    console.error('[listarModelosContrato]', err)
    return []
  }
}

export async function iniciarUploadModeloAction(input: {
  nome: string
  fileName: string
  size: number
}): Promise<{ error: string } | { modeloId: string; uploadUrl: string; contentType: string }> {
  const a = await acesso()
  if ('error' in a) return a

  const nome = limparNome(input?.nome)
  const extensao = extensaoDoArquivo(String(input?.fileName ?? ''))
  const size = Number(input?.size)
  if (!nome) return { error: 'Informe o nome do modelo.' }
  if (!extensao) return { error: 'Envie um arquivo Word (.doc, .docx), .odt ou PDF.' }
  if (!Number.isFinite(size) || size <= 0) return { error: 'Arquivo vazio.' }
  if (size > MODELO_TAMANHO_MAX) return { error: 'Arquivo excede o limite de 20MB.' }

  try {
    const modeloId = adminDb.collection(COLECAO).doc().id
    const contentType = MODELO_TIPOS[extensao]
    const origin = (await headers()).get('origin') ?? undefined
    const [uploadUrl] = await adminStorage
      .bucket()
      .file(caminhoStorage(modeloId, extensao))
      .createResumableUpload({
        origin,
        metadata: { contentType, metadata: { modeloId, uploadedBy: a.user.uid } },
      })
    return { modeloId, uploadUrl, contentType }
  } catch (err) {
    console.error('[iniciarUploadModeloAction]', err)
    return { error: 'Erro ao preparar o envio do modelo.' }
  }
}

export async function concluirUploadModeloAction(input: {
  modeloId: string
  nome: string
  fileName: string
}): Promise<ModeloResponse> {
  const a = await acesso()
  if ('error' in a) return a

  const modeloId = String(input?.modeloId ?? '')
  const nome = limparNome(input?.nome)
  const fileName = String(input?.fileName ?? '').slice(0, 200)
  const extensao = extensaoDoArquivo(fileName)
  // O id vira caminho no Storage — nada de "/" ou "..".
  if (!/^[A-Za-z0-9]+$/.test(modeloId) || !nome || !extensao) return { error: 'Dados inválidos.' }

  const storagePath = caminhoStorage(modeloId, extensao)
  const fileRef = adminStorage.bucket().file(storagePath)
  try {
    const ref = adminDb.collection(COLECAO).doc(modeloId)
    if ((await ref.get()).exists) return { error: 'Modelo já registrado.' }
    const [existe] = await fileRef.exists()
    if (!existe) return { error: 'O arquivo não chegou ao servidor. Tente de novo.' }

    // Metadados vêm da sessão aberta no passo 1 — o navegador não os altera.
    const [meta] = await fileRef.getMetadata()
    const size = Number(meta.size)
    if (meta.metadata?.uploadedBy !== a.user.uid) return { error: 'Acesso negado.' }
    if (!Number.isFinite(size) || size <= 0 || size > MODELO_TAMANHO_MAX) {
      await fileRef.delete().catch(() => {})
      return { error: 'Arquivo excede o limite de 20MB.' }
    }

    const dados = {
      nome,
      fileName,
      contentType: MODELO_TIPOS[extensao],
      extensao,
      size,
      storagePath,
      uploadedByUid: a.user.uid,
      uploadedByEmail: a.user.email ?? null,
      uploadedAt: new Date().toISOString(),
    }
    await ref.set(dados)
    revalidatePath('/dashboard/contratos')
    return { success: 'Modelo adicionado.', modelo: serialize(modeloId, dados) }
  } catch (err) {
    console.error('[concluirUploadModeloAction]', err)
    return { error: 'Erro ao salvar o modelo.' }
  }
}

export async function renomearModeloAction(id: string, nomeNovo: string): Promise<ModeloResponse> {
  const a = await acesso()
  if ('error' in a) return a
  const nome = limparNome(nomeNovo)
  if (!id || !nome) return { error: 'Informe o nome do modelo.' }
  try {
    const ref = adminDb.collection(COLECAO).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Modelo não encontrado.' }
    await ref.update({ nome })
    revalidatePath('/dashboard/contratos')
    return { success: 'Nome atualizado.', modelo: serialize(id, { ...doc.data(), nome }) }
  } catch (err) {
    console.error('[renomearModeloAction]', err)
    return { error: 'Erro ao renomear o modelo.' }
  }
}

export async function excluirModeloAction(id: string): Promise<{ success: string } | { error: string }> {
  const a = await acesso()
  if ('error' in a) return a
  if (!id) return { error: 'Modelo inválido.' }
  try {
    const ref = adminDb.collection(COLECAO).doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Modelo não encontrado.' }
    const storagePath = doc.data()?.storagePath as string | undefined
    if (storagePath) await adminStorage.bucket().file(storagePath).delete().catch(() => {})
    await ref.delete()
    revalidatePath('/dashboard/contratos')
    return { success: 'Modelo excluído.' }
  } catch (err) {
    console.error('[excluirModeloAction]', err)
    return { error: 'Erro ao excluir o modelo.' }
  }
}

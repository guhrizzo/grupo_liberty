'use server'

import { revalidatePath } from 'next/cache'
import { adminDb, adminStorage } from '@/utils/firebase/admin'
import { converterFotoParaWebp, FOTO_CACHE_CONTROL } from '@/utils/veiculos/foto-webp'
import { getSessionUser, isOwner } from '@/utils/permissions'
import {
  ehFeedbackStatus,
  ehFeedbackTipo,
  FEEDBACK_MAX_FOTOS,
  type FeedbackStatus,
} from '@/constants/feedback'
import type { Feedback, FeedbackAtualizacao, FeedbackFieldErrors, FeedbackResponse } from './types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serialize(id: string, data: FirebaseFirestore.DocumentData): Feedback {
  const atualizacoes = (Array.isArray(data.atualizacoes) ? data.atualizacoes : [])
    .map((a: FeedbackAtualizacao) => ({ texto: String(a.texto ?? ''), em: String(a.em ?? '') }))
    .sort((a: FeedbackAtualizacao, b: FeedbackAtualizacao) => a.em.localeCompare(b.em))

  return {
    id,
    tipo: data.tipo === 'melhoria' ? 'melhoria' : 'bug',
    titulo: data.titulo ?? '',
    descricao: data.descricao ?? '',
    tela: data.tela ?? null,
    status: ehFeedbackStatus(data.status) ? data.status : 'aberto',
    criadoPorUid: data.criadoPorUid ?? '',
    criadoPorNome: data.criadoPorNome ?? 'Usuário',
    criadoPorEmail: data.criadoPorEmail ?? null,
    criadoEm: data.criadoEm ?? '',
    atualizadoEm: data.atualizadoEm ?? data.criadoEm ?? '',
    atualizacoes,
    fotos: Array.isArray(data.fotos) ? data.fotos.filter((u: unknown) => typeof u === 'string') : [],
  }
}


/** Garante que quem chama é o dono. Retorna a mensagem de erro, ou null se ok. */
async function checarDono(): Promise<string | null> {
  const user = await getSessionUser()
  if (!user) return 'Não autenticado.'
  if (!isOwner(user)) return 'Acesso negado. Apenas o responsável pode fazer a triagem.'
  return null
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getFeedback(): Promise<Feedback[]> {
  try {
    const user = await getSessionUser()
    if (!user) return []

    const snap = await adminDb.collection('feedback').orderBy('criadoEm', 'desc').get()
    return snap.docs.map((doc) => serialize(doc.id, doc.data()))
  } catch (err) {
    console.error('[getFeedback]', err)
    return []
  }
}

export async function criarFeedback(formData: FormData): Promise<FeedbackResponse> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }

  const tipoRaw = (formData.get('tipo') as string) || ''
  const titulo = ((formData.get('titulo') as string) || '').trim()
  const descricao = ((formData.get('descricao') as string) || '').trim()
  const telaRaw = ((formData.get('tela') as string) || '').trim()

  const fieldErrors: FeedbackFieldErrors = {}
  if (!ehFeedbackTipo(tipoRaw)) fieldErrors.tipo = 'Selecione o tipo.'
  if (!titulo) fieldErrors.titulo = 'Informe um título.'
  else if (titulo.length > 140) fieldErrors.titulo = 'Máximo de 140 caracteres.'
  if (!descricao) fieldErrors.descricao = 'Descreva o que aconteceu.'
  else if (descricao.length > 4000) fieldErrors.descricao = 'Máximo de 4000 caracteres.'
  if (telaRaw.length > 140) fieldErrors.tela = 'Máximo de 140 caracteres.'

  const arquivos = (formData.getAll('fotos') as File[]).filter((f) => f && f.size > 0)
  if (arquivos.length > FEEDBACK_MAX_FOTOS) fieldErrors.fotos = `Máximo de ${FEEDBACK_MAX_FOTOS} fotos.`
  else if (arquivos.some((f) => !f.type.startsWith('image/'))) fieldErrors.fotos = 'Envie apenas imagens.'

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Verifique os campos destacados.', fieldErrors }
  }

  try {
    const fotos: string[] = []
    const fotosPaths: string[] = []
    if (arquivos.length > 0) {
      const bucket = adminStorage.bucket()
      for (const file of arquivos) {
        const original = Buffer.from(await file.arrayBuffer())
        let buffer: Buffer = original
        let ext = file.name.split('.').pop() || 'jpg'
        let contentType = file.type || 'image/jpeg'
        try {
          buffer = await converterFotoParaWebp(original)
          ext = 'webp'
          contentType = 'image/webp'
        } catch {
          // formato não convertível: sobe o original
        }
        const path = `feedback/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const ref = bucket.file(path)
        await ref.save(buffer, { metadata: { contentType, cacheControl: FOTO_CACHE_CONTROL } })
        await ref.makePublic()
        fotos.push(ref.publicUrl())
        fotosPaths.push(path)
      }
    }

    const now = new Date().toISOString()
    await adminDb.collection('feedback').add({
      tipo: tipoRaw,
      titulo,
      descricao,
      tela: telaRaw || null,
      status: 'aberto' as FeedbackStatus,
      criadoPorUid: user.uid,
      criadoPorNome: user.name || user.email || 'Usuário',
      criadoPorEmail: user.email ?? null,
      criadoEm: now,
      atualizadoEm: now,
      atualizacoes: [],
      fotos,
      fotosPaths,
    })

    revalidatePath('/dashboard/feedback')
    return { success: 'Report enviado. Obrigado!' }
  } catch (err) {
    console.error('[criarFeedback]', err)
    return { error: 'Erro ao enviar o report. Tente novamente.' }
  }
}

export async function atualizarStatusFeedback(
  id: string,
  status: string,
): Promise<FeedbackResponse> {
  const erro = await checarDono()
  if (erro) return { error: erro }

  if (!id) return { error: 'Report inválido.' }
  if (!ehFeedbackStatus(status)) return { error: 'Status inválido.' }

  try {
    const ref = adminDb.collection('feedback').doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Report não encontrado.' }

    await ref.update({ status, atualizadoEm: new Date().toISOString() })
    revalidatePath('/dashboard/feedback')
    return { success: 'Status atualizado.' }
  } catch (err) {
    console.error('[atualizarStatusFeedback]', err)
    return { error: 'Erro ao atualizar o status.' }
  }
}

export async function adicionarAtualizacaoFeedback(
  id: string,
  texto: string,
): Promise<FeedbackResponse> {
  const erro = await checarDono()
  if (erro) return { error: erro }

  if (!id) return { error: 'Report inválido.' }
  const textoTrim = (texto || '').trim()
  if (!textoTrim) return { error: 'Escreva a atualização.' }
  if (textoTrim.length > 2000) return { error: 'Máximo de 2000 caracteres.' }

  try {
    const ref = adminDb.collection('feedback').doc(id)
    const doc = await ref.get()
    if (!doc.exists) return { error: 'Report não encontrado.' }

    const now = new Date().toISOString()
    const anteriores: FeedbackAtualizacao[] = Array.isArray(doc.data()?.atualizacoes)
      ? doc.data()!.atualizacoes
      : []
    const atualizacoes = [...anteriores, { texto: textoTrim, em: now }]

    await ref.update({ atualizacoes, atualizadoEm: now })
    revalidatePath('/dashboard/feedback')
    return { success: 'Atualização adicionada.' }
  } catch (err) {
    console.error('[adicionarAtualizacaoFeedback]', err)
    return { error: 'Erro ao adicionar a atualização.' }
  }
}

export async function deletarFeedback(id: string): Promise<FeedbackResponse> {
  const erro = await checarDono()
  if (erro) return { error: erro }

  if (!id) return { error: 'Report inválido.' }

  try {
    const ref = adminDb.collection('feedback').doc(id)
    const paths: unknown = (await ref.get()).data()?.fotosPaths
    await ref.delete()
    // Apaga as imagens anexadas (melhor esforço: falha aqui não desfaz a remoção).
    if (Array.isArray(paths)) {
      const bucket = adminStorage.bucket()
      await Promise.all(
        paths.filter((p): p is string => typeof p === 'string').map((p) => bucket.file(p).delete().catch(() => {})),
      )
    }
    revalidatePath('/dashboard/feedback')
    return { success: 'Report removido.' }
  } catch (err) {
    console.error('[deletarFeedback]', err)
    return { error: 'Erro ao remover o report.' }
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { getSessionUser, hasPageAccess, type SessionUser } from '@/utils/permissions'
import { isEstadoValido } from '@/utils/estadosBrasil'
import {
  REDE_CIDADE_MAX,
  REDE_NOME_MAX,
  REDE_OBS_MAX,
  REDE_TELEFONE_MAX,
  ehRedeRelacao,
} from '@/constants/rede-apoio'
import type {
  ContatoApoio,
  ContatoApoioFieldErrors,
  ContatoApoioInput,
  ContatoApoioResponse,
} from './types'

const COLECAO = 'rede_apoio'

function serialize(id: string, data: FirebaseFirestore.DocumentData): ContatoApoio {
  return {
    id,
    nome: data.nome ?? '',
    relacao: ehRedeRelacao(data.relacao) ? data.relacao : 'outro',
    cidade: data.cidade ?? '',
    uf: data.uf ?? '',
    telefone: data.telefone ?? '',
    podeReceber: data.podeReceber === true,
    podeVistoriar: data.podeVistoriar === true,
    observacoes: data.observacoes ?? '',
    criadoPorNome: data.criadoPorNome ?? 'Usuário',
    criadoEm: data.criadoEm ?? '',
    atualizadoEm: data.atualizadoEm ?? data.criadoEm ?? '',
  }
}

async function checarAcesso(): Promise<{ user: SessionUser } | { error: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!hasPageAccess(user, 'rede_apoio')) return { error: 'Acesso negado.' }
  return { user }
}

function validar(input: ContatoApoioInput):
  | { dados: Omit<ContatoApoio, 'id' | 'criadoPorNome' | 'criadoEm' | 'atualizadoEm'> }
  | { fieldErrors: ContatoApoioFieldErrors } {
  const nome = String(input.nome ?? '').trim()
  const cidade = String(input.cidade ?? '').trim()
  const uf = String(input.uf ?? '').trim().toUpperCase()
  const telefone = String(input.telefone ?? '').trim()
  const observacoes = String(input.observacoes ?? '').trim()
  const erros: ContatoApoioFieldErrors = {}

  if (!nome) erros.nome = 'Informe o nome.'
  else if (nome.length > REDE_NOME_MAX) erros.nome = `Máximo de ${REDE_NOME_MAX} caracteres.`
  if (!ehRedeRelacao(input.relacao)) erros.relacao = 'Escolha a relação.'
  if (!cidade) erros.cidade = 'Informe a cidade.'
  else if (cidade.length > REDE_CIDADE_MAX) erros.cidade = `Máximo de ${REDE_CIDADE_MAX} caracteres.`
  if (!isEstadoValido(uf)) erros.uf = 'Escolha o estado.'
  if (telefone.length > REDE_TELEFONE_MAX) erros.telefone = 'Telefone inválido.'
  if (observacoes.length > REDE_OBS_MAX) erros.observacoes = `Máximo de ${REDE_OBS_MAX} caracteres.`

  if (Object.keys(erros).length > 0) return { fieldErrors: erros }
  return {
    dados: {
      nome,
      relacao: input.relacao as ContatoApoio['relacao'],
      cidade,
      uf,
      telefone,
      podeReceber: input.podeReceber === true,
      podeVistoriar: input.podeVistoriar === true,
      observacoes,
    },
  }
}

export async function getContatosApoio(): Promise<ContatoApoio[]> {
  try {
    const acesso = await checarAcesso()
    if ('error' in acesso) return []
    const snap = await adminDb.collection(COLECAO).get()
    return snap.docs
      .map((doc) => serialize(doc.id, doc.data()))
      .sort(
        (a, b) =>
          a.uf.localeCompare(b.uf) ||
          a.cidade.localeCompare(b.cidade, 'pt-BR') ||
          a.nome.localeCompare(b.nome, 'pt-BR'),
      )
  } catch (err) {
    console.error('[getContatosApoio]', err)
    return []
  }
}

export async function salvarContatoApoio(
  id: string | null,
  input: ContatoApoioInput,
): Promise<ContatoApoioResponse> {
  try {
    const acesso = await checarAcesso()
    if ('error' in acesso) return { error: acesso.error }
    const v = validar(input)
    if ('fieldErrors' in v) return { error: 'Confira os campos destacados.', fieldErrors: v.fieldErrors }

    const agora = new Date().toISOString()
    if (id) {
      const ref = adminDb.collection(COLECAO).doc(id)
      const atual = await ref.get()
      if (!atual.exists) return { error: 'Contato não encontrado.' }
      await ref.update({ ...v.dados, atualizadoEm: agora })
      revalidatePath('/dashboard/rede-apoio')
      return { success: 'Contato atualizado.', contato: serialize(id, { ...atual.data(), ...v.dados, atualizadoEm: agora }) }
    }

    const doc = {
      ...v.dados,
      criadoPorUid: acesso.user.uid,
      criadoPorNome: acesso.user.name || acesso.user.email || 'Usuário',
      criadoEm: agora,
      atualizadoEm: agora,
    }
    const ref = await adminDb.collection(COLECAO).add(doc)
    revalidatePath('/dashboard/rede-apoio')
    return { success: 'Contato cadastrado.', contato: serialize(ref.id, doc) }
  } catch (err) {
    console.error('[salvarContatoApoio]', err)
    return { error: 'Erro ao salvar o contato.' }
  }
}

export async function excluirContatoApoio(id: string): Promise<{ success: string } | { error: string }> {
  try {
    const acesso = await checarAcesso()
    if ('error' in acesso) return { error: acesso.error }
    if (!id) return { error: 'Contato inválido.' }
    await adminDb.collection(COLECAO).doc(id).delete()
    revalidatePath('/dashboard/rede-apoio')
    return { success: 'Contato excluído.' }
  } catch (err) {
    console.error('[excluirContatoApoio]', err)
    return { error: 'Erro ao excluir o contato.' }
  }
}

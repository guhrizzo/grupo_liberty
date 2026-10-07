'use server'

import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { getSessionUser, hasPageAccess, type SessionUser } from '@/utils/permissions'
import { COLECAO_INTERESSES as COLECAO } from '@/utils/interesses/casar'
import { CAMBIO_VALUES, COMBUSTIVEL_VALUES } from '@/utils/veiculos/opcoes'
import { getVehicles } from '../veiculos/actions'
import { estoqueEstadoDe } from '../veiculos/public'
import {
  INTERESSE_OBS_MAX,
  INTERESSE_STATUS,
  INTERESSE_TEXTO_MAX,
  type Interesse,
  type InteresseInput,
  type InteresseStatus,
  type VeiculoEstoqueResumo,
} from './types'

type Resultado = { success?: string; error?: string }

async function checarAcesso(): Promise<{ user: SessionUser } | { error: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!hasPageAccess(user, 'interesses')) return { error: 'Acesso negado.' }
  return { user }
}

function ehStatus(v: unknown): v is InteresseStatus {
  return typeof v === 'string' && (INTERESSE_STATUS as readonly string[]).includes(v)
}

function serialize(id: string, d: FirebaseFirestore.DocumentData): Interesse {
  return {
    id,
    clienteNome: d.clienteNome ?? '',
    clienteTelefone: d.clienteTelefone ?? '',
    marca: d.marca ?? '',
    modelo: d.modelo ?? '',
    anoMin: d.anoMin ?? null,
    anoMax: d.anoMax ?? null,
    precoMax: d.precoMax ?? null,
    cambio: d.cambio ?? '',
    combustivel: d.combustivel ?? '',
    cor: d.cor ?? '',
    observacao: d.observacao ?? '',
    status: ehStatus(d.status) ? d.status : 'ativo',
    criadoPorNome: d.criadoPorNome ?? 'Usuário',
    criadoEm: d.criadoEm ?? '',
  }
}

function numeroOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function validar(input: InteresseInput): { error: string } | { dados: InteresseInput } {
  const texto = (v: unknown) => String(v ?? '').trim()
  const clienteNome = texto(input.clienteNome)
  if (!clienteNome) return { error: 'Informe o nome do cliente.' }
  const clienteTelefone = texto(input.clienteTelefone)
  if (clienteTelefone.replace(/\D/g, '').length < 10) return { error: 'Informe um telefone válido com DDD.' }

  const marca = texto(input.marca)
  const modelo = texto(input.modelo)
  const cor = texto(input.cor)
  const observacao = texto(input.observacao)
  if ([clienteNome, marca, modelo, cor].some((t) => t.length > INTERESSE_TEXTO_MAX)) {
    return { error: `Os textos aceitam no máximo ${INTERESSE_TEXTO_MAX} caracteres.` }
  }
  if (observacao.length > INTERESSE_OBS_MAX) return { error: `Observação: máximo de ${INTERESSE_OBS_MAX} caracteres.` }

  const cambio = texto(input.cambio)
  if (cambio && !CAMBIO_VALUES.includes(cambio)) return { error: 'Câmbio inválido.' }
  const combustivel = texto(input.combustivel)
  if (combustivel && !COMBUSTIVEL_VALUES.includes(combustivel)) return { error: 'Combustível inválido.' }

  const anoMin = numeroOuNull(input.anoMin)
  const anoMax = numeroOuNull(input.anoMax)
  if (anoMin && anoMax && anoMin > anoMax) return { error: 'O ano mínimo não pode ser maior que o máximo.' }
  if (!marca && !modelo && !observacao) {
    return { error: 'Diga o que o cliente procura: marca, modelo ou uma observação.' }
  }
  if (!ehStatus(input.status)) return { error: 'Status inválido.' }

  return {
    dados: {
      clienteNome,
      clienteTelefone,
      marca,
      modelo,
      anoMin,
      anoMax,
      precoMax: numeroOuNull(input.precoMax),
      cambio,
      combustivel,
      cor,
      observacao,
      status: input.status,
    },
  }
}

export async function listarInteresses(): Promise<Interesse[]> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return []
  const snap = await adminDb.collection(COLECAO).get()
  return snap.docs.map((d) => serialize(d.id, d.data())).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
}

/** Estoque à venda hoje (exclui vendidos e privados), para mostrar o que casa com cada interesse. */
export async function listarEstoqueParaInteresses(): Promise<VeiculoEstoqueResumo[]> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return []
  const veiculos = await getVehicles()
  return veiculos
    .filter((v) => estoqueEstadoDe(v) === 'disponivel')
    .map((v) => ({
      id: v.id,
      marca: v.marca,
      modelo: v.modelo,
      ano: v.ano,
      preco: v.precoComDesconto ?? v.preco,
      cambio: v.cambio,
      combustivel: v.combustivel,
      cor: v.cor,
      placa: v.placa,
    }))
}

export async function criarInteresse(input: InteresseInput): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  const v = validar(input)
  if ('error' in v) return { error: v.error }
  await adminDb.collection(COLECAO).add({
    ...v.dados,
    criadoPorUid: acesso.user.uid,
    criadoPorNome: acesso.user.name || acesso.user.email || 'Usuário',
    criadoEm: new Date().toISOString(),
  })
  revalidatePath('/dashboard/interesses')
  return { success: 'Interesse registrado.' }
}

export async function atualizarInteresse(id: string, input: InteresseInput): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  const v = validar(input)
  if ('error' in v) return { error: v.error }
  const ref = adminDb.collection(COLECAO).doc(id)
  if (!(await ref.get()).exists) return { error: 'Interesse não encontrado.' }
  await ref.update({ ...v.dados, atualizadoEm: new Date().toISOString() })
  revalidatePath('/dashboard/interesses')
  return { success: 'Interesse atualizado.' }
}

export async function definirStatusInteresse(id: string, status: string): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  if (!ehStatus(status)) return { error: 'Status inválido.' }
  const ref = adminDb.collection(COLECAO).doc(id)
  if (!(await ref.get()).exists) return { error: 'Interesse não encontrado.' }
  await ref.update({ status, atualizadoEm: new Date().toISOString() })
  revalidatePath('/dashboard/interesses')
  return { success: 'Status atualizado.' }
}

export async function excluirInteresse(id: string): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  const ref = adminDb.collection(COLECAO).doc(id)
  if (!(await ref.get()).exists) return { error: 'Interesse não encontrado.' }
  await ref.delete()
  revalidatePath('/dashboard/interesses')
  return { success: 'Interesse excluído.' }
}

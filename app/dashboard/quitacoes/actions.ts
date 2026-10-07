'use server'

import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { getSessionUser, hasPageAccess, type SessionUser } from '@/utils/permissions'
import { getVehicles } from '../veiculos/actions'
import {
  QUITACAO_OBS_MAX,
  type Quitacao,
  type QuitacaoInput,
  type UltimaQuitacao,
  type VeiculoQuitacaoOpcao,
} from './types'

const COLECAO = 'quitacoes'
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

type Resultado = { success?: string; error?: string }

// Quitações seguem o acesso à aba Veículos (regra única de permissões).
async function checarAcesso(): Promise<{ user: SessionUser } | { error: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!hasPageAccess(user, 'veiculos')) return { error: 'Acesso negado.' }
  return { user }
}

function serialize(id: string, d: FirebaseFirestore.DocumentData): Quitacao {
  return {
    id,
    veiculoId: d.veiculoId ?? '',
    valor: Number(d.valor) || 0,
    data: d.data ?? '',
    observacao: d.observacao ?? '',
    criadoPorNome: d.criadoPorNome ?? 'Usuário',
    criadoEm: d.criadoEm ?? '',
  }
}

/** Mais recente primeiro: pela data da negociação e, em empate, pelo registro. */
function maisRecente(a: Quitacao, b: Quitacao): number {
  return b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)
}

function validar(input: QuitacaoInput): { error: string } | { valor: number; data: string; observacao: string } {
  const valor = Number(input.valor)
  if (!Number.isFinite(valor) || valor <= 0) return { error: 'Informe o valor da quitação.' }
  const data = String(input.data ?? '')
  if (!DATA_RE.test(data) || Number.isNaN(new Date(`${data}T00:00:00`).getTime())) {
    return { error: 'Informe a data da negociação.' }
  }
  const observacao = String(input.observacao ?? '').trim()
  if (observacao.length > QUITACAO_OBS_MAX) return { error: `Observação: máximo de ${QUITACAO_OBS_MAX} caracteres.` }
  return { valor: Math.round(valor * 100) / 100, data, observacao }
}

export async function listarQuitacoes(): Promise<Quitacao[]> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return []
  const snap = await adminDb.collection(COLECAO).get()
  return snap.docs.map((d) => serialize(d.id, d.data())).sort(maisRecente)
}

export async function listarVeiculosParaQuitacao(): Promise<VeiculoQuitacaoOpcao[]> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return []
  const veiculos = await getVehicles()
  return veiculos.map((v) => ({ id: v.id, marca: v.marca, modelo: v.modelo, ano: v.ano, placa: v.placa }))
}

/** Última quitação (a mais recente) de cada veículo — usada na aba Veículos. */
export async function getUltimasQuitacoes(): Promise<Record<string, UltimaQuitacao>> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return {}
  const snap = await adminDb.collection(COLECAO).get()
  const todas = snap.docs.map((d) => serialize(d.id, d.data())).sort(maisRecente)
  const mapa: Record<string, UltimaQuitacao> = {}
  for (const q of todas) {
    if (q.veiculoId && !mapa[q.veiculoId]) mapa[q.veiculoId] = { valor: q.valor, data: q.data }
  }
  return mapa
}

export async function criarQuitacao(input: QuitacaoInput): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  const dados = validar(input)
  if ('error' in dados) return { error: dados.error }

  const veiculoId = String(input.veiculoId ?? '')
  if (!veiculoId) return { error: 'Escolha o veículo.' }
  const veiculo = await adminDb.collection('veiculos').doc(veiculoId).get()
  if (!veiculo.exists) return { error: 'Veículo não encontrado.' }

  await adminDb.collection(COLECAO).add({
    veiculoId,
    ...dados,
    criadoPorUid: acesso.user.uid,
    criadoPorNome: acesso.user.name || acesso.user.email || 'Usuário',
    criadoEm: new Date().toISOString(),
  })
  revalidatePath('/dashboard/quitacoes')
  revalidatePath('/dashboard/veiculos')
  return { success: 'Quitação registrada.' }
}

export async function atualizarQuitacao(id: string, input: QuitacaoInput): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  const dados = validar(input)
  if ('error' in dados) return { error: dados.error }
  const ref = adminDb.collection(COLECAO).doc(id)
  if (!(await ref.get()).exists) return { error: 'Quitação não encontrada.' }
  await ref.update({ ...dados, atualizadoEm: new Date().toISOString() })
  revalidatePath('/dashboard/quitacoes')
  revalidatePath('/dashboard/veiculos')
  return { success: 'Quitação atualizada.' }
}

export async function excluirQuitacao(id: string): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }
  const ref = adminDb.collection(COLECAO).doc(id)
  if (!(await ref.get()).exists) return { error: 'Quitação não encontrada.' }
  await ref.delete()
  revalidatePath('/dashboard/quitacoes')
  revalidatePath('/dashboard/veiculos')
  return { success: 'Quitação excluída.' }
}

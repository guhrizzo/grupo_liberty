'use server'

import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { getSessionUser, hasPageAccess, type SessionUser } from '@/utils/permissions'
import { getVehicles } from '../veiculos/actions'
import {
  SEGURO_OBS_MAX,
  SEGURO_STATUS,
  type ResumoSeguro,
  type Seguro,
  type SeguroInput,
  type SeguroStatus,
  type VeiculoSeguro,
} from './types'

const COLECAO = 'seguros'

type Resultado = { success?: string; error?: string }

// Seguro segue o acesso à aba Veículos (regra única de permissões).
async function checarAcesso(): Promise<{ user: SessionUser } | { error: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!hasPageAccess(user, 'veiculos')) return { error: 'Acesso negado.' }
  return { user }
}

function statusValido(v: unknown): v is SeguroStatus {
  return SEGURO_STATUS.some((s) => s.value === v)
}

function serialize(id: string, d: FirebaseFirestore.DocumentData): Seguro {
  return {
    veiculoId: id,
    status: statusValido(d.status) ? d.status : 'pendente',
    valorPrevisto: Number(d.valorPrevisto) || 0,
    valorCancelado: Number(d.valorCancelado) || 0,
    observacao: d.observacao ?? '',
  }
}

/** Todos os veículos com o controle de seguro (veículo sem registro fica "pendente"). */
export async function listarSeguros(): Promise<VeiculoSeguro[]> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return []
  const [veiculos, snap] = await Promise.all([getVehicles(), adminDb.collection(COLECAO).get()])
  const porVeiculo = new Map(snap.docs.map((d) => [d.id, serialize(d.id, d.data())]))
  return veiculos.map((v) => ({
    veiculoId: v.id,
    status: 'pendente' as SeguroStatus,
    valorPrevisto: 0,
    valorCancelado: 0,
    observacao: '',
    ...porVeiculo.get(v.id),
    marca: v.marca,
    modelo: v.modelo,
    ano: v.ano,
    placa: v.placa,
    foto: v.fotos?.[0] ?? null,
  }))
}

/** Resumo do seguro de cada veículo com registro — usado na aba Veículos. */
export async function getResumosSeguro(): Promise<Record<string, ResumoSeguro>> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return {}
  const snap = await adminDb.collection(COLECAO).get()
  const mapa: Record<string, ResumoSeguro> = {}
  for (const d of snap.docs) {
    const s = serialize(d.id, d.data())
    mapa[d.id] = { status: s.status, valorPrevisto: s.valorPrevisto, valorCancelado: s.valorCancelado }
  }
  return mapa
}

export async function salvarSeguro(input: SeguroInput): Promise<Resultado> {
  const acesso = await checarAcesso()
  if ('error' in acesso) return { error: acesso.error }

  const veiculoId = String(input.veiculoId ?? '')
  if (!veiculoId) return { error: 'Escolha o veículo.' }
  if (!statusValido(input.status)) return { error: 'Status inválido.' }
  const valorPrevisto = Number(input.valorPrevisto) || 0
  const valorCancelado = Number(input.valorCancelado) || 0
  if (valorPrevisto < 0 || valorCancelado < 0) return { error: 'Os valores não podem ser negativos.' }
  const observacao = String(input.observacao ?? '').trim()
  if (observacao.length > SEGURO_OBS_MAX) return { error: `Observação: máximo de ${SEGURO_OBS_MAX} caracteres.` }
  if (!(await adminDb.collection('veiculos').doc(veiculoId).get()).exists) return { error: 'Veículo não encontrado.' }

  const semValores = input.status === 'inexistente'
  await adminDb
    .collection(COLECAO)
    .doc(veiculoId)
    .set({
      status: input.status,
      valorPrevisto: semValores ? 0 : Math.round(valorPrevisto * 100) / 100,
      // Só há valor cancelado quando o seguro foi de fato cancelado.
      valorCancelado: input.status === 'cancelado' ? Math.round(valorCancelado * 100) / 100 : 0,
      observacao,
      atualizadoEm: new Date().toISOString(),
      atualizadoPorUid: acesso.user.uid,
      atualizadoPorNome: acesso.user.name || acesso.user.email || 'Usuário',
    })
  revalidatePath('/dashboard/seguro')
  revalidatePath('/dashboard/veiculos')
  return { success: 'Seguro atualizado.' }
}

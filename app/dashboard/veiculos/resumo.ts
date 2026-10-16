'use server'

import { adminDb } from '@/utils/firebase/admin'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { isManutencaoBaixada, valorManutencao } from '../manutencao/types'
import type { BaixaManutencao, ManutencaoStatus } from '../manutencao/types'
import type { ResumoVeiculo } from './resumo-types'

/**
 * Resume, por veículo, o que está nas abas Propostas e Manutenção. Cada parte
 * só é devolvida a quem tem acesso à aba de origem.
 */
export async function getResumoVeiculos(): Promise<Record<string, ResumoVeiculo>> {
  const user = await getSessionUser()
  if (!user) return {}
  const mapa: Record<string, ResumoVeiculo> = {}
  const doVeiculo = (id: string) => (mapa[id] ??= {})

  if (hasPageAccess(user, 'propostas')) {
    try {
      // Mais recente primeiro: a primeira de cada veículo é a última proposta.
      const snap = await adminDb.collection('propostas').orderBy('created_at', 'desc').get()
      for (const doc of snap.docs) {
        const p = doc.data()
        const id = typeof p.veiculo_id === 'string' ? p.veiculo_id : ''
        if (!id || doVeiculo(id).proposta) continue
        doVeiculo(id).proposta = {
          status: p.status === 'aceito' || p.status === 'recusado' ? p.status : 'pendente',
          data: String(p.cliente_data || p.created_at || ''),
          telefone: typeof p.telefone === 'string' && p.telefone ? p.telefone : null,
        }
      }
    } catch (err) {
      console.error('Erro ao resumir propostas dos veículos:', err)
    }
  }

  if (hasPageAccess(user, 'manutencao')) {
    try {
      const snap = await adminDb.collection('manutencoes').get()
      for (const doc of snap.docs) {
        const m = doc.data()
        const id = typeof m.veiculoId === 'string' ? m.veiculoId : ''
        const status = (m.status as ManutencaoStatus) || 'agendada'
        if (!id || status === 'cancelada') continue
        const base = {
          baixa: (m.baixa as BaixaManutencao) ?? null,
          custo: typeof m.custo === 'number' ? m.custo : Number(m.custo) || 0,
          status,
        }
        const r = doVeiculo(id)
        const atual = (r.manutencao ??= { quantidade: 0, total: 0 })
        atual.quantidade += 1
        if (isManutencaoBaixada(base)) atual.total += valorManutencao(base)
      }
    } catch (err) {
      console.error('Erro ao resumir manutenções dos veículos:', err)
    }
  }

  return mapa
}

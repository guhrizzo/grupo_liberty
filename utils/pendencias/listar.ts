import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import { temAcessoPagina, type UserPermissions } from '@/constants/permissoes'
import { hojeNoFuso } from '@/app/dashboard/financeiro/periodo'
import type { Pendencia } from './types'

/**
 * Pendências do usuário, calculadas na hora a partir dos registros de origem:
 * somem sozinhas quando o registro é concluído (sem cron, sem cópia para
 * manter em sincronia). Hoje só a manutenção (agendada ou em execução) —
 * quem tem acesso à aba Manutenção recebe. Ordem: atrasadas primeiro, depois
 * por data.
 */
export async function getPendencias(
  role: string | null | undefined,
  permissions: UserPermissions | null | undefined,
): Promise<Pendencia[]> {
  const hoje = hojeNoFuso()
  const lista: Pendencia[] = []

  if (temAcessoPagina(role, permissions, 'manutencao')) {
    try {
      const snap = await adminDb
        .collection('manutencoes')
        .where('status', 'in', ['agendada', 'em_execucao'])
        .get()
      for (const doc of snap.docs) {
        const d = doc.data()
        const data = typeof d.dataAgendada === 'string' ? d.dataAgendada : ''
        const veiculo = typeof d.veiculoLabel === 'string' ? d.veiculoLabel : ''
        const partes = [veiculo, d.oficina ? `Oficina: ${d.oficina}` : '', d.responsavel ? `Resp.: ${d.responsavel}` : '']
        lista.push({
          id: `manutencao:${doc.id}`,
          origem: 'manutencao',
          titulo: `${d.status === 'em_execucao' ? 'Concluir' : 'Executar'} manutenção: ${d.tipo || 'sem tipo'}`,
          detalhe: partes.filter(Boolean).join(' · '),
          data,
          atrasada: !!data && data < hoje,
          venceHoje: data === hoje,
          href: '/dashboard/manutencao',
        })
      }
    } catch (e) {
      console.error('[pendencias] Erro ao buscar manutenções pendentes:', e)
    }
  }

  return lista.sort((a, b) => {
    if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1
    return (a.data || '9999').localeCompare(b.data || '9999')
  })
}

import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import { ehAdmSupremo, temAcessoPagina } from '@/constants/permissoes'
import { hojeNoFuso } from '@/app/dashboard/financeiro/periodo'
import type { SessionUser } from '@/utils/permissions'
import type { Pendencia } from './types'

type UsuarioPendencias = Pick<SessionUser, 'uid' | 'email' | 'name' | 'role' | 'permissions'>

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Pendências do próprio usuário, calculadas na hora a partir dos registros de
 * origem: somem sozinhas quando o registro é concluído (sem cron, sem cópia
 * para manter em sincronia).
 *
 * - Tarefas de Demandas: as que têm o usuário como responsável.
 * - Manutenção (agendada ou em execução): as que têm o usuário no campo
 *   "responsável" (texto livre, comparado sem acento/caixa com o nome do
 *   usuário) e só se ele tem acesso à aba Manutenção.
 *
 * O ADM supremo vê as de todos. Ordem: atrasadas primeiro, depois por data.
 */
export async function getPendencias(user: UsuarioPendencias): Promise<Pendencia[]> {
  const hoje = hojeNoFuso()
  const todas = ehAdmSupremo(user.email)
  const lista: Pendencia[] = []

  // ── Tarefas (Demandas) ──
  try {
    // Só igualdade na query para não exigir índice composto; o resto em memória.
    const snap = todas
      ? await adminDb.collection('tarefas').get()
      : await adminDb.collection('tarefas').where('responsavelUid', '==', user.uid).get()
    for (const doc of snap.docs) {
      const t = doc.data()
      if (t.status !== 'pendente' || t.fechada === true) continue
      const prazo = typeof t.prazo === 'string' ? t.prazo : ''
      const nome = typeof t.responsavelNome === 'string' ? t.responsavelNome : ''
      lista.push({
        id: `tarefa:${doc.id}`,
        origem: 'tarefa',
        titulo: typeof t.titulo === 'string' && t.titulo ? t.titulo : 'Tarefa sem título',
        detalhe: todas && nome ? `Responsável: ${nome}` : '',
        data: prazo,
        atrasada: !!prazo && prazo < hoje,
        venceHoje: prazo === hoje,
        href: `/dashboard/demandas?destaque=${doc.id}`,
        responsavel: todas ? nome : undefined,
      })
    }
  } catch (e) {
    console.error('[pendencias] Erro ao buscar tarefas pendentes:', e)
  }

  // ── Manutenção ──
  if (temAcessoPagina(user.role, user.permissions, 'manutencao')) {
    const meuNome = normalizar(user.name || user.email?.split('@')[0] || '')
    try {
      const snap = await adminDb
        .collection('manutencoes')
        .where('status', 'in', ['agendada', 'em_execucao'])
        .get()
      for (const doc of snap.docs) {
        const d = doc.data()
        const resp = typeof d.responsavel === 'string' ? d.responsavel : ''
        if (!todas) {
          const r = normalizar(resp)
          if (!r || !meuNome || !(r.includes(meuNome) || meuNome.includes(r))) continue
        }
        const data = typeof d.dataAgendada === 'string' ? d.dataAgendada : ''
        const veiculo = typeof d.veiculoLabel === 'string' ? d.veiculoLabel : ''
        const partes = [veiculo, d.oficina ? `Oficina: ${d.oficina}` : '', resp ? `Resp.: ${resp}` : '']
        lista.push({
          id: `manutencao:${doc.id}`,
          origem: 'manutencao',
          titulo: `${d.status === 'em_execucao' ? 'Concluir' : 'Executar'} manutenção: ${d.tipo || 'sem tipo'}`,
          detalhe: partes.filter(Boolean).join(' · '),
          data,
          atrasada: !!data && data < hoje,
          venceHoje: data === hoje,
          href: `/dashboard/manutencao?destaque=${doc.id}`,
          responsavel: todas ? resp : undefined,
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

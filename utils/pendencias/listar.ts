import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import { ehAdmSupremo, temAcessoPagina } from '@/constants/permissoes'
import { hojeNoFuso } from '@/app/dashboard/financeiro/periodo'
import type { SessionUser } from '@/utils/permissions'
import type { Pendencia } from './types'
import { CHECKLIST_ITENS, CHECKLIST_MESES_BANCO, somarMeses } from '@/app/dashboard/quitacoes/types'
import {
  COL_TAREFAS_SEMANAIS,
  COL_TAREFAS_SEMANAIS_CONCLUSOES,
  ehDiaSemana,
  idConclusao,
  ocorrenciaAtual,
  rotuloDia,
} from './semanais'

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

  // ── Tarefas semanais (rotina) ──
  // Pendente = a ocorrência mais recente do dia da semana ainda sem conclusão.
  try {
    const snap = todas
      ? await adminDb.collection(COL_TAREFAS_SEMANAIS).get()
      : await adminDb.collection(COL_TAREFAS_SEMANAIS).where('responsavelUid', '==', user.uid).get()
    const regras = snap.docs
      .filter((doc) => doc.data().ativa !== false)
      .map((doc) => {
        const d = doc.data()
        const dia = ehDiaSemana(d.diaSemana) ? d.diaSemana : 1
        const desde = typeof d.desde === 'string' ? d.desde : hoje
        const oc = ocorrenciaAtual(hoje, dia)
        return { doc, d, dia, oc, valeu: oc >= desde }
      })
      .filter((r) => r.valeu)
    const datas = [...new Set(regras.map((r) => r.oc))]
    const feitas = new Set<string>()
    if (datas.length > 0) {
      const cs = await adminDb.collection(COL_TAREFAS_SEMANAIS_CONCLUSOES).where('data', 'in', datas).get()
      cs.forEach((c) => feitas.add(c.id))
    }
    for (const r of regras) {
      if (feitas.has(idConclusao(r.doc.id, r.oc))) continue
      const nome = typeof r.d.responsavelNome === 'string' ? r.d.responsavelNome : ''
      lista.push({
        id: `semanal:${r.doc.id}`,
        origem: 'semanal',
        titulo: typeof r.d.titulo === 'string' && r.d.titulo ? r.d.titulo : 'Tarefa semanal',
        detalhe: [rotuloDia(r.dia), todas && nome ? `Responsável: ${nome}` : ''].filter(Boolean).join(' · '),
        data: r.oc,
        atrasada: r.oc < hoje,
        venceHoje: r.oc === hoje,
        href: '/dashboard/demandas?aba=semanais',
        responsavel: todas ? nome : undefined,
      })
    }
  } catch (e) {
    console.error('[pendencias] Erro ao buscar tarefas semanais:', e)
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

  // ── Checklist pós-compra (Quitações) ──
  // Só veículos com data da compra na ficha e ainda não quitados. Os 3 itens da
  // pós-compra aparecem desde a compra; "negociar com o banco" entra quando
  // passam 6 meses da compra.
  if (temAcessoPagina(user.role, user.permissions, 'veiculos')) {
    try {
      const snap = await adminDb.collection('quitacao_fichas').get()
      const fichas = snap.docs.filter((doc) => {
        const d = doc.data()
        return d.quitado !== true && typeof d.dataCompra === 'string' && d.dataCompra !== ''
      })
      await Promise.all(
        fichas.map(async (doc) => {
          const d = doc.data()
          const feito = (d.checklist ?? {}) as Record<string, unknown>
          const dataBanco = somarMeses(d.dataCompra as string, CHECKLIST_MESES_BANCO)
          const faltando = CHECKLIST_ITENS.filter((i) => {
            if (feito[i.id]) return false
            if (i.grupo === 'pos-compra') return true
            return i.id === 'banco' && dataBanco <= hoje
          })
          if (faltando.length === 0) return
          const [proprio, terceiro] = await Promise.all([
            adminDb.collection('veiculos').doc(doc.id).get(),
            adminDb.collection('quitacao_terceiros').doc(doc.id).get(),
          ])
          const v = (proprio.exists ? proprio.data() : terceiro.data()) ?? {}
          const rotulo = [v.marca, v.modelo, v.ano, v.placa].filter(Boolean).join(' ') || 'Veículo'
          const bancoPendente = faltando.some((i) => i.id === 'banco')
          lista.push({
            id: `checklist:${doc.id}`,
            origem: 'checklist',
            titulo: `Checklist pós-compra: ${rotulo}`,
            detalhe: `Falta: ${faltando.map((i) => i.rotulo.replace(/ \(.*\)$/, '')).join(', ')}`,
            data: bancoPendente ? dataBanco : '',
            atrasada: bancoPendente && dataBanco < hoje,
            venceHoje: bancoPendente && dataBanco === hoje,
            href: `/dashboard/quitacoes?veiculo=${doc.id}`,
          })
        }),
      )
    } catch (e) {
      console.error('[pendencias] Erro ao buscar checklist pós-compra:', e)
    }
  }

  return lista.sort((a, b) => {
    if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1
    return (a.data || '9999').localeCompare(b.data || '9999')
  })
}

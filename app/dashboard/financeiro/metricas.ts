'use server'

import { adminDb } from '@/utils/firebase/admin'
import { getSessionUser, isAdmSupremo } from '@/utils/permissions'
import { isManutencaoBaixada, valorManutencao } from '@/app/dashboard/manutencao/types'
import { deslocarMes, intervaloDoMes, mesAtual } from './periodo'
import {
  COR_HEX,
  ehPeriodoMetricas,
  type CoresMetricas,
  METRICAS_PERIODO_PADRAO,
  type MetricasFinanceiro,
  type MetricasMes,
} from './metricas-types'

/** Mês (`YYYY-MM`) de uma data `YYYY-MM-DD` ou de um instante ISO (fuso SP). */
function mesDe(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor.slice(0, 7)
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : mesAtual(d)
}

/**
 * Faturamento, custos e lucro (lançamentos concluídos — mesma regra dos cards
 * de resumo), veículos adquiridos e manutenções pagas, mês a mês, nos últimos
 * `periodo` meses (incluindo o corrente). Só ADM supremo.
 */
export async function getMetricas(periodoBruto: number): Promise<MetricasFinanceiro | null> {
  const user = await getSessionUser()
  if (!user || !isAdmSupremo(user)) return null
  const periodo = ehPeriodoMetricas(periodoBruto) ? periodoBruto : METRICAS_PERIODO_PADRAO

  const atual = mesAtual()
  const meses = Array.from({ length: periodo }, (_, i) => deslocarMes(atual, i - (periodo - 1)))
  const porMes = new Map<string, MetricasMes>(
    meses.map((mes) => [
      mes,
      { mes, faturamento: 0, custos: 0, lucro: 0, veiculos: 0, veiculosValor: 0, manutencoes: 0, manutencoesValor: 0 },
    ]),
  )
  const inicio = intervaloDoMes(meses[0]).inicio
  const fim = intervaloDoMes(atual).fim

  try {
    const [transacoes, veiculos, manutencoes] = await Promise.all([
      adminDb.collection('transacoes').where('data', '>=', inicio).where('data', '<=', fim).get(),
      // Veículos e manutenções são poucos: filtra em memória (a data de
      // aquisição pode faltar e o mês da manutenção depende da baixa).
      adminDb.collection('veiculos').get(),
      adminDb.collection('manutencoes').get(),
    ])

    for (const doc of transacoes.docs) {
      const t = doc.data()
      if (t.status !== 'concluido') continue
      const m = porMes.get(mesDe(t.data) ?? '')
      if (!m) continue
      const valor = Number(t.valor) || 0
      if (t.tipo === 'receita') m.faturamento += valor
      else if (t.tipo === 'despesa') m.custos += valor
    }

    for (const doc of veiculos.docs) {
      const v = doc.data()
      if (v.terceiro === true) continue
      const m = porMes.get(mesDe(v.dataAquisicao) ?? mesDe(v.created_at) ?? '')
      if (!m) continue
      m.veiculos += 1
      m.veiculosValor += Number(v.precoAquisicao) || 0
    }

    for (const doc of manutencoes.docs) {
      const d = doc.data()
      const manut = { baixa: d.baixa ?? null, custo: Number(d.custo) || 0, status: d.status }
      if (!isManutencaoBaixada(manut)) continue
      const quando = d.baixa?.baixadoEm ?? d.dataConclusao ?? d.dataAgendada
      const m = porMes.get(mesDe(quando) ?? '')
      if (!m) continue
      m.manutencoes += 1
      m.manutencoesValor += valorManutencao(manut)
    }

    const lista = meses.map((mes) => {
      const m = porMes.get(mes)!
      m.lucro = m.faturamento - m.custos
      return m
    })
    return { periodo, meses: lista }
  } catch (err) {
    console.error('[getMetricas]', err)
    return { periodo, meses: [...porMes.values()] }
  }
}

// ─── Cores dos gráficos (por usuário, em profiles/{uid}.coresMetricas) ─────

function limparCores(bruto: unknown): CoresMetricas {
  const c = (bruto ?? {}) as Record<string, unknown>
  const out: CoresMetricas = {}
  for (const k of ['faturamento', 'custos', 'negativo'] as const) {
    if (typeof c[k] === 'string' && COR_HEX.test(c[k] as string)) out[k] = (c[k] as string).toLowerCase()
  }
  return out
}

export async function getCoresMetricas(): Promise<CoresMetricas> {
  const user = await getSessionUser()
  if (!user || !isAdmSupremo(user)) return {}
  try {
    const doc = await adminDb.collection('profiles').doc(user.uid).get()
    return limparCores(doc.data()?.coresMetricas)
  } catch (err) {
    console.error('[getCoresMetricas]', err)
    return {}
  }
}

/** Salva as cores do próprio ADM supremo; `{}` volta ao padrão. */
export async function salvarCoresMetricas(cores: CoresMetricas): Promise<{ success?: string; error?: string }> {
  const user = await getSessionUser()
  if (!user || !isAdmSupremo(user)) return { error: 'Acesso negado.' }
  try {
    await adminDb.collection('profiles').doc(user.uid).set({ coresMetricas: limparCores(cores) }, { merge: true })
    return { success: Object.keys(limparCores(cores)).length ? 'Cores salvas.' : 'Cores padrão restauradas.' }
  } catch (err) {
    console.error('[salvarCoresMetricas]', err)
    return { error: 'Erro ao salvar as cores.' }
  }
}

// Métricas diárias dos vendedores: cada um preenche os números do próprio dia.
// Fonte única dos campos, usada pelo formulário, pela validação e pelos totais.

export const METRICA_CAMPOS = [
  { key: 'leads', label: 'Leads' },
  { key: 'atendidos', label: 'Atendidos' },
  { key: 'retornaram', label: 'Retornaram' },
  { key: 'propostas', label: 'Propostas' },
  { key: 'concluidos', label: 'Concluídos' },
  { key: 'followUps', label: 'Follow up' },
] as const

export type MetricaCampo = (typeof METRICA_CAMPOS)[number]['key']
export type MetricaValores = Record<MetricaCampo, number>

export const METRICA_VALOR_MAX = 9999

export function metricaVazia(): MetricaValores {
  return { leads: 0, atendidos: 0, retornaram: 0, propostas: 0, concluidos: 0, followUps: 0 }
}

/** Soma os campos de vários dias. */
export function somarMetricas(lista: MetricaValores[]): MetricaValores {
  const total = metricaVazia()
  for (const m of lista) for (const { key } of METRICA_CAMPOS) total[key] += m[key] ?? 0
  return total
}

/** Média por dia preenchido (1 casa decimal). */
export function mediaMetricas(total: MetricaValores, dias: number): MetricaValores {
  const media = metricaVazia()
  if (dias <= 0) return media
  for (const { key } of METRICA_CAMPOS) media[key] = Math.round((total[key] / dias) * 10) / 10
  return media
}

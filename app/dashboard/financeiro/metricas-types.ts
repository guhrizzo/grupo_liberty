// Tipos das métricas do Financeiro. Ficam fora de metricas.ts porque arquivos
// 'use server' só podem exportar funções async.

export const METRICAS_PERIODOS = [3, 6, 12] as const
export type MetricasPeriodo = (typeof METRICAS_PERIODOS)[number]
export const METRICAS_PERIODO_PADRAO: MetricasPeriodo = 6

export function ehPeriodoMetricas(v: unknown): v is MetricasPeriodo {
  return METRICAS_PERIODOS.includes(Number(v) as MetricasPeriodo)
}

/** Números de um mês (`YYYY-MM`). */
export interface MetricasMes {
  mes: string
  /** Receitas concluídas. */
  faturamento: number
  /** Despesas concluídas. */
  custos: number
  /** faturamento − custos. */
  lucro: number
  /** Veículos da Liberty adquiridos no mês (sem terceiros). */
  veiculos: number
  /** Soma do preço de aquisição desses veículos. */
  veiculosValor: number
  /** Manutenções pagas (com baixa) no mês. */
  manutencoes: number
  manutencoesValor: number
}

export interface MetricasFinanceiro {
  periodo: MetricasPeriodo
  /** Do mais antigo para o mais recente; o último é o mês corrente. */
  meses: MetricasMes[]
}

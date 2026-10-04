// Tipos serializáveis das métricas diárias. Ficam aqui (não em actions.ts)
// porque arquivos 'use server' só podem exportar funções async.

import type { MetricaValores } from '@/constants/metricas-diarias'

export interface MetricaDiaria extends MetricaValores {
  id: string
  uid: string
  nome: string
  data: string // YYYY-MM-DD
  mes: string // YYYY-MM
  atualizadoEm: string
}

export interface MetricasDoMes {
  mes: string
  registros: MetricaDiaria[]
}

export type SalvarMetricaResponse = { success: string; registro: MetricaDiaria } | { error: string }

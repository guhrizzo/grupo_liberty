// ─── Types & Constants ───────────────────────────────────────────────────────
// Tipos e constantes ficam aqui (não em actions.ts) porque arquivos 'use server'
// só podem exportar funções async.

export type ManutencaoStatus = 'agendada' | 'em_execucao' | 'concluida' | 'cancelada'

export const MANUTENCAO_STATUS: ManutencaoStatus[] = [
  'agendada',
  'em_execucao',
  'concluida',
  'cancelada',
]

export interface PecaConserto {
  nome: string
  valor: number
}

export interface Manutencao {
  id: string
  veiculoId: string
  veiculoLabel: string
  tipo: string
  descricao: string | null
  oficina: string
  responsavel: string
  custo: number
  dataAgendada: string
  dataConclusao: string | null
  status: ManutencaoStatus
  pecasConserto?: PecaConserto[] | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export type ManutencaoFieldErrors = {
  veiculoLabel?: string
  tipo?: string
  oficina?: string
  responsavel?: string
  dataAgendada?: string
}

export type ManutencaoResponse = {
  success?: string
  error?: string
  fieldErrors?: ManutencaoFieldErrors
  manutencao?: Manutencao
}

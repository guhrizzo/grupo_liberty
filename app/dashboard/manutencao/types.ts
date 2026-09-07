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

/**
 * Comprovante (nota fiscal ou recibo, PDF ou imagem) anexado na baixa de uma
 * manutenção. Só um por manutenção — reanexar substitui. Mesmo formato do
 * comprovante de lançamento do módulo Financeiro.
 */
export interface ManutencaoComprovante {
  fileName: string
  contentType: string
  size: number
  storagePath: string
  uploadedByUid: string
  uploadedByEmail: string | null
  uploadedAt: string
}

/**
 * Registro da baixa de uma manutenção: o valor pago (obrigatório) e um
 * comprovante opcional. `null` enquanto a manutenção não teve baixa.
 */
export interface BaixaManutencao {
  valor: number
  comprovante: ManutencaoComprovante | null
  baixadoEm: string
  baixadoPorUid: string
  baixadoPorEmail: string | null
}

export interface Manutencao {
  id: string
  veiculoId: string
  veiculoLabel: string
  tipo: string
  descricao: string | null
  oficina: string
  responsavel: string
  /** Espelha `baixa.valor`. Mantido para retrocompatibilidade (lista, propostas). */
  custo: number
  dataAgendada: string
  dataConclusao: string | null
  status: ManutencaoStatus
  pecasConserto?: PecaConserto[] | null
  /** `null` enquanto não houve baixa. */
  baixa: BaixaManutencao | null
  created_at: string
  updated_at: string
  created_by: string | null
}

/**
 * Uma manutenção "conta" (no custo efetivo total, nos totais de custo) quando
 * teve baixa OU — caso legado — já tinha `custo` preenchido e não está cancelada.
 */
export function isManutencaoBaixada(
  m: Pick<Manutencao, 'baixa' | 'custo' | 'status'>,
): boolean {
  return m.baixa != null || ((m.custo ?? 0) > 0 && m.status !== 'cancelada')
}

/** Valor efetivo da manutenção: o da baixa quando há, senão o `custo` legado. */
export function valorManutencao(m: Pick<Manutencao, 'baixa' | 'custo'>): number {
  return m.baixa ? m.baixa.valor : m.custo ?? 0
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

export type BaixaManutencaoResponse = {
  success?: string
  error?: string
  manutencao?: Manutencao
}

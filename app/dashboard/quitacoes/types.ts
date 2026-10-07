/** Uma quitação negociada com o banco para um veículo (histórico completo na coleção `quitacoes`). */
export interface Quitacao {
  id: string
  veiculoId: string
  /** Valor negociado para quitar, em reais. */
  valor: number
  /** Data da negociação (YYYY-MM-DD). */
  data: string
  observacao: string
  criadoPorNome: string
  criadoEm: string
}

/** Resumo do veículo para o seletor e a lista. */
export interface VeiculoQuitacaoOpcao {
  id: string
  marca: string
  modelo: string
  ano: number
  placa: string | null
}

export interface QuitacaoInput {
  veiculoId: string
  /** Valor em reais (já convertido). */
  valor: number
  /** YYYY-MM-DD */
  data: string
  observacao?: string
}

/** Atualização semanal: um novo valor por veículo, todos com a mesma data. */
export interface QuitacaoLoteInput {
  /** YYYY-MM-DD */
  data: string
  itens: { veiculoId: string; valor: number }[]
}

export interface UltimaQuitacao {
  valor: number
  data: string
}

export const QUITACAO_OBS_MAX = 300

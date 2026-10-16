/** Resumo das outras abas, exibido nos cards da aba Veículos. */
export interface ResumoVeiculo {
  /** Última proposta (negociação) recebida para o veículo. */
  proposta?: {
    status: 'pendente' | 'aceito' | 'recusado'
    /** ISO da proposta. */
    data: string
    telefone: string | null
  }
  /** Manutenções do veículo (canceladas ficam de fora). */
  manutencao?: {
    quantidade: number
    /** Soma dos valores com baixa, em reais. */
    total: number
  }
}

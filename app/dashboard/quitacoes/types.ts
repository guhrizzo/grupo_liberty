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
  /** Foto de capa (primeira foto), se houver. */
  foto: string | null
  /** Veículo de fora (cliente que contratou o serviço), cadastrado só para negociar a quitação. */
  terceiro: boolean
  /** Dados já cadastrados no veículo, usados como sugestão ao preencher a ficha. */
  sugestao: {
    nome: string | null
    cpf: string | null
    endereco: string | null
    banco: string | null
    valorParcela: number | null
  }
}

/** Dados do cliente e do financiamento para ligar ao banco. Um por veículo (coleção `quitacao_fichas`). */
export interface FichaQuitacao {
  veiculoId: string
  /** O veículo já foi quitado com o banco. */
  quitado: boolean
  /** YYYY-MM-DD */
  quitadoEm: string | null
  nome: string
  nomePai: string
  nomeMae: string
  cpf: string
  endereco: string
  /** YYYY-MM-DD — a idade é calculada a partir dela. */
  dataNascimento: string
  banco: string
  numeroContrato: string
  /** Data do próximo vencimento da parcela (YYYY-MM-DD). */
  vencimentoParcela: string
  valorParcela: number
}

export type FichaInput = Omit<FichaQuitacao, 'quitado' | 'quitadoEm'>

export interface VeiculoTerceiroInput {
  marca: string
  modelo: string
  ano: number
  placa: string
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

export const FICHA_TEXTO_MAX = 200

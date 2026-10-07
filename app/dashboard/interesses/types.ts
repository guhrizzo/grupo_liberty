export const INTERESSE_STATUS = ['ativo', 'atendido', 'cancelado'] as const
export type InteresseStatus = (typeof INTERESSE_STATUS)[number]

export const INTERESSE_STATUS_LABEL: Record<InteresseStatus, string> = {
  ativo: 'Ativo',
  atendido: 'Atendido',
  cancelado: 'Cancelado',
}

export const INTERESSE_TEXTO_MAX = 80
export const INTERESSE_OBS_MAX = 400

/** O que um cliente procura — como uma encomenda. Campos vazios = "tanto faz". */
export interface Interesse {
  id: string
  clienteNome: string
  clienteTelefone: string
  marca: string
  modelo: string
  anoMin: number | null
  anoMax: number | null
  /** Preço máximo que o cliente aceita pagar (R$). */
  precoMax: number | null
  cambio: string
  combustivel: string
  cor: string
  observacao: string
  status: InteresseStatus
  criadoPorNome: string
  criadoEm: string
}

export type InteresseInput = Omit<Interesse, 'id' | 'criadoPorNome' | 'criadoEm'>

/** Dados do veículo usados no cruzamento. */
export interface VeiculoParaMatch {
  marca: string
  modelo: string
  ano: number
  preco: number | null
  cambio: string
  combustivel: string
  cor: string | null
}

/** Veículo do estoque listado dentro de um interesse. */
export interface VeiculoEstoqueResumo extends VeiculoParaMatch {
  id: string
  placa: string | null
}

/** Cliente interessado, devolvido ao cadastrar um veículo que casa com o pedido. */
export interface InteressadoResumo {
  id: string
  clienteNome: string
  clienteTelefone: string
}

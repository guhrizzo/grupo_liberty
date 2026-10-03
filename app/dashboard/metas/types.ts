// Tipos serializáveis das metas. Ficam aqui (não em actions.ts) porque
// arquivos 'use server' só podem exportar funções async.

/** Vendedor que participa das metas (opção de "Quem fechou?"). */
export interface VendedorOpcao {
  uid: string
  nome: string
  email: string
}

/** `batida` = fechou a quantidade dentro do mês (bônus liberado). */
export type MetaSituacao = 'andamento' | 'batida' | 'nao_batida'

/** Proposta registrada fechada que contou para a meta. */
export interface MetaProposta {
  id: string
  cliente: string
  veiculo: string
  /** Valor da proposta (soma na meta em dinheiro). */
  valor: number
  fechadaEm: string
}

export interface Meta {
  id: string
  vendedorUid: string
  vendedorNome: string
  mes: string // YYYY-MM
  /** Meta em veículos fechados. Pelo menos uma das duas metas existe; basta bater uma. */
  quantidade: number | null
  /** Meta em R$ (soma do valor da proposta das fechadas). */
  valorMeta: number | null
  /** Com as duas metas: `true` = precisa bater as duas; `false` = basta uma. */
  exigirAmbas: boolean
  /** Bônus em R$ ao bater a meta. */
  bonus: number | null
  observacao: string
  bonusPagoEm: string | null
  /** Calculado na leitura a partir das propostas registradas fechadas. */
  fechadas: number
  /** Soma do valor da proposta das fechadas no mês. */
  valorFechado: number
  propostas: MetaProposta[]
  situacao: MetaSituacao
}

export type MetaFieldErrors = {
  vendedorUid?: string
  mes?: string
  quantidade?: string
  valorMeta?: string
  bonus?: string
  observacao?: string
}

export type MetaResponse = {
  success?: string
  error?: string
  fieldErrors?: MetaFieldErrors
}

export const META_QUANTIDADE_MAX = 999
export const META_OBSERVACAO_MAX = 300

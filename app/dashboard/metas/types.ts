// Tipos serializáveis das metas. Ficam aqui (não em actions.ts) porque
// arquivos 'use server' só podem exportar funções async.

/** `batida` = fechou a quantidade dentro do mês (bônus liberado). */
export type MetaSituacao = 'andamento' | 'batida' | 'nao_batida'

/** Proposta registrada fechada que contou para a meta. */
export interface MetaProposta {
  id: string
  cliente: string
  veiculo: string
  fechadaEm: string
}

export interface Meta {
  id: string
  vendedorUid: string
  vendedorNome: string
  mes: string // YYYY-MM
  quantidade: number
  /** Bônus em R$ ao bater a meta. */
  bonus: number | null
  observacao: string
  bonusPagoEm: string | null
  /** Calculado na leitura a partir das propostas registradas fechadas. */
  fechadas: number
  propostas: MetaProposta[]
  situacao: MetaSituacao
}

export type MetaFieldErrors = {
  vendedorUid?: string
  mes?: string
  quantidade?: string
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

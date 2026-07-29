// ─── Types & Constants ───────────────────────────────────────────────────────
// Tipos e constantes ficam aqui (não em actions.ts) porque arquivos 'use server'
// só podem exportar funções async.

export type TransacaoTipo = 'receita' | 'despesa'

export type TransacaoStatus = 'concluido' | 'pendente'

export type TransacaoCategoria =
  | 'Venda de Veículo'
  | 'Comissão'
  | 'Manutenção'
  | 'Documentação'
  | 'Serviço Legal'
  | 'Outros'

export const TRANSACAO_CATEGORIAS: TransacaoCategoria[] = [
  'Venda de Veículo',
  'Comissão',
  'Manutenção',
  'Documentação',
  'Serviço Legal',
  'Outros',
]

export interface Transacao {
  id: string
  descricao: string
  categoria: TransacaoCategoria
  tipo: TransacaoTipo
  valor: number
  data: string
  status: TransacaoStatus
  created_at: string
  updated_at: string
  created_by: string | null
}

export type TransacaoFieldErrors = {
  descricao?: string
  valor?: string
}

export type TransacaoResponse = {
  success?: string
  error?: string
  fieldErrors?: TransacaoFieldErrors
  transacao?: Transacao
}

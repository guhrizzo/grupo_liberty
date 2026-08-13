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
  // Pode ser uma das categorias predefinidas ou um nome customizado
  // informado pelo usuário quando a categoria selecionada é "Outros".
  categoria: TransacaoCategoria | (string & {})
  tipo: TransacaoTipo
  valor: number
  data: string
  status: TransacaoStatus
  created_at: string
  updated_at: string
  created_by: string | null
  // Vínculo com um pagamento de cobrança (quando o lançamento foi criado
  // automaticamente a partir de um pagamento registrado em /dashboard/cobrancas).
  // null/undefined = lançamento avulso, sem vínculo (ou vínculo já desfeito).
  origemPagamentoId?: string | null
  origemCobrancaId?: string | null
  origemParcelaId?: string | null
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

// ─── Contas fixas: tipos ─────────────────────────────────────────────────────
// Ficam aqui (não em actions.ts) porque arquivos 'use server' só podem exportar
// funções async.

export type ContaFixaPeriodicidade = 'mensal' | 'anual'

export interface ContaFixa {
  id: string
  nome: string
  categoria: string
  /** Valor previsto — o valor pago de fato é informado ao marcar como paga. */
  valor: number
  periodicidade: ContaFixaPeriodicidade
  /** 1–31. Em meses mais curtos o vencimento cai no último dia do mês. */
  diaVencimento: number
  /** 1–12 quando anual; `null` quando mensal. */
  mesVencimento: number | null
  ativa: boolean
  observacao: string | null
  /** `YYYY-MM` do cadastro — a conta só aparece a partir deste mês. */
  mesInicio: string
  created_at: string
  updated_at: string
  created_by: string | null
}

/** Pagamento de uma conta num mês = o lançamento `contafixa_<id>_<mes>` em `transacoes`. */
export interface PagamentoContaFixa {
  contaId: string
  transacaoId: string
  valor: number
  /** Data do pagamento (`YYYY-MM-DD`), não a competência. */
  data: string
}

export type ContaFixaStatus = 'paga' | 'a_vencer' | 'vence_hoje' | 'vencida'

export type ContaFixaFieldErrors = {
  nome?: string
  valor?: string
  diaVencimento?: string
  mesVencimento?: string
  data?: string
}

export type ContaFixaResponse = {
  success?: string
  error?: string
  fieldErrors?: ContaFixaFieldErrors
}

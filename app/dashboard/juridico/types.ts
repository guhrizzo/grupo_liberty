// ─── Types & Constants ───────────────────────────────────────────────────────
// Tipos e constantes ficam aqui (não em actions.ts) porque arquivos 'use server'
// só podem exportar funções async.

export type ProcessoStatus = 'em_andamento' | 'concluido' | 'pendente' | 'arquivado'

export const PROCESSO_STATUS: ProcessoStatus[] = [
  'em_andamento',
  'concluido',
  'pendente',
  'arquivado',
]

export interface Processo {
  id: string
  titulo: string
  cliente: string
  // CPF do cliente. Persistido criptografado (AES-256-CBC, ver utils/crypto)
  // — este campo já vem descriptografado quando lido via getProcessos().
  clienteCpf: string | null
  tipo: string
  numero: string | null
  status: ProcessoStatus
  responsavel: string
  prazo: string | null
  observacoes: string | null
  // Veículo opcional vinculado ao processo. Ao selecionar, o nome do
  // cliente é sugerido automaticamente a partir do contrato do veículo
  // (quando existir).
  veiculoId: string | null
  veiculoResumo: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export type ProcessoFieldErrors = {
  titulo?: string
  cliente?: string
  clienteCpf?: string
  tipo?: string
  responsavel?: string
}

export type ProcessoResponse = {
  success?: string
  error?: string
  fieldErrors?: ProcessoFieldErrors
  processo?: Processo
}

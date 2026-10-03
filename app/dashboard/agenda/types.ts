// Tipos serializáveis da Agenda. Ficam aqui (não em actions.ts) porque
// arquivos 'use server' só podem exportar funções async.

export interface Compromisso {
  id: string
  titulo: string
  descricao: string
  local: string
  data: string // YYYY-MM-DD
  diaInteiro: boolean
  horaInicio: string | null // HH:MM
  horaFim: string | null
  participantes: { uid: string; nome: string; conectado: boolean; erro: string | null; sincronizado: boolean }[]
  criadoPorNome: string
  atualizadoEm: string
}

export interface ConexaoGoogle {
  /** Variáveis do Google configuradas no servidor. */
  configurada: boolean
  /** E-mail da conta Google conectada, ou null. */
  email: string | null
}

export interface UsuarioAgenda {
  uid: string
  nome: string
  email: string
}

export type CompromissoFieldErrors = {
  titulo?: string
  data?: string
  horaInicio?: string
  horaFim?: string
  participantes?: string
}

export type AgendaResponse = {
  success?: string
  error?: string
  fieldErrors?: CompromissoFieldErrors
  /** Aviso não bloqueante (ex.: falhou sincronizar com o Google de alguém). */
  aviso?: string
}

export const AGENDA_TITULO_MAX = 140
export const AGENDA_DESCRICAO_MAX = 2000
export const AGENDA_LOCAL_MAX = 200

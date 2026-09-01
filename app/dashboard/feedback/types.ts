// Tipos serializáveis do feedback. Ficam aqui (não em actions.ts) porque
// arquivos 'use server' só podem exportar funções async.

import type { FeedbackTipo, FeedbackStatus } from '@/constants/feedback'

export interface FeedbackAtualizacao {
  texto: string
  em: string // ISO — quando o dono registrou
}

export interface Feedback {
  id: string
  tipo: FeedbackTipo
  titulo: string
  descricao: string
  tela: string | null
  status: FeedbackStatus
  criadoPorUid: string
  criadoPorNome: string
  criadoPorEmail: string | null
  criadoEm: string
  atualizadoEm: string
  atualizacoes: FeedbackAtualizacao[]
}

export type FeedbackFieldErrors = {
  tipo?: string
  titulo?: string
  descricao?: string
  tela?: string
}

export type FeedbackResponse = {
  success?: string
  error?: string
  fieldErrors?: FeedbackFieldErrors
}

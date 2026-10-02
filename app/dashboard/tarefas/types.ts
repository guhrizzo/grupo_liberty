// Tipos serializáveis das tarefas. Ficam aqui (não em actions.ts) porque
// arquivos 'use server' só podem exportar funções async.

import type { TarefaStatus } from '@/constants/tarefas'

export interface Tarefa {
  id: string
  titulo: string
  descricao: string
  prazo: string // YYYY-MM-DD
  responsavelUid: string
  responsavelNome: string
  responsavelEmail: string
  status: TarefaStatus
  /** Motivo (não concluída, obrigatório) ou comentário (concluída, opcional). */
  comentario: string | null
  respondidoEm: string | null
  fechada: boolean
  fechadaEm: string | null
  criadoPorUid: string
  criadoPorNome: string
  criadoEm: string
  atualizadoEm: string
}

/** Usuário que pode receber tarefas (seletor do ADM supremo). */
export interface UsuarioOpcao {
  uid: string
  nome: string
  email: string
}

export type TarefaFieldErrors = {
  titulo?: string
  descricao?: string
  prazo?: string
  responsavelUid?: string
  comentario?: string
}

export type TarefaResponse = {
  success?: string
  error?: string
  fieldErrors?: TarefaFieldErrors
}

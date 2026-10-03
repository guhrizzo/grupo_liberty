// Tipos serializáveis das tarefas. Ficam aqui (não em actions.ts) porque
// arquivos 'use server' só podem exportar funções async.

import type { TarefaPrioridade, TarefaStatus } from '@/constants/tarefas'

export interface Tarefa {
  id: string
  titulo: string
  descricao: string
  prazo: string // YYYY-MM-DD
  /** Tarefas antigas (sem o campo) contam como `normal`. */
  prioridade: TarefaPrioridade
  responsavelUid: string
  responsavelNome: string
  responsavelEmail: string
  status: TarefaStatus
  /** Motivo (não concluída, obrigatório) ou comentário (concluída, opcional). */
  comentario: string | null
  respondidoEm: string | null
  /** ISO — responsável pediu ao ADM supremo para excluir (só tarefa concluída). */
  exclusaoSolicitadaEm: string | null
  fechada: boolean
  fechadaEm: string | null
  criadoPorUid: string
  criadoPorNome: string
  criadoEm: string
  atualizadoEm: string
}

/** Item da lista de afazeres pessoal (privada) do usuário. */
export interface Afazer {
  id: string
  texto: string
  feito: boolean
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
  prioridade?: string
  responsavelUid?: string
  comentario?: string
}

export type TarefaResponse = {
  success?: string
  error?: string
  fieldErrors?: TarefaFieldErrors
}

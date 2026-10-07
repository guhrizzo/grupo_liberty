// Tipos serializáveis dos "Lembretes ao CEO". Ficam aqui (não em actions.ts)
// porque arquivos 'use server' só podem exportar funções async.

import type { TarefaPrioridade } from '@/constants/tarefas'

export const LEMBRETE_TEXTO_MAX = 1000

export interface Lembrete {
  id: string
  texto: string
  prioridade: TarefaPrioridade
  autorUid: string
  autorNome: string
  criadoEm: string
  /** ISO — quando o CEO marcou como visto; null = ainda não visto. */
  vistoEm: string | null
}

export type LembreteResponse = {
  success?: string
  error?: string
}

// Tipos serializáveis das tarefas semanais (fora de arquivos 'use server').

export interface TarefaSemanal {
  id: string
  titulo: string
  descricao: string
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number
  responsavelUid: string
  responsavelNome: string
  ativa: boolean
  /** Data (YYYY-MM-DD) a partir da qual a regra vale. */
  desde: string
  /** Ocorrência mais recente (até hoje), ou null se a regra ainda não valeu. */
  ocorrencia: string | null
  concluida: boolean
  concluidaPorNome: string | null
}

export type TarefaSemanalResponse = { success?: string; error?: string }

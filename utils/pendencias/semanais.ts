// Tarefas semanais (rotina): regra "toda <dia>: <tarefa>" por funcionário.
// Sem 'server-only': usado também em client components.

export const DIAS_SEMANA = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
] as const

/** "Toda terça", "Todo sábado"… */
export function rotuloDia(diaSemana: number): string {
  const nome = DIAS_SEMANA[diaSemana] ?? ''
  return diaSemana === 0 || diaSemana === 6 ? `Todo ${nome}` : `Toda ${nome}`
}

export function ehDiaSemana(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6
}

/**
 * Data (YYYY-MM-DD) da ocorrência mais recente do dia da semana, até `hoje`
 * inclusive. Se a tarefa não foi feita, ela segue pendente (atrasada) até a
 * próxima ocorrência assumir o lugar.
 */
export function ocorrenciaAtual(hoje: string, diaSemana: number): string {
  const [y, m, d] = hoje.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const diff = (dt.getUTCDay() - diaSemana + 7) % 7
  dt.setUTCDate(dt.getUTCDate() - diff)
  return dt.toISOString().slice(0, 10)
}

export const COL_TAREFAS_SEMANAIS = 'tarefas_semanais'
export const COL_TAREFAS_SEMANAIS_CONCLUSOES = 'tarefas_semanais_conclusoes'

/** Id do documento de conclusão de uma ocorrência. */
export function idConclusao(regraId: string, data: string): string {
  return `${regraId}_${data}`
}

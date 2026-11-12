// Pendências de módulos (manutenção, tarefas, rotina semanal e checklist pós-compra) que
// aparecem em Demandas e no sininho do painel. Ficam fora de arquivos
// 'use server' para poder exportar tipos e constantes.

export type PendenciaOrigem = 'manutencao' | 'tarefa' | 'semanal' | 'checklist'

export interface Pendencia {
  /** `<origem>:<id do registro>` — chave estável na lista. */
  id: string
  origem: PendenciaOrigem
  titulo: string
  detalhe: string
  /** YYYY-MM-DD — data em que a tarefa deveria ser executada. */
  data: string
  atrasada: boolean
  venceHoje: boolean
  /** Página onde a pendência é resolvida. */
  href: string
  /** Nome de quem deve executar (só preenchido quando o ADM supremo vê pendências de outros). */
  responsavel?: string
}

export const PENDENCIA_ORIGEM_LABEL: Record<PendenciaOrigem, string> = {
  manutencao: 'Manutenção',
  tarefa: 'Tarefa',
  semanal: 'Rotina semanal',
  checklist: 'Checklist pós-compra',
}

// Pendências de módulos (manutenção hoje; checklist pós-compra no futuro) que
// aparecem em Demandas e no sininho do painel. Ficam fora de arquivos
// 'use server' para poder exportar tipos e constantes.

export type PendenciaOrigem = 'manutencao'

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
}

export const PENDENCIA_ORIGEM_LABEL: Record<PendenciaOrigem, string> = {
  manutencao: 'Manutenção',
}

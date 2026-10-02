// Tarefas — o ADM supremo atribui tarefas com prazo a um usuário, que responde
// "concluída" (comentário opcional) ou "não concluída" (com motivo). Ver
// docs/superpowers/specs/2026-10-01-tarefas-design.md.
// Não importa `server-only`: é usado no client e no servidor.

export type TarefaStatus = 'pendente' | 'concluida' | 'nao_concluida'

export const TAREFA_STATUS: Record<TarefaStatus, { label: string; classes: string }> = {
  pendente: {
    label: 'Pendente',
    classes:
      'border-amber-200 bg-amber-50 text-amber-700 adobe-dark:border-amber-500/30 adobe-dark:bg-amber-500/10 adobe-dark:text-amber-300',
  },
  concluida: {
    label: 'Concluída',
    classes:
      'border-emerald-200 bg-emerald-50 text-emerald-700 adobe-dark:border-emerald-500/30 adobe-dark:bg-emerald-500/10 adobe-dark:text-emerald-300',
  },
  nao_concluida: {
    label: 'Não concluída',
    classes:
      'border-rose-200 bg-rose-50 text-rose-700 adobe-dark:border-rose-500/30 adobe-dark:bg-rose-500/10 adobe-dark:text-rose-300',
  },
}

export const TAREFA_STATUS_ORDEM: TarefaStatus[] = ['pendente', 'concluida', 'nao_concluida']

export const TAREFA_TITULO_MAX = 140
export const TAREFA_DESCRICAO_MAX = 4000
export const TAREFA_COMENTARIO_MAX = 1000

export function ehTarefaStatus(v: unknown): v is TarefaStatus {
  return v === 'pendente' || v === 'concluida' || v === 'nao_concluida'
}

export function ehDataValida(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/**
 * Pendente, aberta e com o prazo já passado. `hoje` é `YYYY-MM-DD` no fuso do
 * negócio (`hojeNoFuso`) — o prazo vence no fim do dia, então só atrasa no dia seguinte.
 */
export function tarefaAtrasada(
  t: { status: TarefaStatus; fechada: boolean; prazo: string },
  hoje: string,
): boolean {
  return t.status === 'pendente' && !t.fechada && t.prazo < hoje
}

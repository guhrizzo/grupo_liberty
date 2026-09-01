// Feedback interno — reporte de bugs e sugestões de melhoria.
//
// `OWNER_EMAIL` é a única pessoa que faz a triagem (muda status, escreve
// atualizações, exclui). O sistema de acesso do resto do projeto é por
// role/permissions no perfil — este gate por e-mail é uma exceção deliberada.
// Não importa `server-only`: é usado no client e no servidor.

export const OWNER_EMAIL = 'gurizzo943@gmail.com'

export type FeedbackTipo = 'bug' | 'melhoria'
export type FeedbackStatus = 'aberto' | 'em_analise' | 'resolvido' | 'descartado'

export const FEEDBACK_TIPOS: Record<
  FeedbackTipo,
  { label: string; classes: string }
> = {
  bug: { label: 'Bug', classes: 'border-rose-200 bg-rose-50 text-rose-700' },
  melhoria: {
    label: 'Melhoria',
    classes: 'border-liberty/30 bg-liberty/10 text-liberty-deep',
  },
}

export const FEEDBACK_STATUS: Record<
  FeedbackStatus,
  { label: string; classes: string }
> = {
  aberto: { label: 'Aberto', classes: 'border-amber-200 bg-amber-50 text-amber-700' },
  em_analise: {
    label: 'Em análise',
    classes: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  resolvido: {
    label: 'Resolvido',
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  descartado: {
    label: 'Descartado',
    classes: 'border-neutral-200 bg-neutral-100 text-neutral-600',
  },
}

/** Ordem dos status no seletor de triagem. */
export const FEEDBACK_STATUS_ORDEM: FeedbackStatus[] = [
  'aberto',
  'em_analise',
  'resolvido',
  'descartado',
]

export function ehFeedbackTipo(v: unknown): v is FeedbackTipo {
  return v === 'bug' || v === 'melhoria'
}

export function ehFeedbackStatus(v: unknown): v is FeedbackStatus {
  return (
    v === 'aberto' || v === 'em_analise' || v === 'resolvido' || v === 'descartado'
  )
}

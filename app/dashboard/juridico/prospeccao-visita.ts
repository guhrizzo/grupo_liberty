// Resultado das visitas do vendedor ao cliente do lead. Usado no cliente
// (checklist, selos, filtro) e no servidor (validação antes de gravar).

import type { ResultadoVisita, VisitaLead } from './types'

export const RESULTADOS_VISITA: {
  value: ResultadoVisita
  label: string
  /** Classes do selo (claro + adobe-dark). */
  tom: string
}[] = [
  {
    value: 'positiva',
    label: 'Positiva',
    tom: 'border-emerald-200 bg-emerald-50 text-emerald-700 adobe-dark:border-emerald-400/40 adobe-dark:bg-emerald-500/15 adobe-dark:text-emerald-300',
  },
  {
    value: 'negativa',
    label: 'Negativa',
    tom: 'border-rose-200 bg-rose-50 text-rose-700 adobe-dark:border-rose-400/40 adobe-dark:bg-rose-500/15 adobe-dark:text-rose-300',
  },
  {
    value: 'endereco_nao_encontrado',
    label: 'Endereço não encontrado',
    tom: 'border-neutral-300 bg-neutral-100 text-neutral-700 adobe-dark:border-adobe-line adobe-dark:bg-white/5 adobe-dark:text-adobe-text-md',
  },
  {
    value: 'nao_mora_mais',
    label: 'Cliente não mora mais no endereço',
    tom: 'border-neutral-300 bg-neutral-100 text-neutral-700 adobe-dark:border-adobe-line adobe-dark:bg-white/5 adobe-dark:text-adobe-text-md',
  },
  {
    value: 'ninguem_em_casa',
    label: 'Ninguém em casa / não atendeu',
    tom: 'border-sky-200 bg-sky-50 text-sky-700 adobe-dark:border-sky-400/40 adobe-dark:bg-sky-500/15 adobe-dark:text-sky-300',
  },
  {
    value: 'retornar',
    label: 'Retornar',
    tom: 'border-amber-200 bg-amber-50 text-amber-800 adobe-dark:border-amber-400/40 adobe-dark:bg-amber-500/15 adobe-dark:text-amber-300',
  },
]

const POR_VALOR = new Map(RESULTADOS_VISITA.map((r) => [r.value, r]))

export function resultadoValido(v: unknown): v is ResultadoVisita {
  return typeof v === 'string' && POR_VALOR.has(v as ResultadoVisita)
}

export function rotuloResultado(v: ResultadoVisita): string {
  return POR_VALOR.get(v)?.label ?? v
}

export function tomResultado(v: ResultadoVisita): string {
  return POR_VALOR.get(v)?.tom ?? ''
}

export const OBSERVACAO_MAX = 1000

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

export function dataValida(v: unknown): v is string {
  if (typeof v !== 'string' || !DATA_RE.test(v)) return false
  // Rejeita dias que não existem (ex.: 2026-02-31).
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

/** Hoje no fuso local, como YYYY-MM-DD. */
export function hojeLocal(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Mais recente primeiro: pela data da visita, depois por quando foi registrada. */
export function ordenarVisitas(visitas: VisitaLead[]): VisitaLead[] {
  return [...visitas].sort((a, b) =>
    a.data === b.data ? b.criadoEm.localeCompare(a.criadoEm) : b.data.localeCompare(a.data),
  )
}

/** Lê o array gravado no Firestore, descartando entradas inválidas. */
export function normalizarVisitas(raw: unknown): VisitaLead[] {
  if (!Array.isArray(raw)) return []
  const out: VisitaLead[] = []
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    if (typeof o.id !== 'string' || !resultadoValido(o.resultado) || !dataValida(o.data)) continue
    out.push({
      id: o.id,
      resultado: o.resultado,
      data: o.data,
      retornoEm: dataValida(o.retornoEm) ? o.retornoEm : null,
      observacao: typeof o.observacao === 'string' ? o.observacao : '',
      vendedorUid: typeof o.vendedorUid === 'string' ? o.vendedorUid : '',
      vendedorNome: typeof o.vendedorNome === 'string' ? o.vendedorNome : '',
      criadoEm: typeof o.criadoEm === 'string' ? o.criadoEm : '',
    })
  }
  return ordenarVisitas(out)
}

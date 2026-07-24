// Formatters compartilhados. Substituem as cópias locais em cada *Client.tsx.

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateBR = new Intl.DateTimeFormat('pt-BR')
const dateTimeBR = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return brl.format(value)
}

export function formatKm(value: number | null | undefined): string {
  if (value == null) return 'Km não inf.'
  return new Intl.NumberFormat('pt-BR').format(value) + ' km'
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR').format(value)
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return dateBR.format(d)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return dateTimeBR.format(d)
}

/** Diferença formatada em BRL (com sinal). */
export function formatCurrencyDiff(a: number, b: number): string {
  const diff = a - b
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : ''
  return sign + brl.format(Math.abs(diff)).replace('R$', 'R$ ')
}

/** Plural simples. */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

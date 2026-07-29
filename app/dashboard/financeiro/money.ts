// ─── Helpers monetários locais do módulo Financeiro ──────────────────────────
// Diferente do maskMoney global (que fixa os 2 últimos dígitos como centavos),
// aqui o usuário digita o número como vê: "122" → "122,00", "122,5" → "122,50".
// Mantém a formatação pt-BR com separador de milhar.

/** Formata um número em string pt-BR (1.234,56). */
export function fmtBRL(n: number): string {
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Máscara "intuitiva" para o input monetário. O usuário digita os dígitos como
 * espera vê-los — `122` produz `122,00`, `1225` produz `1.225,00`, `122,5`
 * produz `122,50`. Diferente do maskMoney global.
 *
 * Mantém a vírgula visível assim que ela for digitada, mesmo que ainda não
 * haja dígitos decimais — ex: digitar "1," mantém "1," no input.
 */
export function maskMoneyIntuitivo(raw: string): string {
  if (!raw) return ''
  let s = raw.replace(/[^\d,]/g, '')

  // detecta se o usuário está digitando a vírgula "pendurada" (no fim ou
  // sem dígitos depois) — vamos preservar essa vírgula na saída.
  const trailingComma = s.endsWith(',')

  // garante apenas uma vírgula
  const firstComma = s.indexOf(',')
  if (firstComma !== -1) {
    s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, '')
    // limita casas decimais a 2
    const [head, dec = ''] = s.split(',')
    if (dec.length > 2) s = head + ',' + dec.slice(0, 2)
  }

  // separa parte inteira e decimal
  const [intPartRaw = '0', decPartRaw = ''] = s.split(',')
  const intPart = intPartRaw.replace(/^0+(?=\d)/, '') || '0'

  // insere separador de milhar
  const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  // se há vírgula no input (mesmo que sem dígitos depois), mantém ela visível
  if (firstComma !== -1) {
    return `${intFmt},${decPartRaw}`
  }
  return trailingComma ? `${intFmt},` : intFmt
}

/**
 * Converte a string pt-BR (com ou sem vírgula) em número.
 * Aceita "122", "122,5", "122,50", "1.234,56".
 */
export function parseMoneyIntuitivo(formatted: string): number {
  if (!formatted) return 0
  const cleaned = formatted.replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

/** Formata um valor numérico para popular o input. */
export function moneyFromNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return ''
  return fmtBRL(value)
}
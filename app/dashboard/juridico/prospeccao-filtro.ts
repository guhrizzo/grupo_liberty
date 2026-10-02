// Filtro estilo Excel da lista de prospecção/leads: cada coluna tem uma lista
// de valores marcáveis e pode ser classificada. Lógica pura, sem React.

import { formatCurrency } from '@/utils/format'
import type { ProspeccaoInput } from './types'

export type ColunaFiltro = keyof ProspeccaoInput

/** Coluna → valores permitidos. Coluna ausente = sem filtro. */
export type Filtros = Partial<Record<ColunaFiltro, Set<string>>>

export type Ordem = { key: ColunaFiltro; dir: 'asc' | 'desc' } | null

const MONEY = new Set<ColunaFiltro>(['valorEntrada', 'valorFinanciado', 'valorParcela'])
const NUMERICAS = new Set<ColunaFiltro>([
  ...MONEY,
  'parcelasContrato',
  'parcelasPagas',
])

export function colunaNumerica(key: ColunaFiltro): boolean {
  return NUMERICAS.has(key)
}

/** Valor da célula usado no filtro ('' = vazia). */
export function valorFiltro(p: ProspeccaoInput, key: ColunaFiltro): string {
  const v = p[key]
  if (v === null || v === undefined) return ''
  if (MONEY.has(key)) return formatCurrency(v as number)
  return String(v).trim()
}

export function rotuloFiltro(valor: string): string {
  return valor === '' ? '(Vazias)' : valor
}

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

function numero(p: ProspeccaoInput, key: ColunaFiltro): number | null {
  const v = p[key]
  return typeof v === 'number' ? v : null
}

/** Compara dois registros pela coluna; vazios sempre por último. */
function comparar(a: ProspeccaoInput, b: ProspeccaoInput, key: ColunaFiltro, dir: 1 | -1): number {
  if (NUMERICAS.has(key)) {
    const x = numero(a, key)
    const y = numero(b, key)
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
    return (x - y) * dir
  }
  const x = valorFiltro(a, key)
  const y = valorFiltro(b, key)
  if (!x || !y) return x === y ? 0 : !x ? 1 : -1
  return collator.compare(x, y) * dir
}

export function ordenar<T extends ProspeccaoInput>(itens: T[], ordem: Ordem): T[] {
  if (!ordem) return itens
  const dir = ordem.dir === 'asc' ? 1 : -1
  return [...itens].sort((a, b) => comparar(a, b, ordem.key, dir))
}

/** Aplica os filtros de todas as colunas, menos `ignorar` (se informada). */
export function aplicarFiltros<T extends ProspeccaoInput>(
  itens: T[],
  filtros: Filtros,
  ignorar?: ColunaFiltro,
): T[] {
  const ativos = (Object.entries(filtros) as [ColunaFiltro, Set<string>][]).filter(
    ([key]) => key !== ignorar,
  )
  if (ativos.length === 0) return itens
  return itens.filter((p) => ativos.every(([key, permitidos]) => permitidos.has(valorFiltro(p, key))))
}

/** Valores distintos da coluna, na ordem crescente (vazias no fim). */
export function valoresDistintos(itens: ProspeccaoInput[], key: ColunaFiltro): string[] {
  const vistos = new Map<string, ProspeccaoInput>()
  for (const p of itens) {
    const v = valorFiltro(p, key)
    if (!vistos.has(v)) vistos.set(v, p)
  }
  return [...vistos.entries()]
    .sort(([, a], [, b]) => comparar(a, b, key, 1))
    .map(([v]) => v)
}

export function totalFiltrosAtivos(filtros: Filtros): number {
  return Object.keys(filtros).length
}

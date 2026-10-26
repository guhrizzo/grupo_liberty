// Parcelas em atraso de um veículo financiado. O operador informa quantas
// estavam em atraso no dia do cadastro (`base`, em `informadoEm`); a cada mês
// que passa desde então, mais uma parcela vence sem pagamento. O valor atual é
// calculado na leitura, então não precisa de cron.

/** Meses completos entre `de` (YYYY-MM-DD) e `ate`. */
export function mesesCompletos(de: string, ate: Date = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(de)
  if (!m) return 0
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  let meses = (ate.getFullYear() - ano) * 12 + (ate.getMonth() + 1 - mes)
  if (ate.getDate() < dia) meses--
  return Math.max(0, meses)
}

/**
 * Parcelas em atraso hoje. Só cresce quando havia atraso na data informada
 * (base > 0) e nunca passa das parcelas restantes, quando conhecidas.
 */
export function parcelasAtrasoAtual(args: {
  base: number | null | undefined
  informadoEm: string | null | undefined
  parcelasRestantes?: number | null
  hoje?: Date
}): number | null {
  const { base, informadoEm, parcelasRestantes, hoje } = args
  if (base == null || !Number.isFinite(base) || base < 0) return null
  if (base === 0 || !informadoEm) return base
  let atual = base + mesesCompletos(informadoEm, hoje)
  if (parcelasRestantes != null && parcelasRestantes > 0) {
    atual = Math.min(atual, Math.max(base, parcelasRestantes))
  }
  return atual
}

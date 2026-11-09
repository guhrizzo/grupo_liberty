// Cálculos da reserva de quitação. Funções puras — sem Firestore nem Asaas.

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Percentual do valor BRUTO de cada parcela que precisa ir para a reserva
 * para cobrir o saldo devedor até o fim do contrato. Arredonda para cima
 * (2 casas) para a reserva nunca ficar curta; limitado a 100. A tarifa do
 * Asaas é arcada pelo caixa, não pela reserva.
 */
export function sugerirPercentualReserva(params: {
  saldoDevedor: number
  valorParcelasRestantes: number
  parcelasRestantes: number
}): number {
  const { saldoDevedor, valorParcelasRestantes, parcelasRestantes } = params
  if (saldoDevedor <= 0 || parcelasRestantes <= 0) return 0
  if (valorParcelasRestantes <= 0) return 100
  const pct = (saldoDevedor / valorParcelasRestantes) * 100
  return Math.min(100, Math.ceil(pct * 100) / 100)
}

/** Reserva = % do valor bruto; o caixa fica com o líquido menos a reserva. */
export function dividirBruto(
  bruto: number,
  liquido: number,
  pct: number,
): { reserva: number; caixa: number } {
  const reserva = round2((bruto * pct) / 100)
  return { reserva, caixa: round2(liquido - reserva) }
}

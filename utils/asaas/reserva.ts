// Cálculos da reserva de quitação. Funções puras — sem Firestore nem Asaas.

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Percentual do valor LÍQUIDO de cada parcela que precisa ir para a reserva
 * para cobrir o saldo devedor até o fim do contrato. Arredonda para cima
 * (2 casas) para a reserva nunca ficar curta; limitado a 100.
 *
 * `taxaEstimadaPorParcela` abate a tarifa do Asaas (Pix/boleto) do que de fato
 * cai na conta, já que o Asaas aplica o percentual sobre o líquido.
 */
export function sugerirPercentualReserva(params: {
  saldoDevedor: number
  valorParcelasRestantes: number
  parcelasRestantes: number
  taxaEstimadaPorParcela: number
}): number {
  const { saldoDevedor, valorParcelasRestantes, parcelasRestantes, taxaEstimadaPorParcela } = params
  if (saldoDevedor <= 0 || parcelasRestantes <= 0) return 0
  const liquidoEsperado = valorParcelasRestantes - taxaEstimadaPorParcela * parcelasRestantes
  if (liquidoEsperado <= 0) return 100
  const pct = (saldoDevedor / liquidoEsperado) * 100
  return Math.min(100, Math.ceil(pct * 100) / 100)
}

/** Divide o valor líquido recebido entre reserva e caixa. */
export function dividirLiquido(liquido: number, pct: number): { reserva: number; caixa: number } {
  const reserva = round2((liquido * pct) / 100)
  return { reserva, caixa: round2(liquido - reserva) }
}

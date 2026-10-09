export const COMISSAO_FIXA = 300
export const COMISSAO_TETO = 1200
export const COMISSAO_PERCENTUAL = 0.06

/**
 * Comissão do vendedor: R$ 300 fixos + 6% sobre (proposta prévia − valor da
 * proposta), limitada a R$ 1.200. Se o valor passar da prévia a comissão cai
 * abaixo de R$ 300 (sem ficar negativa).
 */
export function calcularComissaoVendedor(propostaPrevia: number, valor: number): number {
  const bruto = COMISSAO_FIXA + (propostaPrevia - valor) * COMISSAO_PERCENTUAL
  return Math.min(COMISSAO_TETO, Math.max(0, bruto))
}

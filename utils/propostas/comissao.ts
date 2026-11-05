export const COMISSAO_FIXA = 300
export const COMISSAO_TETO = 1200
export const COMISSAO_PERCENTUAL = 0.06

/**
 * Comissão do vendedor: mínimo de R$ 300. Os 6% só entram quando o valor da
 * proposta é MENOR que a proposta prévia: R$ 300 + 6% sobre (prévia − valor),
 * limitada a R$ 1.200. Valor igual ou acima da prévia = R$ 300.
 */
export function calcularComissaoVendedor(propostaPrevia: number, valor: number): number {
  const desconto = Math.max(0, propostaPrevia - valor)
  return Math.min(COMISSAO_TETO, COMISSAO_FIXA + desconto * COMISSAO_PERCENTUAL)
}

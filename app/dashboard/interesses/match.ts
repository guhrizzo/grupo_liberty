import type { Interesse, VeiculoParaMatch } from './types'

function norm(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * O veículo atende ao pedido? Campos vazios do pedido não restringem.
 * Preço desconhecido no veículo não o exclui (só um preço acima do máximo exclui).
 */
export function veiculoCasaComInteresse(
  i: Pick<Interesse, 'marca' | 'modelo' | 'anoMin' | 'anoMax' | 'precoMax' | 'cambio' | 'combustivel' | 'cor'>,
  v: VeiculoParaMatch,
): boolean {
  if (i.marca && !norm(v.marca).includes(norm(i.marca))) return false
  if (i.modelo && !norm(v.modelo).includes(norm(i.modelo))) return false
  if (i.anoMin != null && v.ano < i.anoMin) return false
  if (i.anoMax != null && v.ano > i.anoMax) return false
  if (i.precoMax != null && v.preco != null && v.preco > i.precoMax) return false
  if (i.cambio && norm(v.cambio) !== norm(i.cambio)) return false
  if (i.combustivel && !norm(v.combustivel).includes(norm(i.combustivel))) return false
  if (i.cor && !norm(v.cor).includes(norm(i.cor))) return false
  return true
}

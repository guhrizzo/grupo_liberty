// OTM: dias entre a entrada do veículo no estoque e a venda — o tempo que o
// dinheiro investido levou para voltar. A entrada é a data de aquisição; sem
// ela, a de cadastro (mesma regra das métricas do Financeiro).

const DIA_MS = 24 * 60 * 60 * 1000

function emMs(valor: unknown): number | null {
  if (typeof valor !== 'string' || !valor) return null
  // YYYY-MM-DD vira meia-noite UTC; instantes ISO são lidos como estão.
  const ms = new Date(valor).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** Dias inteiros de `inicio` até `fim` (padrão: agora). Nulo se a entrada for inválida. */
export function diasEntre(inicio: unknown, fim?: unknown): number | null {
  const a = emMs(inicio)
  const b = fim == null ? Date.now() : emMs(fim)
  if (a === null || b === null) return null
  return Math.max(0, Math.floor((b - a) / DIA_MS))
}

/** Dias em estoque: até a venda, se já vendido; senão até hoje. */
export function diasEmEstoque(v: {
  dataAquisicao?: string | null
  created_at?: string | null
  vendidoEm?: string | null
}): number | null {
  return diasEntre(v.dataAquisicao || v.created_at, v.vendidoEm || undefined)
}

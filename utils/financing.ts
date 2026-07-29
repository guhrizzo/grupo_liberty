// Cálculos de financiamento — Tabela Price (sistema padrão de juros compostos
// usado por bancos brasileiros para veículos). Funções puras, sem dependências
// de React ou DOM — próprias para rodar no cliente ou em server components.

export interface ParcelaMensal {
  mes: number
  parcela: number
  juros: number
  amortizacao: number
  saldoDevedor: number
}

export interface ProjecaoResult {
  /** Valor do veículo (preço cheio). */
  valorVeiculo: number
  /** Valor da entrada — já subtraído. */
  entrada: number
  /** Valor efetivamente financiado após a entrada. */
  valorFinanciado: number
  /** Taxa de juros efetiva usada no cálculo (a.m., fração). */
  taxaMensal: number
  /** Prazo em meses. */
  prazoMeses: number
  /** Parcela mensal fixa (Price). 0 se a taxa for 0. */
  parcelaMensal: number
  /** Total pago ao final = parcelaMensal × prazo + entrada. */
  totalPago: number
  /** Soma apenas dos juros (Price). */
  totalJuros: number
  /** Custo efetivo total do financiamento (parcela × prazo + entrada). */
  custoEfetivoTotal: number
  /** Memória de cálculo mês a mês (útil se quisermos renderizar tabela). */
  parcelas: ParcelaMensal[]
}

/** Converte taxa anual (em %) para mensal equivalente (em fração, não %). */
export function taxaAnualParaMensal(anualPct: number): number {
  if (!Number.isFinite(anualPct) || anualPct <= 0) return 0
  const a = anualPct / 100
  return Math.pow(1 + a, 1 / 12) - 1
}

/** Converte taxa mensal (em %) para anual equivalente (em %). */
export function taxaMensalParaAnual(mensalPct: number): number {
  if (!Number.isFinite(mensalPct) || mensalPct <= 0) return 0
  return (Math.pow(1 + mensalPct / 100, 12) - 1) * 100
}

/**
 * Tabela Price: parcela fixa durante todo o prazo.
 * - Se a taxa for 0, parcela = valorFinanciado / prazo (juros zero).
 * - Se o prazo for 0, retorna zeros.
 *
 * Fórmula: PMT = PV · i / (1 − (1 + i)^−n)
 */
export function calcularPrice(
  valorFinanciado: number,
  taxaMensalFrac: number,
  prazoMeses: number,
): ProjecaoResult {
  const vf = Math.max(0, valorFinanciado)
  const n = Math.max(0, Math.floor(prazoMeses))

  let parcelaMensal = 0
  let totalJuros = 0
  const parcelas: ParcelaMensal[] = []

  if (vf <= 0 || n <= 0) {
    return {
      valorVeiculo: valorFinanciado,
      entrada: 0,
      valorFinanciado: 0,
      taxaMensal: taxaMensalFrac,
      prazoMeses: n,
      parcelaMensal: 0,
      totalPago: 0,
      totalJuros: 0,
      custoEfetivoTotal: 0,
      parcelas: [],
    }
  }

  if (taxaMensalFrac <= 0) {
    parcelaMensal = vf / n
    let saldo = vf
    for (let mes = 1; mes <= n; mes++) {
      const amort = parcelaMensal
      saldo = Math.max(0, saldo - amort)
      parcelas.push({
        mes,
        parcela: parcelaMensal,
        juros: 0,
        amortizacao: amort,
        saldoDevedor: saldo,
      })
    }
  } else {
    const i = taxaMensalFrac
    parcelaMensal = (vf * i) / (1 - Math.pow(1 + i, -n))
    let saldo = vf
    for (let mes = 1; mes <= n; mes++) {
      const juros = saldo * i
      const amort = parcelaMensal - juros
      saldo = Math.max(0, saldo - amort)
      totalJuros += juros
      parcelas.push({
        mes,
        parcela: parcelaMensal,
        juros,
        amortizacao: amort,
        saldoDevedor: saldo,
      })
    }
  }

  // última parcela absorve o resíduo de arredondamento
  const somaParcelas = parcelaMensal * (n - 1)
  const ultima = parcelas[parcelas.length - 1]
  if (ultima) {
    ultima.parcela = Math.max(0, vf - somaParcelas + (totalJuros > 0 ? (vf * taxaMensalFrac) : 0))
  }

  const totalPago = parcelaMensal * n
  return {
    valorVeiculo: valorFinanciado,
    entrada: 0,
    valorFinanciado: vf,
    taxaMensal: taxaMensalFrac,
    prazoMeses: n,
    parcelaMensal,
    totalPago,
    totalJuros,
    custoEfetivoTotal: totalPago,
    parcelas,
  }
}

/** Taxa média sugerida (% a.m.) para alguns bancos — referência, ajustável. */
export const TAXAS_SUGERIDAS: Record<string, number> = {
  santander: 1.99,
  bradesco: 1.89,
  itau: 1.99,
  bv: 2.09,
  caixa: 1.79,
  c6: 1.69,
}

/**
 * Wrapper de alto nível usado pelo card de projeção.
 * Recebe inputs "humanos" (texto) e devolve a projeção pronta.
 */
export function projetarQuitacao(args: {
  valorVeiculo: number
  entrada: number
  taxaPercent: number
  taxaPeriodicidade: 'mensal' | 'anual'
  prazoMeses: number
}): ProjecaoResult {
  const { valorVeiculo, entrada, taxaPercent, taxaPeriodicidade, prazoMeses } = args
  const valorFinanciado = Math.max(0, valorVeiculo - Math.max(0, entrada))
  const taxaMensalFrac =
    taxaPeriodicidade === 'anual'
      ? taxaAnualParaMensal(taxaPercent)
      : (Number.isFinite(taxaPercent) ? taxaPercent : 0) / 100

  const r = calcularPrice(valorFinanciado, taxaMensalFrac, prazoMeses)
  return {
    ...r,
    valorVeiculo,
    entrada,
    custoEfetivoTotal: r.totalPago + Math.max(0, entrada),
  }
}

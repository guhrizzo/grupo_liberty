// Encargos por atraso das cobranças (multa + juros diários).
//
// Estes valores são GRAVADOS em cada cobrança no momento da criação
// (`multaPct` / `jurosMensalPct`). Mudar aqui só afeta cobranças novas —
// as existentes mantêm a taxa com que foram contratadas. Cobranças criadas
// antes desta regra não têm os campos e não cobram encargos.

export const ENCARGOS_PADRAO = {
  /** Multa única, em % do valor em aberto, aplicada no 1º dia de atraso. */
  multaPct: 5,
  /** Juros simples, em % a cada `DIAS_MES_JUROS` dias, cobrados por dia. */
  jurosMensalPct: 10,
} as const

/** Base do pró-rata diário: 10% a.m. → 10% / 30 por dia. */
export const DIAS_MES_JUROS = 30

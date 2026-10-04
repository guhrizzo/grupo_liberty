// Cálculo de encargos por atraso de uma parcela (multa + juros compostos diários).
//
// Função pura — roda no servidor (actions, cron, e-mails) e no client (prévia
// do modal de pagamento). Nada de encargo é gravado no Firestore: tudo é
// derivado da parcela + pagamentos, então remover/editar um pagamento
// recalcula sozinho.
//
// Regra (ver docs/superpowers/specs/2026-09-24-encargos-atraso-design.md):
// - Multa única de `multaPct`% no 1º dia de atraso, sobre o saldo da parcela
//   naquele dia: pagamentos até o vencimento reduzem a base, os posteriores não.
// - Juros compostos ao dia (`jurosMensalPct`% / 30 por dia, capitalizados
//   diariamente: saldo × ((1 + taxa)^dias − 1)), só sobre o
//   saldo da parcela (nunca sobre a multa), contados do vencimento ou do
//   último pagamento.
// - Cada pagamento quita primeiro os encargos devidos até a data dele (multa,
//   depois juros) e o resto abate a parcela; os juros seguintes correm sobre o
//   saldo que sobrou da parcela (regra do Gustavo, 2026-10-03).
// - Sem carência: vencimento + 1 dia já cobra multa + 1 dia de juros.
// - Com `encargosDesde`, parcelas vencidas antes dessa data não têm encargos.

import { DIAS_MES_JUROS } from '@/constants/encargos'

const EPSILON = 0.01

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Dias de calendário entre duas datas `YYYY-MM-DD` (ate - de). Independe de fuso. */
export function diasEntre(de: string, ate: string): number {
  const [ya, ma, da] = de.split('-').map(Number)
  const [yb, mb, db] = ate.split('-').map(Number)
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000)
}

const FORMATADOR_DIA_SP = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Hoje (`YYYY-MM-DD`) no fuso do negócio — não usar o relógio UTC do servidor. */
export function hojeSaoPaulo(agora: Date = new Date()): string {
  return FORMATADOR_DIA_SP.format(agora)
}

export interface PagamentoEncargosInput {
  id: string
  valor: number
  data: string // YYYY-MM-DD
  criadoEm?: string
}

export interface CalcularEncargosInput {
  valorParcela: number
  dataVencimento: string // YYYY-MM-DD
  multaPct: number
  jurosMensalPct: number
  isento: boolean
  /**
   * Data de corte (`YYYY-MM-DD`): parcelas que venceram antes dela não têm
   * encargos. Usada nas cobranças antigas, que passaram a cobrar multa/juros
   * só das parcelas que vencem a partir dessa data. Ausente = sem corte.
   */
  encargosDesde?: string | null
  pagamentos: PagamentoEncargosInput[]
  /** Data até a qual os encargos são calculados (hoje, ou a data de um pagamento). */
  referencia: string // YYYY-MM-DD
}

/** Um trecho de juros: de uma data a outra, sobre o saldo da parcela naquele trecho. */
export interface PeriodoJuros {
  de: string // YYYY-MM-DD
  ate: string // YYYY-MM-DD
  dias: number
  /** Saldo da parcela sobre o qual os juros correram. */
  base: number
  valor: number
  /** `true` = trecho fechado por um pagamento; `false` = ainda correndo. */
  fechado: boolean
}

export interface DivisaoPagamento {
  pagamentoId: string
  paraEncargos: number
  paraPrincipal: number
}

export interface ResultadoEncargos {
  principalRestante: number
  principalPago: number
  encargosPendentes: number
  encargosPagos: number
  /** principalRestante + encargosPendentes — o que o cliente deve na referência. */
  totalDevido: number
  /** Multa total gerada (paga ou não). */
  multa: number
  /** Juros totais gerados até a referência (pagos ou não). */
  juros: number
  /** Dias entre o vencimento e a referência (0 se não venceu). */
  diasAtraso: number
  /** Dias de juros em aberto: desde o vencimento ou o último pagamento. */
  diasJuros: number
  /** Juros trecho a trecho (do vencimento até cada pagamento e até a referência). */
  periodosJuros: PeriodoJuros[]
  divisao: DivisaoPagamento[]
  /** Valor pago além do devido (> 0 indica pagamento maior que a dívida). */
  excedente: number
}

export function calcularEncargos(input: CalcularEncargosInput): ResultadoEncargos {
  const { valorParcela, dataVencimento, referencia } = input
  const antesDoCorte = !!input.encargosDesde && dataVencimento < input.encargosDesde
  const semEncargos = input.isento || antesDoCorte
  const multaPct = semEncargos ? 0 : Math.max(input.multaPct || 0, 0)
  const jurosMensalPct = semEncargos ? 0 : Math.max(input.jurosMensalPct || 0, 0)
  // Taxa diária em % arredondada a 2 casas: 10% a.m. → 0,33% ao dia exatos
  // (regra do Gustavo — não 0,3333…%).
  const taxaDia = Math.round((jurosMensalPct / DIAS_MES_JUROS) * 100) / 100 / 100

  let principal = valorParcela
  let principalPago = 0
  let encargosPagos = 0
  let excedente = 0
  // Multa: fixada no 1º dia de atraso sobre o saldo daquele dia (pagamentos
  // até o vencimento reduzem a base; os posteriores, não).
  let multa = 0
  let multaAplicada = false
  let multaPendente = 0
  // Juros correm sobre o saldo, a partir do vencimento ou do último pagamento.
  let jurosDesde = dataVencimento
  let jurosGerados = 0
  // Juros já acumulados até cada pagamento e ainda não pagos (não crescem mais).
  let jurosFixos = 0
  const divisao: DivisaoPagamento[] = []
  const periodosJuros: PeriodoJuros[] = []

  /** Registra o trecho de juros que vai de `jurosDesde` até `ate`. */
  function registrarPeriodo(ate: string, valor: number, fechado: boolean) {
    const dias = Math.max(diasEntre(jurosDesde, ate), 0)
    if (dias <= 0 || valor <= 0) return
    periodosJuros.push({ de: jurosDesde, ate, dias, base: round2(principal), valor, fechado })
  }

  function aplicarMulta(ate: string) {
    if (multaAplicada || diasEntre(dataVencimento, ate) <= 0) return
    multaAplicada = true
    if (principal > EPSILON) {
      multa = round2(principal * (multaPct / 100))
      multaPendente = multa
    }
  }

  function jurosAte(ate: string) {
    if (principal <= EPSILON || diasEntre(dataVencimento, ate) <= 0) return 0
    // Compostos ao dia (pedido do Gustavo, 2026-10-03) — nunca sobre a multa.
    const dias = Math.max(diasEntre(jurosDesde, ate), 0)
    return round2(principal * (Math.pow(1 + taxaDia, dias) - 1))
  }

  const ordenados = [...input.pagamentos].sort(
    (a, b) =>
      a.data.localeCompare(b.data) || (a.criadoEm ?? '').localeCompare(b.criadoEm ?? ''),
  )

  for (const pg of ordenados) {
    const valor = round2(pg.valor)
    aplicarMulta(pg.data)

    // Parcela já quitada: o pagamento só pode ir para encargos que ficaram.
    if (principal <= EPSILON) {
      const paraMulta = round2(Math.min(valor, multaPendente))
      multaPendente = round2(multaPendente - paraMulta)
      const paraJuros = round2(Math.min(valor - paraMulta, jurosFixos))
      jurosFixos = round2(jurosFixos - paraJuros)
      const paraEncargos = round2(paraMulta + paraJuros)
      encargosPagos += paraEncargos
      excedente = round2(excedente + valor - paraEncargos)
      divisao.push({ pagamentoId: pg.id, paraEncargos, paraPrincipal: 0 })
      continue
    }

    // O pagamento quita primeiro os encargos devidos até o dia — multa, juros
    // antigos ainda em aberto e juros do período — e o resto abate a parcela.
    const jurosDia = jurosAte(pg.data)
    registrarPeriodo(pg.data, jurosDia, true)
    let sobra = valor
    const paraMulta = round2(Math.min(sobra, multaPendente))
    multaPendente = round2(multaPendente - paraMulta)
    sobra = round2(sobra - paraMulta)
    const paraJurosAntigos = round2(Math.min(sobra, jurosFixos))
    jurosFixos = round2(jurosFixos - paraJurosAntigos)
    sobra = round2(sobra - paraJurosAntigos)
    const paraJuros = round2(Math.min(sobra, jurosDia))
    sobra = round2(sobra - paraJuros)
    const paraPrincipal = round2(Math.min(sobra, principal))
    sobra = round2(sobra - paraPrincipal)
    principal = round2(principal - paraPrincipal)
    const paraEncargos = round2(paraMulta + paraJurosAntigos + paraJuros)
    principalPago += paraPrincipal
    encargosPagos += paraEncargos
    excedente = round2(excedente + sobra)

    // Juros do período não cobertos ficam em aberto (sem novos juros sobre
    // eles). Daqui em diante os juros correm só sobre o saldo da parcela.
    jurosGerados += jurosDia
    jurosFixos = round2(jurosFixos + jurosDia - paraJuros)
    if (diasEntre(jurosDesde, pg.data) > 0) jurosDesde = pg.data
    divisao.push({ pagamentoId: pg.id, paraEncargos, paraPrincipal })
  }

  aplicarMulta(referencia)
  const jurosAbertos = jurosAte(referencia)
  registrarPeriodo(referencia, jurosAbertos, false)
  const principalRestante = Math.max(round2(principal), 0)
  const encargosPendentes = round2(multaPendente + jurosFixos + jurosAbertos)

  return {
    principalRestante,
    principalPago: round2(principalPago),
    encargosPendentes,
    encargosPagos: round2(encargosPagos),
    totalDevido: round2(principalRestante + encargosPendentes),
    multa: round2(multa),
    juros: round2(jurosGerados + jurosAbertos),
    diasAtraso: Math.max(diasEntre(dataVencimento, referencia), 0),
    diasJuros: taxaDia > 0 && principalRestante > EPSILON && diasEntre(dataVencimento, referencia) > 0
      ? Math.max(diasEntre(jurosDesde, referencia), 0)
      : 0,
    periodosJuros,
    divisao,
    excedente,
  }
}

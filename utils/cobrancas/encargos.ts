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
//   último pagamento. Pagamento parcial "zera" os juros até ele: eles
//   recomeçam sobre o saldo restante.
// - Cada pagamento abate primeiro a parcela; o que sobra paga a multa e depois
//   os juros. O pagamento que quita a parcela deixa em aberto a multa e os
//   juros do dia que não cobrir (regra do Gustavo, 2026-10-03).
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
  const taxaDia = jurosMensalPct / 100 / DIAS_MES_JUROS

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
  // Juros do dia em que a parcela foi quitada sem cobri-los (não crescem mais).
  let jurosFixos = 0
  const divisao: DivisaoPagamento[] = []

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

    // O pagamento abate primeiro a parcela; o que sobra paga a multa e depois
    // os juros devidos naquele dia.
    const jurosDia = jurosAte(pg.data)
    const paraPrincipal = round2(Math.min(valor, principal))
    let sobra = round2(valor - paraPrincipal)
    const paraMulta = round2(Math.min(sobra, multaPendente))
    multaPendente = round2(multaPendente - paraMulta)
    sobra = round2(sobra - paraMulta)
    const paraJuros = round2(Math.min(sobra, jurosDia))
    sobra = round2(sobra - paraJuros)
    principal = round2(principal - paraPrincipal)
    const paraEncargos = round2(paraMulta + paraJuros)
    principalPago += paraPrincipal
    encargosPagos += paraEncargos
    excedente = round2(excedente + sobra)

    if (principal <= EPSILON) {
      // Quitou a parcela: os juros do dia são devidos; o que não foi pago fica
      // em aberto (sem novos juros).
      jurosGerados += jurosDia
      jurosFixos = round2(jurosFixos + jurosDia - paraJuros)
    } else {
      // Pagamento parcial: os juros até aqui não são cobrados — recomeçam sobre
      // o saldo a partir desta data. A multa já fixada continua devida.
      if (diasEntre(jurosDesde, pg.data) > 0) jurosDesde = pg.data
    }
    divisao.push({ pagamentoId: pg.id, paraEncargos, paraPrincipal })
  }

  aplicarMulta(referencia)
  const jurosAbertos = jurosAte(referencia)
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
    divisao,
    excedente,
  }
}

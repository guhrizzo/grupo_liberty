// Cálculo de encargos por atraso de uma parcela (multa + juros simples diários).
//
// Função pura — roda no servidor (actions, cron, e-mails) e no client (prévia
// do modal de pagamento). Nada de encargo é gravado no Firestore: tudo é
// derivado da parcela + pagamentos, então remover/editar um pagamento
// recalcula sozinho.
//
// Regra (ver docs/superpowers/specs/2026-09-24-encargos-atraso-design.md):
// - Multa de `multaPct`% sobre o saldo em aberto da parcela (uma vez).
// - Juros simples de `jurosMensalPct`% a cada 30 dias, por dia, sobre o saldo
//   em aberto, contados do vencimento ou do último pagamento (o mais recente).
// - Cada pagamento abate primeiro a parcela; o que sobra paga a multa e os
//   juros do dia. Pagamento parcial "zera" os encargos até ele: eles recomeçam
//   sobre o saldo restante. O pagamento que quita a parcela deixa em aberto a
//   multa/juros do dia que não cobrir (regra do Gustavo, 2026-10-03).
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
  // Encargos que "viraram dívida": gerados no pagamento que quitou a parcela.
  let multaGerada = 0
  let jurosGerados = 0
  // Desses, o que ainda não foi pago (não correm mais juros sobre eles).
  let pendentesFixos = 0
  // Juros correm a partir do vencimento ou do último pagamento, o que for depois.
  let jurosDesde = dataVencimento
  const divisao: DivisaoPagamento[] = []

  /** Multa e juros sobre o saldo em aberto, de `jurosDesde` até `ate`. */
  function encargosAte(ate: string) {
    const dias = Math.max(diasEntre(jurosDesde, ate), 0)
    const atrasado = diasEntre(dataVencimento, ate) > 0
    if (!atrasado || principal <= EPSILON) return { multa: 0, juros: 0, dias }
    return {
      multa: round2(principal * (multaPct / 100)),
      juros: round2(principal * taxaDia * dias),
      dias,
    }
  }

  const ordenados = [...input.pagamentos].sort(
    (a, b) =>
      a.data.localeCompare(b.data) || (a.criadoEm ?? '').localeCompare(b.criadoEm ?? ''),
  )

  for (const pg of ordenados) {
    const valor = round2(pg.valor)

    // Parcela já quitada: o pagamento só pode ir para encargos que ficaram.
    if (principal <= EPSILON) {
      const paraEncargos = round2(Math.min(valor, pendentesFixos))
      pendentesFixos = round2(pendentesFixos - paraEncargos)
      encargosPagos += paraEncargos
      excedente = round2(excedente + valor - paraEncargos)
      divisao.push({ pagamentoId: pg.id, paraEncargos, paraPrincipal: 0 })
      continue
    }

    // O pagamento abate primeiro a parcela; o que sobra paga a multa e os
    // juros devidos naquele dia.
    const devidos = encargosAte(pg.data)
    const paraPrincipal = round2(Math.min(valor, principal))
    const sobra = round2(valor - paraPrincipal)
    const paraEncargos = round2(Math.min(sobra, devidos.multa + devidos.juros))
    principal = round2(principal - paraPrincipal)
    excedente = round2(excedente + sobra - paraEncargos)
    principalPago += paraPrincipal
    encargosPagos += paraEncargos

    if (principal <= EPSILON) {
      // Quitou a parcela: a multa e os juros do dia são devidos; o que não foi
      // pago agora fica em aberto (sem novos juros).
      multaGerada += devidos.multa
      jurosGerados += devidos.juros
      pendentesFixos = round2(pendentesFixos + devidos.multa + devidos.juros - paraEncargos)
    } else {
      // Pagamento parcial: os encargos até aqui não são cobrados — recomeçam
      // sobre o saldo restante a partir desta data.
      if (diasEntre(jurosDesde, pg.data) > 0) jurosDesde = pg.data
    }
    divisao.push({ pagamentoId: pg.id, paraEncargos, paraPrincipal })
  }

  const abertos = encargosAte(referencia)
  const principalRestante = Math.max(round2(principal), 0)
  const encargosPendentes = round2(abertos.multa + abertos.juros + pendentesFixos)

  return {
    principalRestante,
    principalPago: round2(principalPago),
    encargosPendentes,
    encargosPagos: round2(encargosPagos),
    totalDevido: round2(principalRestante + encargosPendentes),
    multa: round2(multaGerada + abertos.multa),
    juros: round2(jurosGerados + abertos.juros),
    diasAtraso: Math.max(diasEntre(dataVencimento, referencia), 0),
    diasJuros: abertos.dias,
    divisao,
    excedente,
  }
}

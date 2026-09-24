// Cálculo de encargos por atraso de uma parcela (multa + juros simples diários).
//
// Função pura — roda no servidor (actions, cron, e-mails) e no client (prévia
// do modal de pagamento). Nada de encargo é gravado no Firestore: tudo é
// derivado da parcela + pagamentos, então remover/editar um pagamento
// recalcula sozinho.
//
// Regra (ver docs/superpowers/specs/2026-09-24-encargos-atraso-design.md):
// - Multa única de `multaPct`% sobre o principal em aberto no 1º dia de atraso.
// - Juros simples de `jurosMensalPct`% a cada 30 dias, por dia, sobre o
//   principal ainda em aberto (sem juros sobre juros/multa).
// - Cada pagamento quita primeiro os encargos pendentes, depois o principal
//   (CC art. 354).
// - Sem carência: vencimento + 1 dia já cobra multa + 1 dia de juros.

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
  divisao: DivisaoPagamento[]
  /** Valor pago além do devido (> 0 indica pagamento maior que a dívida). */
  excedente: number
}

export function calcularEncargos(input: CalcularEncargosInput): ResultadoEncargos {
  const { valorParcela, dataVencimento, referencia } = input
  const multaPct = input.isento ? 0 : Math.max(input.multaPct || 0, 0)
  const jurosMensalPct = input.isento ? 0 : Math.max(input.jurosMensalPct || 0, 0)
  const taxaDia = jurosMensalPct / 100 / DIAS_MES_JUROS

  let principal = valorParcela
  let pendentes = 0
  let multa = 0
  let juros = 0
  let multaAplicada = false
  let jurosDesde = dataVencimento
  let principalPago = 0
  let encargosPagos = 0
  let excedente = 0
  const divisao: DivisaoPagamento[] = []

  function acumular(ate: string) {
    if (diasEntre(jurosDesde, ate) <= 0) return
    if (principal > EPSILON) {
      if (!multaAplicada) {
        const m = round2(principal * (multaPct / 100))
        multa += m
        pendentes += m
        multaAplicada = true
      }
      const j = round2(principal * taxaDia * diasEntre(jurosDesde, ate))
      juros += j
      pendentes += j
    }
    jurosDesde = ate
  }

  const ordenados = [...input.pagamentos].sort(
    (a, b) =>
      a.data.localeCompare(b.data) || (a.criadoEm ?? '').localeCompare(b.criadoEm ?? ''),
  )

  for (const pg of ordenados) {
    acumular(pg.data)
    const valor = round2(pg.valor)
    const paraEncargos = round2(Math.min(valor, pendentes))
    pendentes = round2(pendentes - paraEncargos)
    const paraPrincipal = round2(Math.min(valor - paraEncargos, principal))
    principal = round2(principal - paraPrincipal)
    excedente = round2(excedente + valor - paraEncargos - paraPrincipal)
    principalPago += paraPrincipal
    encargosPagos += paraEncargos
    divisao.push({ pagamentoId: pg.id, paraEncargos, paraPrincipal })
  }

  acumular(referencia)

  const principalRestante = Math.max(round2(principal), 0)
  const encargosPendentes = Math.max(round2(pendentes), 0)

  return {
    principalRestante,
    principalPago: round2(principalPago),
    encargosPendentes,
    encargosPagos: round2(encargosPagos),
    totalDevido: round2(principalRestante + encargosPendentes),
    multa: round2(multa),
    juros: round2(juros),
    diasAtraso: Math.max(diasEntre(dataVencimento, referencia), 0),
    divisao,
    excedente,
  }
}

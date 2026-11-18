// Cálculos do ponto — funções puras, sem acesso a banco (testáveis).

import { BATIDAS, FUSO_PONTO, OFFSET_PONTO, type Batida, type Batidas } from '@/constants/ponto'

/** Próxima batida esperada no dia, ou null se o dia já está completo. */
export function proximaBatida(batidas: Batidas): Batida | null {
  return BATIDAS.find((b) => !batidas[b]) ?? null
}

export function diaCompleto(batidas: Batidas): boolean {
  return BATIDAS.every((b) => !!batidas[b])
}

/** Minutos trabalhados no dia; null se o dia está incompleto. */
export function minutosTrabalhados(batidas: Batidas): number | null {
  if (!diaCompleto(batidas)) return null
  const t = (b: Batida) => new Date(batidas[b]!).getTime()
  const manha = t('saida_almoco') - t('entrada')
  const tarde = t('saida') - t('volta_almoco')
  if (manha < 0 || tarde < 0) return null
  return Math.round((manha + tarde) / 60000)
}

/** Saldo do dia (trabalhado − jornada); null se o dia está incompleto. */
export function saldoDia(batidas: Batidas, jornadaMin: number): number | null {
  const trab = minutosTrabalhados(batidas)
  return trab === null ? null : trab - jornadaMin
}

export interface DiaParaResumo {
  batidas: Batidas
  jornadaMin: number
}

export interface ResumoMes {
  trabalhadoMin: number
  saldoMin: number
  diasCompletos: number
  diasIncompletos: number
}

/** Soma o mês: só dias completos entram nas horas e no saldo. */
export function resumoMes(dias: DiaParaResumo[]): ResumoMes {
  const r: ResumoMes = { trabalhadoMin: 0, saldoMin: 0, diasCompletos: 0, diasIncompletos: 0 }
  for (const d of dias) {
    const trab = minutosTrabalhados(d.batidas)
    if (trab === null) {
      // Dia sem nenhuma batida não conta como incompleto.
      if (BATIDAS.some((b) => d.batidas[b])) r.diasIncompletos++
      continue
    }
    r.diasCompletos++
    r.trabalhadoMin += trab
    r.saldoMin += trab - d.jornadaMin
  }
  return r
}

/** Valida que as batidas presentes estão em ordem cronológica. */
export function batidasEmOrdem(batidas: Batidas): boolean {
  let anterior = -Infinity
  for (const b of BATIDAS) {
    const v = batidas[b]
    if (!v) continue
    const ms = new Date(v).getTime()
    if (Number.isNaN(ms) || ms < anterior) return false
    anterior = ms
  }
  return true
}

/** "8h30"; com `comSinal`, "+0h15" / "−1h00". */
export function formatarMinutos(min: number, comSinal = false): string {
  const abs = Math.abs(Math.round(min))
  const texto = `${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`
  if (!comSinal) return texto
  if (min === 0) return texto
  return `${min > 0 ? '+' : '−'}${texto}`
}

const FORMATADOR_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_PONTO,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** "HH:mm" no fuso do ponto. */
export function horaSP(iso: string): string {
  return FORMATADOR_HORA.format(new Date(iso))
}

/** Converte data (YYYY-MM-DD) + hora (HH:mm) de São Paulo em ISO UTC; null se inválido. */
export function isoDeDataHoraSP(data: string, hora: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null
  const d = new Date(`${data}T${hora}:00${OFFSET_PONTO}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Dias (YYYY-MM-DD) de um mês (YYYY-MM). */
export function diasDoMes(mes: string): string[] {
  const [ano, m] = mes.split('-').map(Number)
  const total = new Date(Date.UTC(ano, m, 0)).getUTCDate()
  return Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`)
}

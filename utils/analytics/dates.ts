// Chaves de data no fuso America/Sao_Paulo. O servidor (Vercel) roda em UTC,
// então `new Date().toISOString().slice(0,10)` viraria o dia às 21h. Estas
// funções garantem que "hoje" bate com o horário de Brasília.

const TZ = 'America/Sao_Paulo'

/** Ex.: "2026-09-10" (dia no fuso de São Paulo). */
export function dayKey(d: Date = new Date()): string {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** Ex.: "2026-09" (mês no fuso de São Paulo). */
export function monthKey(d: Date = new Date()): string {
  return dayKey(d).slice(0, 7)
}

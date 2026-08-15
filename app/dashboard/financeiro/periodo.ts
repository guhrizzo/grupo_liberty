// ─── Período (mês) do Financeiro ─────────────────────────────────────────────
// Helpers síncronos, usados no servidor (consulta) e no cliente (navegação e
// virada de mês). Ficam fora de `actions.ts` porque arquivos 'use server' só
// podem exportar funções async.

/**
 * Fuso do negócio.
 *
 * O campo `data` de uma transação é uma data local (YYYY-MM-DD) digitada no
 * Brasil — não um instante. Então "mês atual" e a virada da meia-noite do dia
 * 1 têm que ser calculados neste fuso, nunca em UTC: entre 21:00 e 23:59 do
 * último dia do mês, um servidor em UTC já está no mês seguinte e o painel
 * viraria três horas adiantado, mostrando um mês vazio para quem ainda está
 * fechando o anterior.
 */
export const FUSO_NEGOCIO = 'America/Sao_Paulo'

/** Mês no formato `YYYY-MM`. */
export type Mes = string

// 'en-CA' formata como YYYY-MM-DD, que é exatamente o formato gravado no banco.
const FORMATADOR_DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_NEGOCIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Data de hoje (`YYYY-MM-DD`) no fuso do negócio. */
export function hojeNoFuso(agora: Date = new Date()): string {
  return FORMATADOR_DIA.format(agora)
}

/** Mês corrente (`YYYY-MM`) no fuso do negócio. */
export function mesAtual(agora: Date = new Date()): Mes {
  return hojeNoFuso(agora).slice(0, 7)
}

export function ehMesValido(valor: unknown): valor is Mes {
  return typeof valor === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor)
}

/**
 * Primeiro e último dia do mês (`YYYY-MM-DD`), inclusive nas duas pontas.
 *
 * O `Date.UTC` aqui é só aritmética de calendário (dia 0 do mês seguinte = último
 * dia deste mês), não um instante no tempo — por isso não sofre com fuso.
 */
export function intervaloDoMes(mes: Mes): { inicio: string; fim: string } {
  const [ano, m] = mes.split('-').map(Number)
  const ultimoDia = new Date(Date.UTC(ano, m, 0)).getUTCDate()
  return {
    inicio: `${mes}-01`,
    fim: `${mes}-${String(ultimoDia).padStart(2, '0')}`,
  }
}

/** Avança (`delta > 0`) ou retrocede (`delta < 0`) meses, virando o ano sozinho. */
export function deslocarMes(mes: Mes, delta: number): Mes {
  const [ano, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(ano, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** `2026-08` → `Agosto de 2026`. */
export function rotuloMes(mes: Mes): string {
  const [ano, m] = mes.split('-').map(Number)
  const nome = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(ano, m - 1, 1)))
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`
}

/** `2026-08` → `ago/2026`. */
export function rotuloMesCurto(mes: Mes): string {
  const [ano, m] = mes.split('-').map(Number)
  const nome = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(ano, m - 1, 1)))
    .replace('.', '')
  return `${nome}/${ano}`
}

/**
 * Lista de meses de `do` até `ate` (inclusive), do mais recente para o mais
 * antigo. Usada para montar o seletor sem nenhuma leitura extra no banco.
 */
export function listarMeses(deMes: Mes, ateMes: Mes): Mes[] {
  const meses: Mes[] = []
  let cursor = ateMes
  // Guarda de sanidade: evita laço infinito se os limites vierem invertidos.
  for (let i = 0; i < 600 && cursor >= deMes; i++) {
    meses.push(cursor)
    cursor = deslocarMes(cursor, -1)
  }
  return meses
}

// Normalização dos dados de prospecção. Usado tanto no cliente (prévia da
// importação da planilha) quanto no servidor (saneamento antes de gravar).

import type { ProspeccaoInput } from './types'

/** Ordem das colunas da planilha do jurídico (usada na importação e na tabela). */
export const PROSPECCAO_COLUNAS: { key: keyof ProspeccaoInput; label: string }[] = [
  { key: 'numeroProcesso', label: 'Número do processo' },
  { key: 'comarca', label: 'Comarca' },
  { key: 'nomeExecutado', label: 'Nome do Executado' },
  { key: 'cpfCnpj', label: 'CPF/CNPJ' },
  { key: 'banco', label: 'Banco' },
  { key: 'veiculo', label: 'Veículo' },
  { key: 'anoModelo', label: 'Ano/Modelo' },
  { key: 'valorEntrada', label: 'Valor de Entrada' },
  { key: 'valorFinanciado', label: 'Valor Financiado' },
  { key: 'parcelasContrato', label: 'Quantidade de Parcelas do Contrato' },
  { key: 'parcelasPagas', label: 'Quantidade de Parcelas Pagas' },
  { key: 'ultimoMesPago', label: 'Último mês pago' },
  { key: 'valorParcela', label: 'Valor da Parcela' },
  { key: 'telefone1', label: 'Telefone 1' },
  { key: 'telefone2', label: 'Telefone 2' },
  { key: 'telefone3', label: 'Telefone 3' },
  { key: 'renegociacaoEm', label: 'Renegociação em' },
  { key: 'email', label: 'E-mail' },
  { key: 'endereco', label: 'Endereço' },
]

const MONEY_KEYS = new Set<keyof ProspeccaoInput>([
  'valorEntrada',
  'valorFinanciado',
  'valorParcela',
])
const INT_KEYS = new Set<keyof ProspeccaoInput>(['parcelasContrato', 'parcelasPagas'])

const MAX_LEN = 500

/** Texto livre: trim, limite de tamanho e "Não consta"/"-" viram vazio. */
export function limparTexto(v: unknown): string {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN)
  if (/^(n[ãa]o consta|-+|—)$/i.test(s)) return ''
  return s
}

/** "R$ 35.587,00" → 35587. Também aceita número já convertido. */
export function parseValor(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null
  const s = limparTexto(v).replace(/[R$\s]/g, '')
  if (!s) return null
  // pt-BR: ponto = milhar, vírgula = decimal.
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** "60 parcelas" → 60. */
export function parseInteiro(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? v : null
  const d = limparTexto(v).replace(/\D/g, '')
  if (!d) return null
  const n = Number(d.slice(0, 6))
  return Number.isFinite(n) ? n : null
}

/** Saneia um registro vindo do form ou da importação. */
export function normalizarProspeccao(raw: Partial<Record<keyof ProspeccaoInput, unknown>>): ProspeccaoInput {
  const out = {} as Record<keyof ProspeccaoInput, unknown>
  for (const { key } of PROSPECCAO_COLUNAS) {
    const v = raw[key]
    if (MONEY_KEYS.has(key)) out[key] = parseValor(v)
    else if (INT_KEYS.has(key)) out[key] = parseInteiro(v)
    else out[key] = limparTexto(v)
  }
  const r = out as unknown as ProspeccaoInput
  r.email = r.email.toLowerCase()
  return r
}

/**
 * Converte o texto colado da planilha (Excel/Sheets copiam células separadas
 * por TAB, uma linha por registro) em registros. Ignora a linha de cabeçalho
 * e linhas sem nome do executado.
 */
export function parseLinhasPlanilha(texto: string): ProspeccaoInput[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim())
  const out: ProspeccaoInput[] = []
  for (const linha of linhas) {
    const celulas = linha.split('\t')
    if (/^n[úu]mero do processo/i.test(celulas[0]?.trim() ?? '')) continue
    const raw: Partial<Record<keyof ProspeccaoInput, unknown>> = {}
    PROSPECCAO_COLUNAS.forEach(({ key }, i) => {
      raw[key] = celulas[i] ?? ''
    })
    const reg = normalizarProspeccao(raw)
    if (reg.nomeExecutado) out.push(reg)
  }
  return out
}

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
 * Quebra o texto colado do Excel/Sheets em linhas e células. Segue o formato
 * que as planilhas usam na área de transferência: células separadas por TAB,
 * e célula com quebra de linha, TAB ou aspas vem entre aspas (aspas internas
 * duplicadas). Sem isso, um Enter dentro de uma célula (cabeçalho com texto
 * quebrado, endereço em duas linhas) partia o registro e desalinhava tudo.
 */
export function lerTsv(texto: string): string[][] {
  const linhas: string[][] = []
  let linha: string[] = []
  let cel = ''
  let i = 0
  let inicioCelula = true
  while (i < texto.length) {
    const c = texto[i]
    if (inicioCelula && c === '"') {
      // Célula entre aspas: vai até a aspa de fechamento.
      i++
      while (i < texto.length) {
        if (texto[i] === '"') {
          if (texto[i + 1] === '"') {
            cel += '"'
            i += 2
            continue
          }
          i++
          break
        }
        cel += texto[i++]
      }
      inicioCelula = false
      continue
    }
    if (c === '\t') {
      linha.push(cel)
      cel = ''
      inicioCelula = true
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linha.push(cel)
      linhas.push(linha)
      linha = []
      cel = ''
      inicioCelula = true
    } else {
      cel += c
      inicioCelula = false
    }
    i++
  }
  if (cel || linha.length) {
    linha.push(cel)
    linhas.push(linha)
  }
  return linhas.filter((l) => l.some((x) => x.trim()))
}

function normalizarCabecalho(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Identifica a coluna pelo texto do cabeçalho (tolerante a acento/pontuação). */
function chaveDoCabecalho(celula: string): keyof ProspeccaoInput | null {
  const h = normalizarCabecalho(celula)
  if (!h) return null
  const w = ` ${h} `
  if (h.includes('renegocia')) return 'renegociacaoEm'
  if (h.includes('processo')) return 'numeroProcesso'
  if (h.includes('comarca')) return 'comarca'
  if (h.includes('executado') || h === 'nome') return 'nomeExecutado'
  if (h.includes('cpf') || h.includes('cnpj')) return 'cpfCnpj'
  if (h.includes('banco')) return 'banco'
  if (h.includes('veiculo')) return 'veiculo'
  if (h.includes('entrada')) return 'valorEntrada'
  if (h.includes('financiado')) return 'valorFinanciado'
  if (h.includes('parcela') && h.includes('paga')) return 'parcelasPagas'
  if (h.includes('parcela') && (h.includes('contrato') || h.includes('quantidade'))) {
    return 'parcelasContrato'
  }
  if (h.includes('parcela')) return 'valorParcela'
  if (h.includes('mes') && h.includes('pago')) return 'ultimoMesPago'
  if (w.includes(' ano ') || h.includes('modelo')) return 'anoModelo'
  if (h.includes('telefone') || h.includes('celular') || h.includes('fone')) {
    if (h.endsWith('2')) return 'telefone2'
    if (h.endsWith('3')) return 'telefone3'
    return 'telefone1'
  }
  if (h.includes('mail')) return 'email'
  if (h.includes('endereco')) return 'endereco'
  return null
}

/** Se a linha for o cabeçalho, devolve índice da célula → coluna. */
function mapaCabecalho(celulas: string[]): Map<number, keyof ProspeccaoInput> | null {
  const mapa = new Map<number, keyof ProspeccaoInput>()
  const usadas = new Set<keyof ProspeccaoInput>()
  celulas.forEach((c, i) => {
    let k = chaveDoCabecalho(c)
    // "Telefone" repetido sem número vira o próximo telefone livre.
    if (k === 'telefone1' && usadas.has('telefone1')) {
      k = usadas.has('telefone2') ? 'telefone3' : 'telefone2'
    }
    if (k && !usadas.has(k)) {
      mapa.set(i, k)
      usadas.add(k)
    }
  })
  return usadas.has('nomeExecutado') && usadas.size >= 5 ? mapa : null
}

export interface ResultadoPlanilha {
  registros: ProspeccaoInput[]
  /** true quando as colunas foram casadas pelo nome do cabeçalho. */
  porCabecalho: boolean
  /** Linhas descartadas (sem nome do executado). */
  ignoradas: number
}

/**
 * Converte o texto colado da planilha em registros. Com o cabeçalho junto, as
 * colunas são casadas pelo nome (ordem e colunas extras não importam); sem
 * ele, pela posição na ordem de PROSPECCAO_COLUNAS.
 */
export function parseLinhasPlanilha(texto: string): ResultadoPlanilha {
  const linhas = lerTsv(texto)
  let mapa: Map<number, keyof ProspeccaoInput> | null = null
  const registros: ProspeccaoInput[] = []
  let ignoradas = 0

  for (let celulas of linhas) {
    const cab = mapaCabecalho(celulas)
    if (cab) {
      mapa = cab
      continue
    }
    const raw: Partial<Record<keyof ProspeccaoInput, unknown>> = {}
    if (mapa) {
      for (const [i, key] of mapa) raw[key] = celulas[i] ?? ''
    } else {
      // Sem cabeçalho: descarta colunas vazias sobrando à esquerda (seleção
      // que começou uma coluna antes).
      while (celulas.length > PROSPECCAO_COLUNAS.length && !celulas[0].trim()) {
        celulas = celulas.slice(1)
      }
      PROSPECCAO_COLUNAS.forEach(({ key }, i) => {
        raw[key] = celulas[i] ?? ''
      })
    }
    const reg = normalizarProspeccao(raw)
    if (reg.nomeExecutado) registros.push(reg)
    else ignoradas++
  }
  return { registros, porCabecalho: !!mapa, ignoradas }
}

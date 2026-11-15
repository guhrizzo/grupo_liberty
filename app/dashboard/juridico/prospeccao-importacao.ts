// Importação de planilha de leads: mapa de colunas (com correção manual na
// prévia) e classificação de cada linha em novo / duplicado / divergente.
// Lógica pura: usada pelo modal (prévia) e pelo servidor (reclassifica antes
// de gravar — fonte da verdade).

import { ORDEM_POSICIONAL, mapaCabecalho, normalizarProspeccao } from './prospeccao-parse'
import type { ProspeccaoInput } from './types'

export type Campo = keyof ProspeccaoInput

/** Índice da coluna da planilha → campo do lead (null = coluna ignorada). */
export type MapaColunas = (Campo | null)[]

export interface LeituraMatriz {
  /** Linhas de dados (sem o cabeçalho), todas com a mesma largura. */
  matriz: string[][]
  /** Títulos originais das colunas, se a planilha tiver cabeçalho. */
  cabecalho: string[] | null
  /** Mapa detectado automaticamente. */
  mapa: MapaColunas
  porCabecalho: boolean
}

/** Célula do Excel (número, data, texto) → texto que o normalizador entende. */
export function celulaParaTexto(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return ''
    const dd = String(v.getDate()).padStart(2, '0')
    const mm = String(v.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}/${v.getFullYear()}`
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return ''
    // Inteiro (CPF, telefone): sem notação científica. Decimal: pt-BR, sem
    // separador de milhar, para o parseValor ler vírgula como decimal.
    if (Number.isInteger(v)) return v.toFixed(0)
    return v.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 10 })
  }
  return String(v)
}

const vazia = (c: string | undefined) => !String(c ?? '').trim()

/**
 * Lê a matriz de células (do arquivo ou do colar): acha o cabeçalho (em
 * qualquer linha; o que estiver acima é título e é descartado), descarta
 * linhas vazias e colunas vazias no fim. Sem cabeçalho, usa a ordem
 * posicional da tabela.
 */
export function lerMatriz(linhas: string[][]): LeituraMatriz {
  let cabecalho: string[] | null = null
  let mapaDetectado: Map<number, Campo> | null = null
  let inicio = 0
  for (let i = 0; i < linhas.length; i++) {
    const m = mapaCabecalho(linhas[i])
    if (m) {
      cabecalho = linhas[i]
      mapaDetectado = m
      inicio = i + 1
      break
    }
  }

  let dados = linhas.slice(inicio).filter((l) => l.some((c) => !vazia(c)))

  // Largura: última coluna com conteúdo (nos dados ou no cabeçalho).
  let largura = 0
  for (const l of [...dados, ...(cabecalho ? [cabecalho] : [])]) {
    for (let j = l.length - 1; j >= largura; j--) {
      if (!vazia(l[j])) {
        largura = j + 1
        break
      }
    }
  }

  if (!cabecalho) {
    // Seleção que começou uma coluna antes: descarta colunas vazias à esquerda.
    while (largura > ORDEM_POSICIONAL.length && dados.every((l) => vazia(l[0]))) {
      dados = dados.map((l) => l.slice(1))
      largura--
    }
  }

  const matriz = dados.map((l) => Array.from({ length: largura }, (_, j) => String(l[j] ?? '')))
  const mapa: MapaColunas = Array.from({ length: largura }, (_, j) =>
    mapaDetectado ? (mapaDetectado.get(j) ?? null) : (ORDEM_POSICIONAL[j] ?? null),
  )
  return {
    matriz,
    cabecalho: cabecalho ? Array.from({ length: largura }, (_, j) => String(cabecalho![j] ?? '')) : null,
    mapa,
    porCabecalho: !!cabecalho,
  }
}

/** Atribui um campo a uma coluna; se outro coluna tinha o campo, ela passa a ser ignorada. */
export function trocarCampo(mapa: MapaColunas, coluna: number, campo: Campo | null): MapaColunas {
  return mapa.map((c, j) => (j === coluna ? campo : campo !== null && c === campo ? null : c))
}

/** Matriz + mapa → registros normalizados. Linhas sem nome do executado são ignoradas. */
export function aplicarMapa(
  matriz: string[][],
  mapa: MapaColunas,
): { registros: ProspeccaoInput[]; ignoradas: number } {
  const registros: ProspeccaoInput[] = []
  let ignoradas = 0
  for (const linha of matriz) {
    const raw: Partial<Record<Campo, unknown>> = {}
    mapa.forEach((campo, j) => {
      if (campo) raw[campo] = linha[j] ?? ''
    })
    const reg = normalizarProspeccao(raw)
    if (reg.nomeExecutado) registros.push(reg)
    else ignoradas++
  }
  return { registros, ignoradas }
}

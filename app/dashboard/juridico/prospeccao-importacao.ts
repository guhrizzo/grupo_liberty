// Importação de planilha de leads: mapa de colunas (com correção manual na
// prévia) e classificação de cada linha em novo / duplicado / divergente.
// Lógica pura: usada pelo modal (prévia) e pelo servidor (reclassifica antes
// de gravar — fonte da verdade).

import {
  ORDEM_POSICIONAL,
  chavesDuplicidade,
  mapaCabecalho,
  normalizarProspeccao,
} from './prospeccao-parse'
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

/**
 * CPF/CNPJ salvo como número no Excel perde os zeros à esquerda. Só mexe em
 * valor só de dígitos: 9–10 dígitos volta a CPF (11), 12–13 a CNPJ (14).
 * Vale só na importação da planilha: no cadastro manual um dígito a menos é
 * erro de digitação e não pode ser "completado".
 */
function completarZerosDocumento(doc: string): string {
  if (!/^\d+$/.test(doc)) return doc
  if (doc.length === 9 || doc.length === 10) return doc.padStart(11, '0')
  if (doc.length === 12 || doc.length === 13) return doc.padStart(14, '0')
  return doc
}

/**
 * Matriz + mapa → registros normalizados. Linhas sem nome do executado são
 * ignoradas. `origem[i]` é a linha da matriz do registro i (estável quando o
 * usuário troca colunas — usada para manter as confirmações da prévia).
 */
export function aplicarMapa(
  matriz: string[][],
  mapa: MapaColunas,
): { registros: ProspeccaoInput[]; origem: number[]; ignoradas: number } {
  const registros: ProspeccaoInput[] = []
  const origem: number[] = []
  let ignoradas = 0
  matriz.forEach((linha, l) => {
    const raw: Partial<Record<Campo, unknown>> = {}
    mapa.forEach((campo, j) => {
      if (campo) raw[campo] = linha[j] ?? ''
    })
    const reg = normalizarProspeccao(raw)
    reg.cpfCnpj = completarZerosDocumento(reg.cpfCnpj)
    if (reg.nomeExecutado) {
      registros.push(reg)
      origem.push(l)
    } else ignoradas++
  })
  return { registros, origem, ignoradas }
}

const CAMPOS_NUMERICOS_TEXTO: Campo[] = ['cpfCnpj', 'telefone1', 'telefone2', 'telefone3']

export interface CelulaSuspeita {
  linha: number
  coluna: number
  campo: Campo
  valor: string
}

/**
 * CPF/CNPJ ou telefone que o Excel guardou em notação científica
 * ("1,23457E+10"): os dígitos originais se perderam e não dá para recuperar.
 */
export function celulasNotacaoCientifica(matriz: string[][], mapa: MapaColunas): CelulaSuspeita[] {
  const out: CelulaSuspeita[] = []
  matriz.forEach((linha, l) => {
    mapa.forEach((campo, j) => {
      if (!campo || !CAMPOS_NUMERICOS_TEXTO.includes(campo)) return
      const valor = String(linha[j] ?? '').trim()
      if (/^\d+([.,]\d+)?e\+?\d+$/i.test(valor)) out.push({ linha: l, coluna: j, campo, valor })
    })
  })
  return out
}

// ─── Classificação: novo / duplicado / divergente ──────────────────────────

/** Campos importantes para a prospecção (telefones são comparados à parte). */
export const CAMPOS_COMPARADOS: Campo[] = [
  'nomeExecutado',
  'cpfCnpj',
  'placa',
  'numeroProcesso',
  'comarca',
  'endereco',
  'veiculo',
  'anoModelo',
  'banco',
  'valorEntrada',
  'valorFinanciado',
  'valorParcela',
]

export type CampoDivergente = Campo | 'telefones'
export type Classe = 'novo' | 'duplicado' | 'divergente'
export type Ref = { tipo: 'existente'; id: string } | { tipo: 'linha'; indice: number }

export interface Correspondencia {
  ref: Ref
  divergencias: CampoDivergente[]
}

export interface LinhaClassificada {
  indice: number
  registro: ProspeccaoInput
  classe: Classe
  correspondencias: Correspondencia[]
}

/** Sem acento, minúsculas, só letras e números. */
function normalizarComparacao(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function telefones(d: ProspeccaoInput): string[] {
  return [d.telefone1, d.telefone2, d.telefone3].map((t) => t.replace(/\D/g, '')).filter(Boolean)
}

/**
 * Campos em que a linha nova traz algo diferente do lead atual. Só conta o que
 * a planilha tem: vazio na planilha nunca diverge; preenchido na planilha e
 * vazio no cadastro diverge.
 */
export function divergencias(novo: ProspeccaoInput, atual: ProspeccaoInput): CampoDivergente[] {
  const out: CampoDivergente[] = []
  for (const campo of CAMPOS_COMPARADOS) {
    const n = novo[campo]
    const a = atual[campo]
    if (typeof n === 'number' || n === null) {
      if (n !== null && n !== a) out.push(campo)
      continue
    }
    const nn = normalizarComparacao(n)
    if (nn && nn !== normalizarComparacao(a)) out.push(campo)
  }
  const telNovos = telefones(novo)
  const telAtuais = new Set(telefones(atual))
  if (telNovos.length > 0 && !telNovos.some((t) => telAtuais.has(t))) out.push('telefones')
  return out
}

/**
 * Classifica cada linha contra os leads existentes e as linhas anteriores do
 * próprio arquivo (exceto as duplicadas). Correspondência = alguma chave de
 * chavesDuplicidade em comum. Duplicado se alguma correspondência não tem
 * divergência; divergente se todas têm.
 */
export function classificarLinhas(
  registros: ProspeccaoInput[],
  existentes: { id: string; dados: ProspeccaoInput }[],
): LinhaClassificada[] {
  const indice = new Map<string, { ref: Ref; dados: ProspeccaoInput }[]>()
  const indexar = (ref: Ref, dados: ProspeccaoInput) => {
    for (const k of chavesDuplicidade(dados)) {
      const lista = indice.get(k)
      if (lista) lista.push({ ref, dados })
      else indice.set(k, [{ ref, dados }])
    }
  }
  for (const e of existentes) indexar({ tipo: 'existente', id: e.id }, e.dados)

  const chaveRef = (r: Ref) => (r.tipo === 'existente' ? `e:${r.id}` : `l:${r.indice}`)

  return registros.map((registro, i) => {
    const vistos = new Set<string>()
    const correspondencias: Correspondencia[] = []
    for (const k of chavesDuplicidade(registro)) {
      for (const c of indice.get(k) ?? []) {
        const id = chaveRef(c.ref)
        if (vistos.has(id)) continue
        vistos.add(id)
        correspondencias.push({ ref: c.ref, divergencias: divergencias(registro, c.dados) })
      }
    }
    const classe: Classe =
      correspondencias.length === 0
        ? 'novo'
        : correspondencias.some((c) => c.divergencias.length === 0)
          ? 'duplicado'
          : 'divergente'
    if (classe !== 'duplicado') indexar({ tipo: 'linha', indice: i }, registro)
    return { indice: i, registro, classe, correspondencias }
  })
}

/** Índices que podem ser gravados: novos + divergentes confirmados. */
export function linhasParaGravar(classificadas: LinhaClassificada[], confirmados: Set<number>): number[] {
  return classificadas
    .filter((l) => l.classe === 'novo' || (l.classe === 'divergente' && confirmados.has(l.indice)))
    .map((l) => l.indice)
}

/** O lead e todos os ligados a ele, direta ou indiretamente, nos dois sentidos. */
export function grupoVinculado(
  id: string,
  itens: { id: string; vinculados: string[] }[],
): Set<string> {
  const existe = new Set(itens.map((x) => x.id))
  const vizinhos = new Map<string, Set<string>>()
  const ligar = (a: string, b: string) => {
    if (!vizinhos.has(a)) vizinhos.set(a, new Set())
    vizinhos.get(a)!.add(b)
  }
  for (const x of itens) {
    for (const v of x.vinculados) {
      if (!existe.has(v) || v === x.id) continue
      ligar(x.id, v)
      ligar(v, x.id)
    }
  }
  const grupo = new Set<string>([id])
  const fila = [id]
  while (fila.length) {
    for (const v of vizinhos.get(fila.shift()!) ?? []) {
      if (!grupo.has(v)) {
        grupo.add(v)
        fila.push(v)
      }
    }
  }
  return grupo
}

/**
 * Agrupa itens em lotes cujo custo somado não passa do limite, sem nunca
 * separar um item entre lotes (cada lote do Firestore é tudo-ou-nada: assim
 * uma linha e suas ligações entram ou falham juntas).
 */
export function agruparEmLotes<T>(itens: T[], custo: (t: T) => number, limite: number): T[][] {
  const lotes: T[][] = []
  let atual: T[] = []
  let soma = 0
  for (const item of itens) {
    const c = custo(item)
    if (atual.length > 0 && soma + c > limite) {
      lotes.push(atual)
      atual = []
      soma = 0
    }
    atual.push(item)
    soma += c
  }
  if (atual.length > 0) lotes.push(atual)
  return lotes
}

/**
 * Ids que o filtro "relacionados" mostra, ou null sem filtro. Se o lead do
 * filtro não existe mais (foi excluído), o filtro se desliga — senão a lista
 * ficaria vazia.
 */
export function grupoRelacionados(
  id: string | null,
  itens: { id: string; vinculados: string[] }[],
): Set<string> | null {
  if (!id || !itens.some((x) => x.id === id)) return null
  return grupoVinculado(id, itens)
}

// Apoio ao texto dos contratos gerados: números, valores e datas por extenso, e
// lacunas ("[campo]") para o que o formulário ainda não preencheu — a prévia
// destaca essas lacunas, e o PDF só sai com o formulário completo (validado antes).

import { numeroDe } from './types'

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const r = n % 100
  const partes: string[] = []
  if (c) partes.push(CENTENAS[c])
  if (r) {
    if (r < 20) partes.push(UNIDADES[r])
    else partes.push(DEZENAS[Math.floor(r / 10)] + (r % 10 ? ` e ${UNIDADES[r % 10]}` : ''))
  }
  return partes.join(' e ')
}

export function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero'
  const milhoes = Math.floor(n / 1_000_000)
  const milhares = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const blocos: { texto: string; valor: number }[] = []
  if (milhoes) blocos.push({ texto: milhoes === 1 ? 'um milhão' : `${ate999(milhoes)} milhões`, valor: 1000000 })
  if (milhares) blocos.push({ texto: milhares === 1 ? 'mil' : `${ate999(milhares)} mil`, valor: milhares * 1000 })
  if (resto) blocos.push({ texto: ate999(resto), valor: resto })
  // "e" antes do último bloco quando ele é < 100 ou múltiplo de 100.
  const ultimo = blocos[blocos.length - 1]
  const usaE = blocos.length > 1 && (ultimo.valor % 1000 < 100 || ultimo.valor % 100 === 0)
  const textos = blocos.map((b) => b.texto)
  if (!usaE) return textos.join(' ')
  const fim = textos.pop() as string
  return `${textos.join(' ')} e ${fim}`
}

/** 1234.5 → "mil duzentos e trinta e quatro reais e cinquenta centavos". */
export function reaisPorExtenso(valor: number): string {
  const cents = Math.round(valor * 100)
  const reais = Math.floor(cents / 100)
  const centavos = cents % 100
  const partes: string[] = []
  if (reais > 0 || centavos === 0) partes.push(`${inteiroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`)
  if (centavos > 0) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  return partes.join(' e ')
}

export function brl(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

/** Lacuna a preencher: aparece como "[rótulo]" no texto. */
export const lacuna = (rotulo: string) => `[${rotulo}]`

/** "R$ 1.234,56 (mil duzentos e trinta e quatro reais e cinquenta e seis centavos)". */
export function dinheiro(raw: string, rotulo = 'valor'): string {
  const v = numeroDe(raw)
  return v >= 0 ? `${brl(v)} (${reaisPorExtenso(v)})` : lacuna(rotulo)
}

/** "12 (doze) meses". */
export function meses(raw: string, rotulo = 'prazo em meses'): string {
  if (!/^[1-9]\d*$/.test(raw.trim())) return lacuna(rotulo)
  const n = Number(raw)
  return `${n} (${inteiroPorExtenso(n)}) ${n === 1 ? 'mês' : 'meses'}`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function dataPorExtenso(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

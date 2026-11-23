export const SITUACOES_OPCAO = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'publicada', label: 'Publicada' },
  { value: 'arquivada', label: 'Arquivada' },
] as const

export const TIPOS_MOVIMENTO = [
  { value: 'aporte', label: 'Aporte registrado' },
  { value: 'resgate', label: 'Resgate registrado' },
  { value: 'resultado', label: 'Resultado informado' },
  { value: 'ajuste', label: 'Ajuste de saldo' },
] as const

export type SituacaoOpcao = (typeof SITUACOES_OPCAO)[number]['value']
export type TipoMovimento = (typeof TIPOS_MOVIMENTO)[number]['value']
export type SituacaoPosicao = 'ativa' | 'encerrada'

export interface OpcaoInvestimento {
  nome: string
  categoria: string
  descricao: string
  prazo: string
  liquidez: string
  riscos: string
  condicoes: string
  situacao: SituacaoOpcao
  atualizadaEm: string
}

export interface TotaisInvestimento {
  aportes: number
  resgates: number
  resultado: number
  ajustes: number
  saldo: number
}

export interface PosicaoInvestimento {
  documento: string
  nomeCliente: string
  opcaoId: string
  opcaoNome: string
  opcaoRegistrada?: Pick<OpcaoInvestimento, 'categoria' | 'prazo' | 'liquidez' | 'riscos' | 'condicoes'>
  referencia: string
  situacao: SituacaoPosicao
  abertura: string
  dataBase: string
  totais: TotaisInvestimento
  atualizadaEm: string
}

export interface MovimentoInvestimento {
  tipo: TipoMovimento | 'estorno'
  valor: number
  delta: TotaisInvestimento
  data: string
  descricao: string
  registradoEm: string
  estornoDe?: string
  estornadoPor?: string
}

export const idInvestimentoValido = (valor: unknown): valor is string =>
  typeof valor === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(valor)

export function hojeInvestimento() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export function dataInvestimentoValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor > hojeInvestimento()) return false
  const data = new Date(`${valor}T12:00:00Z`)
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor
}

/** Moeda brasileira digitada como texto. Retorna centavos inteiros. */
export function centavosInvestimento(valor: string): number | null {
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(valor)) return null
  const negativo = valor.startsWith('-')
  const [reais, fracao] = valor.replace(/[-.]/g, '').split(',')
  const centavos = Number(reais) * 100 + Number((fracao ?? '').padEnd(2, '0'))
  if (!Number.isSafeInteger(centavos)) return null
  return negativo ? -centavos : centavos
}

const moedaInvestimento = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarCentavosInvestimento(valor: number | bigint) {
  const centavos = BigInt(valor)
  const zero = BigInt(0)
  const cem = BigInt(100)
  const absoluto = centavos < zero ? -centavos : centavos
  const inteiro = absoluto / cem
  const reais = centavos < zero ? (inteiro === zero ? -0 : -inteiro) : inteiro
  const fracao = String(absoluto % cem).padStart(2, '0')
  return moedaInvestimento.formatToParts(reais).map((parte) => parte.type === 'fraction' ? fracao : parte.value).join('')
}

export const totaisZerados = (): TotaisInvestimento => ({ aportes: 0, resgates: 0, resultado: 0, ajustes: 0, saldo: 0 })

export function deltaMovimento(tipo: TipoMovimento, valor: number) {
  if (!Number.isSafeInteger(valor) || valor === 0 || ((tipo === 'aporte' || tipo === 'resgate') && valor < 0)) return null
  const delta = totaisZerados()
  if (tipo === 'aporte') delta.aportes = valor
  if (tipo === 'resgate') delta.resgates = valor
  if (tipo === 'resultado') delta.resultado = valor
  if (tipo === 'ajuste') delta.ajustes = valor
  delta.saldo = tipo === 'resgate' ? -valor : valor
  return delta
}

export function reverterDelta(delta: TotaisInvestimento): TotaisInvestimento {
  return { aportes: -delta.aportes, resgates: -delta.resgates, resultado: -delta.resultado, ajustes: -delta.ajustes, saldo: -delta.saldo }
}

export function aplicarDelta(totais: TotaisInvestimento, delta: TotaisInvestimento) {
  const novo = {
    aportes: totais.aportes + delta.aportes,
    resgates: totais.resgates + delta.resgates,
    resultado: totais.resultado + delta.resultado,
    ajustes: totais.ajustes + delta.ajustes,
    saldo: totais.saldo + delta.saldo,
  }
  if (!Object.values(novo).every(Number.isSafeInteger) || novo.saldo < 0 || novo.aportes < 0 || novo.resgates < 0) return null
  return novo
}

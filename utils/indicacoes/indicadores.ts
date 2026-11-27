import type { StatusIndicacao } from './modelo'

type Indicacao = {
  id: string
  criadoEm: string
  status: StatusIndicacao
  indicadorDocumento: string
  indicadorNome: string
}

export type OperacaoIndicada = {
  indicacaoId: string
  data: string
  tipo: 'compra' | 'venda'
  margemCentavos: number | null
}

const dataLocal = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
})

function diaLocal(valor: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor
  const data = new Date(valor)
  return Number.isFinite(data.getTime()) ? dataLocal.format(data) : ''
}

function resumir(indicacoes: Indicacao[], pagas: Map<string, number>, operacoes: Map<string, OperacaoIndicada[]>) {
  const ranking = new Map<string, { nome: string; indicacoes: number; convertidas: number; operacoes: number }>()
  let convertidas = 0
  let comOperacao = 0
  let compras = 0
  let vendas = 0
  let pagoCentavos = 0
  let margemCentavos = 0
  let vendasComMargem = 0

  for (const indicacao of indicacoes) {
    const linha = ranking.get(indicacao.indicadorDocumento) ?? {
      nome: indicacao.indicadorNome, indicacoes: 0, convertidas: 0, operacoes: 0,
    }
    linha.indicacoes++
    ranking.set(indicacao.indicadorDocumento, linha)
    pagoCentavos += pagas.get(indicacao.id) ?? 0
    if (indicacao.status !== 'convertida') continue
    linha.convertidas++
    convertidas++
    const cadastro = diaLocal(indicacao.criadoEm)
    const vinculadas = (operacoes.get(indicacao.id) ?? []).filter((op) => cadastro && diaLocal(op.data) >= cadastro)
    if (vinculadas.length) comOperacao++
    linha.operacoes += vinculadas.length
    for (const operacao of vinculadas) {
      if (operacao.tipo === 'compra') compras++
      else vendas++
      if (operacao.margemCentavos !== null) {
        vendasComMargem++
        margemCentavos += operacao.margemCentavos
      }
    }
  }

  return {
    total: indicacoes.length, convertidas, comOperacao, compras, vendas, vendasComMargem,
    totalPago: pagoCentavos / 100,
    custoAquisicao: comOperacao ? pagoCentavos / (100 * comOperacao) : null,
    margemVendas: vendasComMargem ? margemCentavos / 100 : null,
    ranking: [...ranking.values()].sort((a, b) => b.indicacoes - a.indicacoes || b.convertidas - a.convertidas || a.nome.localeCompare(b.nome, 'pt-BR')),
  }
}

export function gerarIndicadores(indicacoes: Indicacao[], pagamentos: { indicacaoId: string; valor: number }[], operacoes: OperacaoIndicada[]) {
  const pagas = new Map(pagamentos.map((r) => [r.indicacaoId, Math.round(r.valor * 100)]))
  const porIndicacao = new Map<string, OperacaoIndicada[]>()
  const porMes = new Map<string, Indicacao[]>()
  for (const operacao of operacoes) {
    const lista = porIndicacao.get(operacao.indicacaoId) ?? []
    lista.push(operacao)
    porIndicacao.set(operacao.indicacaoId, lista)
  }
  for (const indicacao of indicacoes) {
    const mes = diaLocal(indicacao.criadoEm).slice(0, 7)
    if (!mes) continue
    const lista = porMes.get(mes) ?? []
    lista.push(indicacao)
    porMes.set(mes, lista)
  }
  return [
    { periodo: '', ...resumir(indicacoes, pagas, porIndicacao) },
    ...[...porMes.entries()].sort(([a], [b]) => b.localeCompare(a))
      .map(([periodo, lista]) => ({ periodo, ...resumir(lista, pagas, porIndicacao) })),
  ]
}

export type Indicadores = ReturnType<typeof gerarIndicadores>

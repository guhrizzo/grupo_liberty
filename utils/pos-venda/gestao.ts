import { PERIODICIDADES, type Periodicidade } from './catalogo-modelo'
import {
  SERVICOS_POS_VENDA, nomeServico, pendentePosVenda, servicosInclusos,
  type ServicoIndividual, type ServicoPosVenda, type SituacaoPosVenda,
} from './modelo'

/** Cálculos do painel de gestão do pós-venda. Sem acesso a banco, roda no servidor e no navegador. */

export type CobrancaGestao = { id: string; vencimento: string; valor: number; status: string }
export type AndamentoGestao = { id: string; tipo: string; texto: string; em: string; responsavel: string }
export type ContratoGestao = {
  id: string
  veiculoId: string
  /** Identificador do cliente que não expõe o CPF. */
  clienteChave: string
  servico: ServicoPosVenda
  situacao: SituacaoPosVenda
  proposta: { valorCentavos: number; periodicidade?: Periodicidade } | null
  veiculo: string
  comprador: string
  atual: boolean
  criadoEm: string
  responsavel: string
  cobrancas: CobrancaGestao[]
  andamentos: AndamentoGestao[]
}
export type SemServicoGestao = { id: string; nome: string; comprador: string }

export type StatusGestao = 'ativo' | 'inadimplente' | 'solicitacao' | 'cancelado'
export const ROTULO_STATUS_GESTAO: Record<StatusGestao, string> = {
  ativo: 'Ativo', inadimplente: 'Inadimplente', solicitacao: 'Solicitação ou proposta', cancelado: 'Cancelado',
}

const MESES: Record<Periodicidade, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 }

export const statusGestao = (c: ContratoGestao): StatusGestao => {
  if (c.situacao === 'cancelado' || c.situacao === 'cancelando') return 'cancelado'
  if (c.situacao === 'ativo') return c.cobrancas.some((m) => m.status === 'OVERDUE') ? 'inadimplente' : 'ativo'
  return 'solicitacao'
}

/** Receita mensal equivalente em centavos. Só contratos vigentes (ativos ou inadimplentes) contam. */
export function receitaMensalCentavos(c: ContratoGestao) {
  const status = statusGestao(c)
  if (!c.atual || !c.proposta || (status !== 'ativo' && status !== 'inadimplente')) return 0
  return Math.round(c.proposta.valorCentavos / MESES[c.proposta.periodicidade ?? 'mensal'])
}

export type FiltrosGestao = { busca: string; servico: string; status: string; responsavel: string }

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function filtrarContratos<T extends ContratoGestao>(contratos: readonly T[], f: FiltrosGestao): T[] {
  const busca = semAcento(f.busca.trim())
  return contratos.filter((c) =>
    (!f.servico || c.servico === f.servico) &&
    (!f.status || statusGestao(c) === f.status) &&
    (!f.responsavel || c.responsavel === f.responsavel) &&
    (!busca || semAcento(`${c.comprador} ${c.veiculo}`).includes(busca)))
}

export type LinhaVencimento = {
  contratoId: string; comprador: string; veiculo: string; servico: ServicoPosVenda
  vencimento: string; valor: number; vencida: boolean
}

function somaDias(dia: string, dias: number) {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Resumo para os indicadores. `hoje` é AAAA-MM-DD. */
export function resumoGestao(contratos: readonly ContratoGestao[], hoje: string, janelaDias = 30, janelaRenovacaoDias = 60) {
  const porServico = new Map<ServicoPosVenda, { servico: ServicoPosVenda; nome: string; contratos: number; centavos: number }>()
  for (const s of SERVICOS_POS_VENDA) porServico.set(s.id, { servico: s.id, nome: s.nome, contratos: 0, centavos: 0 })
  const porCliente = new Map<string, { chave: string; nome: string; contratos: number; centavos: number }>()
  const contagem = { ativos: 0, inadimplentes: 0, cancelados: 0, solicitacoes: 0 }
  let totalCentavos = 0

  for (const c of contratos) {
    const status = statusGestao(c)
    if (status === 'ativo') contagem.ativos++
    else if (status === 'inadimplente') contagem.inadimplentes++
    else if (status === 'cancelado') contagem.cancelados++
    else contagem.solicitacoes++

    const centavos = receitaMensalCentavos(c)
    if (!centavos) continue
    totalCentavos += centavos
    const s = porServico.get(c.servico)!
    s.contratos++
    s.centavos += centavos
    const cli = porCliente.get(c.clienteChave) ?? { chave: c.clienteChave, nome: c.comprador, contratos: 0, centavos: 0 }
    cli.contratos++
    cli.centavos += centavos
    porCliente.set(c.clienteChave, cli)
  }

  const limite = somaDias(hoje, janelaDias)
  const limiteRenovacao = somaDias(hoje, janelaRenovacaoDias)
  const vencimentos: LinhaVencimento[] = []
  const renovacoes: LinhaVencimento[] = []
  for (const c of contratos) {
    if (!c.atual || c.situacao !== 'ativo') continue
    for (const m of c.cobrancas) {
      if (!pendentePosVenda(m.status)) continue
      const linha: LinhaVencimento = {
        contratoId: c.id, comprador: c.comprador, veiculo: c.veiculo, servico: c.servico,
        vencimento: m.vencimento, valor: m.valor, vencida: m.status === 'OVERDUE' || m.vencimento < hoje,
      }
      if (linha.vencida || m.vencimento <= limite) vencimentos.push(linha)
      // Renovação: próxima cobrança de um plano que não é mensal.
      if (c.proposta?.periodicidade && c.proposta.periodicidade !== 'mensal' && !linha.vencida && m.vencimento <= limiteRenovacao) {
        renovacoes.push(linha)
      }
    }
  }
  const porData = (a: LinhaVencimento, b: LinhaVencimento) => a.vencimento.localeCompare(b.vencimento)

  const reais = (centavos: number) => centavos / 100
  return {
    receitaMensal: reais(totalCentavos),
    receitaPorServico: [...porServico.values()].filter((s) => s.contratos > 0)
      .map((s) => ({ servico: s.servico, nome: s.nome, contratos: s.contratos, receita: reais(s.centavos) }))
      .sort((a, b) => b.receita - a.receita),
    receitaPorCliente: [...porCliente.values()].map((c) => ({ chave: c.chave, nome: c.nome, contratos: c.contratos, receita: reais(c.centavos) }))
      .sort((a, b) => b.receita - a.receita),
    contagem,
    vencimentos: vencimentos.sort(porData),
    renovacoes: renovacoes.sort(porData),
  }
}

/** Atendimentos (andamentos publicados) de todos os contratos, do mais recente ao mais antigo. */
export function atendimentosRecentes(contratos: readonly ContratoGestao[], limite = 40) {
  return contratos
    .flatMap((c) => c.andamentos.map((a) => ({ ...a, contratoId: c.id, comprador: c.comprador, veiculo: c.veiculo, servico: c.servico })))
    .sort((a, b) => b.em.localeCompare(a.em))
    .slice(0, limite)
}

export type Oportunidade = {
  veiculoId: string
  comprador: string
  veiculo: string
  tipo: 'sem_servico' | 'complementar' | 'reativar'
  sugestao: string
}

const INDIVIDUAIS: ServicoIndividual[] = ['juridico', 'quitacao', 'rastreamento']

/** Onde oferecer serviços: quem nunca contratou, quem tem só parte dos serviços e quem cancelou. */
export function oportunidades(contratos: readonly ContratoGestao[], semServico: readonly SemServicoGestao[]): Oportunidade[] {
  const lista: Oportunidade[] = []
  const porVeiculo = new Map<string, ContratoGestao[]>()
  for (const c of contratos) if (c.atual) porVeiculo.set(c.veiculoId, [...(porVeiculo.get(c.veiculoId) ?? []), c])

  for (const [veiculoId, doVeiculo] of porVeiculo) {
    const ativos = doVeiculo.filter((c) => c.situacao === 'ativo')
    const base = { veiculoId, comprador: doVeiculo[0].comprador, veiculo: doVeiculo[0].veiculo }
    if (ativos.length > 0) {
      const cobertos = new Set(ativos.flatMap((c) => [...servicosInclusos(c.servico)]))
      const faltam = INDIVIDUAIS.filter((s) => !cobertos.has(s))
      if (faltam.length > 0) {
        lista.push({ ...base, tipo: 'complementar', sugestao: `Oferecer: ${faltam.map((s) => nomeServico(s)).join(', ')}` })
      }
    } else if (doVeiculo.some((c) => c.situacao === 'cancelado') && !doVeiculo.some((c) => statusGestao(c) === 'solicitacao')) {
      lista.push({ ...base, tipo: 'reativar', sugestao: 'Contrato cancelado: oferecer a reativação' })
    }
  }

  const comContrato = new Set(porVeiculo.keys())
  for (const s of semServico) {
    if (comContrato.has(s.id)) continue
    lista.push({ veiculoId: s.id, comprador: s.comprador, veiculo: s.nome, tipo: 'sem_servico', sugestao: 'Nunca contratou: apresentar os serviços ou o pacote completo' })
  }
  return lista
}

export const rotuloPeriodicidade = (p: Periodicidade | undefined) => PERIODICIDADES[p ?? 'mensal'].por

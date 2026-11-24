import { describe, expect, it } from 'vitest'
import {
  atendimentosRecentes, filtrarContratos, oportunidades, receitaMensalCentavos, resumoGestao, statusGestao,
  type ContratoGestao,
} from './gestao'

let n = 0
const contrato = (extra: Partial<ContratoGestao> = {}): ContratoGestao => ({
  id: `c${++n}`, veiculoId: 'v1', clienteChave: 'cli1', servico: 'juridico', situacao: 'ativo',
  proposta: { valorCentavos: 10000, periodicidade: 'mensal' }, veiculo: 'Fiat Argo 2020', comprador: 'Maria Souza', atual: true,
  criadoEm: '2026-10-01T10:00:00Z', responsavel: '', cobrancas: [], andamentos: [], ...extra,
})
const hoje = '2026-11-24'

describe('status e receita', () => {
  it('classifica pelo estado do contrato e das cobranças', () => {
    expect(statusGestao(contrato())).toBe('ativo')
    expect(statusGestao(contrato({ cobrancas: [{ id: 'a', vencimento: '2026-11-01', valor: 100, status: 'OVERDUE' }] }))).toBe('inadimplente')
    expect(statusGestao(contrato({ situacao: 'proposta' }))).toBe('solicitacao')
    expect(statusGestao(contrato({ situacao: 'cancelando' }))).toBe('cancelado')
  })

  it('converte a receita para o equivalente mensal e ignora o que não é vigente', () => {
    expect(receitaMensalCentavos(contrato({ proposta: { valorCentavos: 120000, periodicidade: 'anual' } }))).toBe(10000)
    expect(receitaMensalCentavos(contrato({ proposta: { valorCentavos: 30000, periodicidade: 'trimestral' } }))).toBe(10000)
    expect(receitaMensalCentavos(contrato({ proposta: { valorCentavos: 9990 } }))).toBe(9990)
    expect(receitaMensalCentavos(contrato({ situacao: 'cancelado' }))).toBe(0)
    expect(receitaMensalCentavos(contrato({ atual: false }))).toBe(0)
    expect(receitaMensalCentavos(contrato({ situacao: 'proposta' }))).toBe(0)
  })
})

describe('resumo de gestão', () => {
  const lista = [
    contrato({ servico: 'juridico', proposta: { valorCentavos: 10000 } }),
    contrato({ servico: 'rastreamento', proposta: { valorCentavos: 5000 }, veiculoId: 'v2' }),
    contrato({ servico: 'pacote', clienteChave: 'cli2', comprador: 'João Lima', proposta: { valorCentavos: 120000, periodicidade: 'anual' },
      cobrancas: [{ id: 'p', vencimento: '2026-12-10', valor: 1200, status: 'PENDING' }], veiculoId: 'v3' }),
    contrato({ situacao: 'cancelado', proposta: { valorCentavos: 99900 } }),
    contrato({ situacao: 'solicitado', proposta: null }),
    contrato({ cobrancas: [{ id: 'o', vencimento: '2026-11-10', valor: 100, status: 'OVERDUE' }], veiculoId: 'v4' }),
  ]
  const r = resumoGestao(lista, hoje)

  it('soma receita mensal por serviço e por cliente', () => {
    expect(r.receitaMensal).toBe(100 + 50 + 100 + 100)
    expect(r.receitaPorServico.find((s) => s.servico === 'juridico')).toMatchObject({ contratos: 2, receita: 200 })
    expect(r.receitaPorServico.find((s) => s.servico === 'pacote')).toMatchObject({ receita: 100 })
    expect(r.receitaPorCliente[0]).toMatchObject({ chave: 'cli1', contratos: 3, receita: 250 })
  })

  it('conta contratos por situação', () => {
    expect(r.contagem).toEqual({ ativos: 3, inadimplentes: 1, cancelados: 1, solicitacoes: 1 })
  })

  it('lista vencimentos próximos e vencidos, e renovações de planos não mensais', () => {
    expect(r.vencimentos.map((v) => [v.vencimento, v.vencida])).toEqual([['2026-11-10', true], ['2026-12-10', false]])
    expect(r.renovacoes.map((v) => v.vencimento)).toEqual(['2026-12-10'])
  })
})

describe('filtros', () => {
  const lista = [
    contrato({ comprador: 'Maria Souza', servico: 'juridico', responsavel: 'Dra. Ana' }),
    contrato({ comprador: 'José Ângelo', servico: 'rastreamento', veiculo: 'VW Gol 2018' }),
  ]
  it('filtra por serviço, status, responsável e busca sem acento', () => {
    expect(filtrarContratos(lista, { busca: '', servico: 'rastreamento', status: '', responsavel: '' })).toHaveLength(1)
    expect(filtrarContratos(lista, { busca: 'jose angelo', servico: '', status: '', responsavel: '' })).toHaveLength(1)
    expect(filtrarContratos(lista, { busca: 'gol', servico: '', status: 'ativo', responsavel: '' })).toHaveLength(1)
    expect(filtrarContratos(lista, { busca: '', servico: '', status: '', responsavel: 'Dra. Ana' })).toHaveLength(1)
    expect(filtrarContratos(lista, { busca: '', servico: '', status: 'cancelado', responsavel: '' })).toHaveLength(0)
  })
})

describe('atendimentos e oportunidades', () => {
  it('junta os andamentos de todos os contratos, do mais recente ao mais antigo', () => {
    const lista = [
      contrato({ andamentos: [{ id: 'a', tipo: 'processo', texto: 'x', em: '2026-11-01', responsavel: '' }] }),
      contrato({ andamentos: [{ id: 'b', tipo: 'retorno_banco', texto: 'y', em: '2026-11-20', responsavel: '' }] }),
    ]
    expect(atendimentosRecentes(lista).map((a) => a.id)).toEqual(['b', 'a'])
    expect(atendimentosRecentes(lista, 1)).toHaveLength(1)
  })

  it('sugere complemento, reativação e primeira contratação', () => {
    const lista = [
      contrato({ veiculoId: 'v1', servico: 'juridico' }),
      contrato({ veiculoId: 'v2', servico: 'pacote', comprador: 'Completo' }),
      contrato({ veiculoId: 'v3', situacao: 'cancelado', comprador: 'Saiu' }),
    ]
    const o = oportunidades(lista, [{ id: 'v9', nome: 'Gol', comprador: 'Novo' }, { id: 'v1', nome: 'Argo', comprador: 'Maria' }])
    expect(o.find((x) => x.veiculoId === 'v1')).toMatchObject({ tipo: 'complementar' })
    expect(o.find((x) => x.veiculoId === 'v1')!.sugestao).toContain('Negociação de quitação')
    expect(o.find((x) => x.veiculoId === 'v2')).toBeUndefined()
    expect(o.find((x) => x.veiculoId === 'v3')).toMatchObject({ tipo: 'reativar' })
    expect(o.filter((x) => x.tipo === 'sem_servico').map((x) => x.veiculoId)).toEqual(['v9'])
  })
})

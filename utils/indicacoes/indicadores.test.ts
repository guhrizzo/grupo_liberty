import { expect, it } from 'vitest'
import { gerarIndicadores } from './indicadores'

it('agrupa pelo mês local da indicação e apura aquisição e margem pelas operações posteriores', () => {
  const [geral, novembro, outubro] = gerarIndicadores([
    { id: 'a', indicadorDocumento: '1', indicadorNome: 'Ana', status: 'convertida', criadoEm: '2026-11-01T01:59:00Z' },
    { id: 'b', indicadorDocumento: '1', indicadorNome: 'Ana', status: 'cadastrado', criadoEm: '2026-11-01T03:00:00Z' },
    { id: 'c', indicadorDocumento: '2', indicadorNome: 'Bia', status: 'convertida', criadoEm: '2026-11-01T03:00:00Z' },
  ], [
    { indicacaoId: 'a', valor: 150 },
  ], [
    { indicacaoId: 'a', data: '2026-10-30', tipo: 'venda', margemCentavos: 90_000 },
    { indicacaoId: 'a', data: '2026-10-31', tipo: 'compra', margemCentavos: null },
    { indicacaoId: 'a', data: '2026-11-02', tipo: 'venda', margemCentavos: -12_345 },
    { indicacaoId: 'c', data: '2026-11-03', tipo: 'venda', margemCentavos: null },
  ])

  expect(geral).toMatchObject({
    total: 3, convertidas: 2, comOperacao: 2, vendas: 2, compras: 1, vendasComMargem: 1,
    totalPago: 150, custoAquisicao: 75, margemVendas: -123.45,
    ranking: [{ nome: 'Ana', indicacoes: 2, convertidas: 1, operacoes: 2 }, { nome: 'Bia', indicacoes: 1, convertidas: 1, operacoes: 1 }],
  })
  expect(novembro).toMatchObject({ periodo: '2026-11', total: 2, totalPago: 0, margemVendas: null })
  expect(outubro).toMatchObject({ periodo: '2026-10', total: 1, vendas: 1, totalPago: 150 })
})

import { describe, expect, it } from 'vitest'
import { CATALOGO_PADRAO, normalizarCatalogo, planoDoServico, vencimentoSugerido } from './catalogo-modelo'

describe('catálogo de pós-venda', () => {
  it('traz um plano por serviço, disponível e sem preço definido', () => {
    expect(CATALOGO_PADRAO.map((p) => p.servico)).toEqual(['juridico', 'quitacao', 'rastreamento', 'pacote'])
    expect(CATALOGO_PADRAO.every((p) => p.disponivel && p.valorCentavos === null && p.periodicidade === 'mensal')).toBe(true)
  })

  it('completa com o padrão os serviços que faltam', () => {
    const catalogo = normalizarCatalogo([{ ...CATALOGO_PADRAO[0], valorCentavos: 9990, periodicidade: 'anual' }])
    expect(catalogo).toHaveLength(4)
    expect(planoDoServico(catalogo!, 'juridico')).toMatchObject({ valorCentavos: 9990, periodicidade: 'anual' })
    expect(planoDoServico(catalogo!, 'pacote')?.valorCentavos).toBeNull()
  })

  it('recusa serviço desconhecido, repetido ou dados inválidos', () => {
    const base = { ...CATALOGO_PADRAO[0] }
    expect(normalizarCatalogo([{ ...base, servico: 'inventado' }])).toBeNull()
    expect(normalizarCatalogo([base, base])).toBeNull()
    expect(normalizarCatalogo([{ ...base, valorCentavos: -5 }])).toBeNull()
    expect(normalizarCatalogo([{ ...base, valorCentavos: 10.5 }])).toBeNull()
    expect(normalizarCatalogo([{ ...base, periodicidade: 'diaria' }])).toBeNull()
    expect(normalizarCatalogo([{ ...base, diasAteVencimento: 0 }])).toBeNull()
    expect(normalizarCatalogo([{ ...base, nome: '  ' }])).toBeNull()
    expect(normalizarCatalogo('texto')).toBeNull()
  })

  it('só permite honorários de 20% em serviços com jurídico', () => {
    const catalogo = normalizarCatalogo(CATALOGO_PADRAO.map((p) => ({ ...p, honorarios20: true })))!
    expect(catalogo.map((p) => [p.servico, p.honorarios20])).toEqual([
      ['juridico', true], ['quitacao', false], ['rastreamento', false], ['pacote', true],
    ])
  })

  it('calcula o primeiro vencimento sugerido', () => {
    expect(vencimentoSugerido('2026-11-28', 5)).toBe('2026-12-03')
    expect(vencimentoSugerido('2026-12-30', 5)).toBe('2027-01-04')
  })
})

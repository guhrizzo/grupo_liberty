import { describe, expect, it } from 'vitest'
import { CONFIG_PADRAO, codigoIndicacaoValido, gerarCodigoIndicacao, normalizarConfig, valorRecompensa } from './modelo'

describe('recompensa por faixa', () => {
  it.each([[1, 150], [2, 150], [3, 200], [5, 200], [6, 250], [40, 250]])('indicação %i vale R$ %i', (ordem, valor) => {
    expect(valorRecompensa(CONFIG_PADRAO.faixas, ordem)?.valor).toBe(valor)
  })
})

describe('configuração de indicações', () => {
  it('aceita a configuração padrão', () => {
    expect(normalizarConfig(CONFIG_PADRAO)).toEqual(CONFIG_PADRAO)
  })

  it('exige faixas contíguas, começando na 1ª indicação e com a última sem limite', () => {
    const base = { ...CONFIG_PADRAO }
    expect(normalizarConfig({ ...base, faixas: [{ de: 2, ate: null, valor: 100 }] })).toBeNull()
    expect(normalizarConfig({ ...base, faixas: [{ de: 1, ate: 2, valor: 100 }, { de: 4, ate: null, valor: 100 }] })).toBeNull()
    expect(normalizarConfig({ ...base, faixas: [{ de: 1, ate: 2, valor: 100 }] })).toBeNull()
    expect(normalizarConfig({ ...base, faixas: [{ de: 1, ate: null, valor: 100 }, { de: 2, ate: null, valor: 90 }] })).toBeNull()
    expect(normalizarConfig({ ...base, faixas: [{ de: 1, ate: null, valor: 100 }] })).not.toBeNull()
  })

  it('recusa valores inválidos', () => {
    expect(normalizarConfig({ ...CONFIG_PADRAO, faixas: [{ de: 1, ate: null, valor: -1 }] })).toBeNull()
    expect(normalizarConfig({ ...CONFIG_PADRAO, validadeIndicacaoDias: -3 })).toBeNull()
    expect(normalizarConfig({ ...CONFIG_PADRAO, indicadoJaCadastrado: 'qualquer' })).toBeNull()
    expect(normalizarConfig(null)).toBeNull()
  })
})

describe('código de indicação', () => {
  it('gera códigos de 8 caracteres sem símbolos ambíguos', () => {
    for (let i = 0; i < 50; i++) expect(codigoIndicacaoValido(gerarCodigoIndicacao())).toBe(true)
    expect(codigoIndicacaoValido('ABC1DEFG')).toBe(false)
    expect(codigoIndicacaoValido('abcdefgh')).toBe(false)
  })
})

import { resumoFinanceiro, transicaoRecompensa, type LinhaRecompensa } from './modelo'

describe('transições da recompensa', () => {
  it('só avança pelo caminho pendente → liberada → paga', () => {
    expect(transicaoRecompensa('pendente', 'liberar')).toBe('liberada')
    expect(transicaoRecompensa('liberada', 'liberar')).toBeNull()
    expect(transicaoRecompensa('pendente', 'pagar')).toBeNull()
    expect(transicaoRecompensa('liberada', 'pagar')).toBe('paga')
  })

  it('não cancela nem altera uma recompensa já paga', () => {
    expect(transicaoRecompensa('paga', 'cancelar')).toBeNull()
    expect(transicaoRecompensa('paga', 'liberar')).toBeNull()
    expect(transicaoRecompensa('cancelada', 'liberar')).toBeNull()
    expect(transicaoRecompensa('pendente', 'cancelar')).toBe('cancelada')
  })
})

describe('resumo financeiro', () => {
  const linha = (id: string, doc: string, valor: number, status: LinhaRecompensa['status'], pagaEm: string | null = null): LinhaRecompensa => ({
    id, indicadorDocumento: doc, indicadorNome: `Cliente ${doc}`, indicadoNome: 'Fulano', ordem: 1, valor, status,
    criadoEm: '2026-11-01T10:00:00Z', liberadaEm: null, pagaEm, temComprovante: false,
  })

  it('soma por situação, ignora canceladas e agrupa por indicador', () => {
    const r = resumoFinanceiro([
      linha('a', '1', 150, 'paga', '2026-11-10'), linha('b', '1', 150, 'liberada'), linha('c', '2', 200.1, 'pendente'),
      linha('d', '2', 0.2, 'pendente'), linha('e', '2', 999, 'cancelada'),
    ])
    expect(r).toMatchObject({ gerado: 500.3, pendente: 200.3, liberado: 150, pago: 150 })
    expect(r.porIndicador.map((p) => [p.documento, p.quantidade, p.total, p.pago])).toEqual([['1', 2, 300, 150], ['2', 2, 200.3, 0]])
    expect(r.pagamentos.map((p) => p.id)).toEqual(['a'])
  })
})

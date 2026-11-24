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

import { describe, expect, it } from 'vitest'
import { normalizarProspeccao, parseLinhasPlanilha, parseValor } from './prospeccao-parse'
import { aplicarMapa, celulaParaTexto, lerMatriz, trocarCampo } from './prospeccao-importacao'

describe('celulaParaTexto', () => {
  it('inteiro grande vira texto sem notação científica', () => {
    expect(celulaParaTexto(12345678901)).toBe('12345678901')
    expect(celulaParaTexto(1.19e10)).toBe('11900000000')
  })
  it('decimal vira texto pt-BR (vírgula, sem milhar)', () => {
    expect(celulaParaTexto(35587.5)).toBe('35587,5')
  })
  it('data vira dd/mm/aaaa', () => {
    expect(celulaParaTexto(new Date(2024, 0, 31))).toBe('31/01/2024')
  })
  it('nulo vira vazio', () => {
    expect(celulaParaTexto(null)).toBe('')
    expect(celulaParaTexto(undefined)).toBe('')
  })
})

describe('normalizarProspeccao — CPF/CNPJ sem zeros à esquerda', () => {
  it('CPF com 10 dígitos volta a 11', () => {
    expect(normalizarProspeccao({ nomeExecutado: 'A', cpfCnpj: '1234567890' }).cpfCnpj).toBe('01234567890')
  })
  it('CNPJ com 13 dígitos volta a 14', () => {
    expect(normalizarProspeccao({ nomeExecutado: 'A', cpfCnpj: '1234567890123' }).cpfCnpj).toBe(
      '01234567890123',
    )
  })
  it('CPF com máscara fica como veio', () => {
    expect(normalizarProspeccao({ nomeExecutado: 'A', cpfCnpj: '123.456.789-01' }).cpfCnpj).toBe('123.456.789-01')
  })
})

describe('parseValor', () => {
  it('lê o decimal produzido por celulaParaTexto', () => {
    expect(parseValor(celulaParaTexto(35587.5))).toBe(35587.5)
  })
})

describe('lerMatriz', () => {
  it('acha o cabeçalho abaixo de linhas de título e descarta linhas vazias', () => {
    const r = lerMatriz([
      ['Relatório'],
      ['Nome do Executado', 'CPF', 'Placa', 'Banco', 'Comarca'],
      ['João', '123', 'ABC1D23', 'X', 'Y'],
      ['', '', '', '', ''],
    ])
    expect(r.porCabecalho).toBe(true)
    expect(r.matriz).toHaveLength(1)
    expect(r.mapa[0]).toBe('nomeExecutado')
    expect(r.cabecalho?.[2]).toBe('Placa')
  })
  it('sem cabeçalho usa a ordem posicional', () => {
    const r = lerMatriz([['123', 'Comarca X', 'Maria']])
    expect(r.porCabecalho).toBe(false)
    expect(r.cabecalho).toBeNull()
    expect(r.mapa).toEqual(['numeroProcesso', 'comarca', 'nomeExecutado'])
  })
  it('apara colunas vazias no fim', () => {
    const r = lerMatriz([
      ['Nome do Executado', 'CPF', 'Placa', 'Banco', 'Comarca', '', ''],
      ['João', '1', 'ABC1D23', 'X', 'Y', '', ''],
    ])
    expect(r.mapa).toHaveLength(5)
  })
})

describe('trocarCampo', () => {
  it('campo já usado sai da outra coluna', () => {
    expect(trocarCampo(['nomeExecutado', 'comarca', null], 2, 'comarca')).toEqual([
      'nomeExecutado',
      null,
      'comarca',
    ])
  })
  it('null ignora a coluna', () => {
    expect(trocarCampo(['nomeExecutado', 'comarca'], 1, null)).toEqual(['nomeExecutado', null])
  })
})

describe('aplicarMapa', () => {
  it('conta linhas sem nome como ignoradas', () => {
    const r = aplicarMapa(
      [
        ['João', 'Comarca A'],
        ['', 'Comarca B'],
      ],
      ['nomeExecutado', 'comarca'],
    )
    expect(r.registros).toHaveLength(1)
    expect(r.registros[0].comarca).toBe('Comarca A')
    expect(r.ignoradas).toBe(1)
  })
})

describe('parseLinhasPlanilha (colar) — comportamento preservado', () => {
  it('casa colunas pelo cabeçalho', () => {
    const texto = 'Placa\tNome do Executado\tCPF\tBanco\tComarca\nABC1D23\tJoão\t123\tX\tY\n'
    const r = parseLinhasPlanilha(texto)
    expect(r.porCabecalho).toBe(true)
    expect(r.registros).toHaveLength(1)
    expect(r.registros[0].nomeExecutado).toBe('João')
    expect(r.registros[0].placa).toBe('ABC1D23')
  })
})

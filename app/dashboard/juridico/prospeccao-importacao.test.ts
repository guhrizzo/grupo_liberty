import { describe, expect, it } from 'vitest'
import { normalizarProspeccao, parseLinhasPlanilha, parseValor } from './prospeccao-parse'
import {
  aplicarMapa,
  celulaParaTexto,
  classificarLinhas,
  divergencias,
  grupoVinculado,
  lerMatriz,
  linhasParaGravar,
  trocarCampo,
} from './prospeccao-importacao'
import type { ProspeccaoInput } from './types'

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

const lead = (p: Partial<Record<keyof ProspeccaoInput, unknown>>): ProspeccaoInput =>
  normalizarProspeccao({ nomeExecutado: 'José da Silva', ...p })

const base = lead({
  cpfCnpj: '12345678901',
  placa: 'ABC1D23',
  comarca: 'Campinas',
  endereco: 'Rua A, 10',
  telefone1: '(11) 99999-0000',
  telefone2: '11 98888-0000',
  valorParcela: '1.000,00',
})

describe('divergencias', () => {
  it('ignora diferenças de formatação', () => {
    const novo = lead({
      nomeExecutado: 'JOSE DA SILVA',
      cpfCnpj: '123.456.789-01',
      placa: 'abc-1d23',
      comarca: 'campinas',
      telefone1: '11999990000',
      valorParcela: 1000,
    })
    expect(divergencias(novo, base)).toEqual([])
  })
  it('placa diferente diverge', () => {
    expect(divergencias(lead({ cpfCnpj: '12345678901', placa: 'XYZ9A87' }), base)).toContain('placa')
  })
  it('dado que o cadastrado não tem diverge', () => {
    const atual = lead({ cpfCnpj: '12345678901' })
    expect(divergencias(lead({ cpfCnpj: '12345678901', placa: 'XYZ9A87' }), atual)).toContain('placa')
  })
  it('campo vazio na planilha não diverge', () => {
    expect(divergencias(lead({ cpfCnpj: '12345678901' }), base)).not.toContain('endereco')
  })
  it('valor da parcela diferente diverge', () => {
    expect(divergencias(lead({ cpfCnpj: '12345678901', valorParcela: 1200 }), base)).toContain('valorParcela')
  })
  it('telefone que não está entre os do cadastrado diverge', () => {
    expect(divergencias(lead({ telefone1: '11 97777-0000' }), base)).toContain('telefones')
  })
  it('telefone presente em outra posição não diverge', () => {
    expect(divergencias(lead({ telefone3: '11988880000' }), base)).not.toContain('telefones')
  })
})

describe('classificarLinhas', () => {
  const existentes = [{ id: 'e1', dados: base }]

  it('mesma pessoa e mesmos dados é duplicado', () => {
    const [r] = classificarLinhas([lead({ cpfCnpj: '123.456.789-01', comarca: 'CAMPINAS' })], existentes)
    expect(r.classe).toBe('duplicado')
    expect(r.correspondencias[0].ref).toEqual({ tipo: 'existente', id: 'e1' })
  })
  it('mesmo CPF e placa diferente é divergente', () => {
    const [r] = classificarLinhas([lead({ cpfCnpj: '12345678901', placa: 'XYZ9A87' })], existentes)
    expect(r.classe).toBe('divergente')
    expect(r.correspondencias[0].divergencias).toContain('placa')
  })
  it('mesma placa e comarca diferente é divergente', () => {
    const [r] = classificarLinhas([lead({ placa: 'ABC1D23', comarca: 'Sorocaba' })], existentes)
    expect(r.classe).toBe('divergente')
    expect(r.correspondencias[0].divergencias).toContain('comarca')
  })
  it('sem correspondência é novo', () => {
    const [r] = classificarLinhas([lead({ nomeExecutado: 'Maria', cpfCnpj: '99999999999' })], existentes)
    expect(r.classe).toBe('novo')
    expect(r.correspondencias).toEqual([])
  })
  it('idêntico a um de dois correspondentes é duplicado', () => {
    const outro = lead({ cpfCnpj: '12345678901', placa: 'XYZ9A87' })
    const [r] = classificarLinhas([lead({ cpfCnpj: '12345678901', placa: 'XYZ9A87' })], [
      ...existentes,
      { id: 'e2', dados: outro },
    ])
    expect(r.classe).toBe('duplicado')
  })
  it('linha repetida no próprio arquivo é duplicada da anterior', () => {
    const l = lead({ nomeExecutado: 'Maria', cpfCnpj: '99999999999' })
    const r = classificarLinhas([l, { ...l }], [])
    expect(r.map((x) => x.classe)).toEqual(['novo', 'duplicado'])
    expect(r[1].correspondencias[0].ref).toEqual({ tipo: 'linha', indice: 0 })
  })
})

describe('linhasParaGravar', () => {
  const r = classificarLinhas(
    [
      lead({ nomeExecutado: 'Maria', cpfCnpj: '99999999999' }), // novo
      lead({ cpfCnpj: '12345678901', placa: 'XYZ9A87' }), // divergente
      lead({ cpfCnpj: '12345678901' }), // duplicado
    ],
    [{ id: 'e1', dados: base }],
  )
  it('divergente sem confirmação não é gravado', () => {
    expect(linhasParaGravar(r, new Set())).toEqual([0])
  })
  it('divergente confirmado é gravado; duplicado confirmado não', () => {
    expect(linhasParaGravar(r, new Set([1, 2]))).toEqual([0, 1])
  })
})

describe('grupoVinculado', () => {
  it('segue ligações nos dois sentidos e ignora ids órfãos', () => {
    const itens = [
      { id: 'a', vinculados: ['b', 'x'] },
      { id: 'b', vinculados: [] },
      { id: 'c', vinculados: ['b'] },
      { id: 'd', vinculados: [] },
    ]
    expect(grupoVinculado('a', itens)).toEqual(new Set(['a', 'b', 'c']))
  })
})

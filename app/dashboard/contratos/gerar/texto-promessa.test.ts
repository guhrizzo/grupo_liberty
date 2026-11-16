import { writeFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ContratoBlocosDocument from './ContratoBlocosDocument'
import ContratoPreview from './ContratoPreview'
import type { BlocoContrato } from './blocos'
import { montarContratoGerado } from './montar'
import { montarPromessa } from './texto-promessa'
import {
  compraVazia,
  conjugeVazio,
  inputPromessaVazio,
  contratanteVazio,
  locacaoVazia,
  prestacaoVazia,
  validarGerarContrato,
  veiculoContratoVazio,
  type GerarContratoInput,
} from './types'

function entrada(): GerarContratoInput {
  return {
    tipo: 'promessa-compra-financiado',
    contratante: {
      ...contratanteVazio(),
      nome: 'Maria da Silva',
      nacionalidade: 'brasileira',
      estadoCivil: 'casado',
      profissao: 'motorista',
      cpf: '52998224725',
      endereco: 'Rua das Flores, 10, Centro, Jaú/SP',
      telefone: '14999998888',
      email: 'maria@exemplo.com',
    },
    conjuge: conjugeVazio(),
    veiculo: { ...veiculoContratoVazio(), ano: '2020', placa: 'abc1d23', renavam: '12345678901' },
    prestacao: {
      ...prestacaoVazia(),
      banco: 'Banco Omni',
      qtdParcelas: '48',
      parcelasPagas: '20',
      parcelasAtraso: '1',
      valorParcela: 'R$ 1.200,50',
    },
    locacao: locacaoVazia(),
    compra: {
      ...compraVazia(),
      marca: 'Hyundai',
      modelo: 'HB20 1.0',
      cor: 'Branca',
      chassi: '9BHBG51CAKP000000',
      categoria: 'Particular',
      conservacao: 'Bom estado',
      tipoFinanciamento: 'CDC',
      valorFinanciado: 'R$ 50.000,00',
      saldoDevedor: 'R$ 33.614,00',
      valorTotal: 'R$ 8.500,00',
    },
    salvarCliente: false,
  }
}

const textoDe = (b: BlocoContrato) =>
  b.tipo === 'tabela'
    ? b.linhas.map((l) => l.join(' ')).join(' ')
    : b.tipo === 'alineas'
      ? b.itens.join(' ')
      : b.tipo === 'assinaturas'
        ? b.itens.map((a) => `${a.nome} ${a.documento} ${a.papel}`).join(' ')
        : b.texto

describe('montarPromessa', () => {
  const contrato = montarPromessa(entrada(), new Date(2026, 10, 16))
  const tudo = contrato.blocos.map(textoDe).join('\n')

  it('preenche as lacunas do comprador', () => {
    expect(tudo).toContain('COMPRADOR: MARIA DA SILVA')
    expect(tudo).toContain('brasileira, casado(a), motorista')
    expect(tudo).toContain('CPF nº 529.982.247-25')
    expect(tudo).toContain('(14) 99999-8888')
    expect(tudo).toContain('maria@exemplo.com')
  })

  it('preenche as tabelas do veículo e do financiamento', () => {
    const tabelas = contrato.blocos.filter((b) => b.tipo === 'tabela')
    expect(tabelas).toHaveLength(2)
    const veiculo = Object.fromEntries(tabelas[0].tipo === 'tabela' ? tabelas[0].linhas : [])
    expect(veiculo).toMatchObject({ Marca: 'Hyundai', Placa: 'ABC1D23', Chassi: '9BHBG51CAKP000000' })
    const fin = Object.fromEntries(tabelas[1].tipo === 'tabela' ? tabelas[1].linhas : [])
    expect(fin['Parcelas vincendas']).toBe('28')
    expect(fin['Parcelas em atraso']).toBe('1')
    expect(fin['Saldo devedor aproximado']).toMatch(/33\.614,00/)
  })

  it('usa o prazo, o valor por extenso, a forma de pagamento e a data', () => {
    expect(tudo).toContain('em até 12 (doze) meses')
    expect(tudo).toMatch(/R\$\s8\.500,00 \(oito mil e quinhentos reais\)/)
    expect(tudo).toContain('mediante pagamento em **PIX**')
    expect(tudo).toContain('Jaú/SP, 16 de novembro de 2026.')
  })

  it('não deixa lacunas nem fala de cônjuge ou FIPE', () => {
    expect(tudo).not.toMatch(/\[[^\]]+\]/)
    expect(tudo).not.toMatch(/cônjuge|FIPE/i)
  })

  it('assina: comprador, intermediador e duas testemunhas', () => {
    const ass = contrato.blocos.find((b) => b.tipo === 'assinaturas')
    expect(ass?.tipo === 'assinaturas' && ass.itens.map((a) => a.papel)).toEqual([
      'COMPRADOR(A)',
      'INTERMEDIADOR',
      'TESTEMUNHA I',
      'TESTEMUNHA II',
    ])
  })

  it('gera o PDF', async () => {
    const buf = await renderToBuffer(
      createElement(ContratoBlocosDocument, { contrato, nomeCliente: 'Maria' }) as never,
    )
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, buf)
  })
})

describe('validarGerarContrato (promessa de compra)', () => {
  it('aceita o preenchimento completo, sem RG e sem FIPE', () => {
    expect(validarGerarContrato(entrada())).toBeNull()
  })

  it('exige os campos próprios do modelo', () => {
    const sem = (alterar: (i: GerarContratoInput) => void) => {
      const i = entrada()
      alterar(i)
      return validarGerarContrato(i)
    }
    expect(sem((i) => (i.compra.cor = ''))).toBe('Informe a cor do veículo.')
    expect(sem((i) => (i.compra.chassi = ''))).toBe('Informe o chassi.')
    expect(sem((i) => (i.contratante.nacionalidade = ''))).toBe('Informe a nacionalidade.')
    expect(sem((i) => (i.contratante.telefone = ''))).toBe('Informe o telefone com DDD.')
    expect(sem((i) => (i.compra.saldoDevedor = ''))).toBe('Informe o saldo devedor aproximado.')
    expect(sem((i) => (i.prestacao.parcelasPagas = '60'))).toBe('Parcelas pagas maior que o total de parcelas.')
    expect(sem((i) => (i.compra.valorTotal = ''))).toBe('Informe o valor total do contrato.')
  })
})

describe('prévia com o formulário vazio', () => {
  const vazio = (): GerarContratoInput => ({
    tipo: 'promessa-compra-financiado',
    contratante: contratanteVazio(),
    conjuge: conjugeVazio(),
    veiculo: veiculoContratoVazio(),
    prestacao: prestacaoVazia(),
    locacao: locacaoVazia(),
    compra: { ...compraVazia(), formaPagamento: '' },
    salvarCliente: false,
  })

  it('monta o contrato com as lacunas entre colchetes, sem NaN', () => {
    const contrato = montarPromessa(vazio(), new Date(2026, 10, 16))
    const tudo = contrato.blocos.map(textoDe).join('\n')
    expect(tudo).toContain('COMPRADOR: [NOME COMPLETO]')
    expect(tudo).toContain('[CPF]')
    expect(tudo).toContain('[valor total]')
    expect(tudo).toContain('[forma de pagamento]')
    expect(tudo).not.toMatch(/NaN|undefined|R\$\s*0,00/)
  })

  it('a prévia em HTML destaca as lacunas e mostra as tabelas', () => {
    const html = renderToStaticMarkup(
      createElement(ContratoPreview, { contrato: montarPromessa(vazio(), new Date(2026, 10, 16)) }),
    )
    expect(html).toContain('<mark')
    expect(html).toContain('[NOME COMPLETO]')
    expect(html).toContain('Estado de conservação')
    expect(html).toContain('TESTEMUNHA II')
  })

  it('com tudo preenchido não sobra nenhuma lacuna na prévia', () => {
    const html = renderToStaticMarkup(
      createElement(ContratoPreview, { contrato: montarPromessa(entrada(), new Date(2026, 10, 16)) }),
    )
    expect(html).not.toContain('<mark')
  })
})

describe('formulário vazio da promessa', () => {
  it('monta o contrato sem erro', () => {
    expect(() => montarPromessa(inputPromessaVazio())).not.toThrow()
  })
})

describe('prestação de serviço e locação no mesmo layout', () => {
  const servico = (tipo: GerarContratoInput['tipo']): GerarContratoInput => {
    const base = entrada()
    return {
      ...base,
      tipo,
      contratante: { ...base.contratante, rg: '12.345.678-9', estadoCivil: 'solteiro' },
      veiculo: { ...base.veiculo, marcaModelo: 'Hyundai HB20', fipe: 'R$ 50.000,00' },
      prestacao: { ...base.prestacao, prazo: '12', valorProposta: 'R$ 5.000,00' },
      locacao: { prazo: '12', valorSemanal: 'R$ 700,00', caucao: 'R$ 1.000,00' },
    }
  }
  const hoje = new Date(2026, 10, 16)
  const textoTodo = (i: GerarContratoInput) =>
    montarContratoGerado(i, hoje).blocos.map(textoDe).join('\n')

  it('validam com o formulário preenchido', () => {
    expect(validarGerarContrato(servico('prestacao-de-servico'))).toBeNull()
    expect(validarGerarContrato(servico('locacao-de-veiculo'))).toBeNull()
  })

  it('prestação: preenche valores, sem lacunas e com título, cláusulas e assinaturas', () => {
    const i = servico('prestacao-de-servico')
    const contrato = montarContratoGerado(i, hoje)
    const tudo = textoTodo(i)
    expect(contrato.blocos[0]).toEqual({ tipo: 'titulo', texto: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS' })
    expect(tudo).toContain('CLÁUSULA PRIMEIRA — DO OBJETO')
    expect(tudo).toMatch(/R\$\s5\.000,00 \(cinco mil reais\)/)
    expect(tudo).toContain('48 (quarenta e oito) parcelas')
    expect(tudo).toContain('restando 28 (vinte e oito) a vencer')
    expect(tudo).toContain('Jaú, 16 de novembro de 2026.')
    expect(tudo).not.toMatch(/\[[^\]]+\]/)
    const ass = contrato.blocos.find((b) => b.tipo === 'assinaturas')
    expect(ass?.tipo === 'assinaturas' && ass.itens.map((a) => a.papel)).toEqual(['CONTRATADA', 'CONTRATANTE'])
  })

  it('locação: preenche aluguel e caução, e cônjuge também assina', () => {
    const i = servico('locacao-de-veiculo')
    i.contratante.estadoCivil = 'casado'
    i.conjuge = { nome: 'João da Silva', rg: '', cpf: '11144477735', profissao: '' }
    const contrato = montarContratoGerado(i, hoje)
    const tudo = contrato.blocos.map(textoDe).join('\n')
    expect(tudo).toMatch(/R\$\s700,00 \(setecentos reais\)/)
    expect(tudo).toMatch(/caução, o LOCATÁRIO entrega à LOCADORA R\$\s1\.000,00/)
    const ass = contrato.blocos.find((b) => b.tipo === 'assinaturas')
    expect(ass?.tipo === 'assinaturas' && ass.itens.map((a) => a.papel)).toContain('CÔNJUGE')
  })

  it('formulário vazio mostra lacunas (sem NaN) nos dois modelos', () => {
    for (const tipo of ['prestacao-de-servico', 'locacao-de-veiculo'] as const) {
      const vazio = { ...inputPromessaVazio(), tipo }
      const tudo = textoTodo(vazio)
      expect(tudo).toContain('[NOME COMPLETO]')
      expect(tudo).toContain('[CPF]')
      expect(tudo).not.toMatch(/NaN|undefined/)
    }
  })

  it('geram o PDF no layout novo (sem o cabeçalho antigo)', async () => {
    for (const tipo of ['prestacao-de-servico', 'locacao-de-veiculo'] as const) {
      const contrato = montarContratoGerado(servico(tipo), hoje)
      const buf = await renderToBuffer(
        createElement(ContratoBlocosDocument, { contrato, nomeCliente: 'Maria' }) as never,
      )
      expect(buf.subarray(0, 4).toString()).toBe('%PDF')
    }
  })
})

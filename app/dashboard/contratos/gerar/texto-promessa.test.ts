import { writeFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ContratoBlocosDocument from './ContratoBlocosDocument'
import ContratoPreview from './ContratoPreview'
import type { BlocoContrato } from './blocos'
import { montarContratoGerado } from './montar'
import { montarPrestacao } from './texto-prestacao'
import { montarPromessa } from './texto-promessa'
import {
  compraVazia,
  INTERMEDIADOR_PADRAO,
  TESTEMUNHAS_PADRAO,
  inputPromessaVazio,
  contratanteVazio,
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
    vendedor2: contratanteVazio(),
    veiculo: { ...veiculoContratoVazio(), ano: '2020', placa: 'abc1d23', renavam: '12345678901' },
    prestacao: {
      ...prestacaoVazia(),
      banco: 'Banco Omni',
      qtdParcelas: '48',
      parcelasPagas: '20',
      parcelasAtraso: '1',
      valorParcela: 'R$ 1.200,50',
    },
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
    vendedor2: contratanteVazio(),
    veiculo: veiculoContratoVazio(),
    prestacao: prestacaoVazia(),
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

describe('promessa de compra parcelada', () => {
  const hoje = new Date(2026, 10, 16)
  const parcelada = (): GerarContratoInput => {
    const base = entrada()
    return {
      ...base,
      tipo: 'promessa-compra-parcelada',
      contratante: { ...base.contratante, telefone: '' },
      compra: {
        ...base.compra,
        categoria: 'PARTICULAR',
        conservacao: 'USADO',
        intermediador: { ...INTERMEDIADOR_PADRAO },
        testemunhas: TESTEMUNHAS_PADRAO.map((t) => ({ ...t })),
        pagamentos: '2',
        valorPagamento: 'R$ 4.250,00',
        vencimentos: ['2026-12-10', '2027-01-10'],
        cidade: 'Jaú/SP',
        dataAssinatura: '2026-11-16',
      },
    }
  }
  const texto = (i: GerarContratoInput) => montarContratoGerado(i, hoje).blocos.map(textoDe).join('\n')
  const erro = (alterar: (i: GerarContratoInput) => void) => {
    const i = parcelada()
    alterar(i)
    return validarGerarContrato(i)
  }

  it('valida completo (sem telefone nem forma de pagamento) e exige os campos próprios', () => {
    expect(validarGerarContrato(parcelada())).toBeNull()
    expect(erro((i) => (i.compra.vencimentos[1] = ''))).toBe('Informe o vencimento da parcela 2.')
    expect(erro((i) => (i.compra.testemunhas[1].cpf = '123'))).toBe('Informe o CPF da testemunha 2 (11 dígitos).')
    expect(erro((i) => (i.compra.intermediador.cnpj = '123'))).toBe('Informe o CNPJ do intermediador (14 dígitos).')
    expect(erro((i) => (i.compra.cidade = ''))).toBe('Informe a cidade/UF da assinatura.')
    expect(erro((i) => (i.compra.dataAssinatura = '2026-02-31'))).toBe('Informe a data da assinatura.')
    expect(erro((i) => (i.compra.pagamentos = '0'))).toBe('Informe a quantidade de parcelas do pagamento (de 1 a 60).')
  })

  it('traz a cláusula 6 parcelada e a rescisão automática (7.4 e 7.5)', () => {
    const t = texto(parcelada())
    expect(t).toContain('**6.2.** O pagamento do valor descrito no item 6.1 será realizado da seguinte forma:')
    expect(t).toContain('**a)** Em 02 (duas) parcelas mensais, fixas e sucessivas, no valor de **R$')
    expect(t).toMatch(/4\.250,00 \(quatro mil duzentos e cinquenta reais\)\*\* cada/)
    expect(t).toContain('com o primeiro vencimento em 10/12/2026 e 10/01/2027;')
    expect(t).toContain('**7.4.** Este contrato poderá ser considerado rescindido automaticamente')
    expect(t).toContain('**7.5.** Em qualquer hipótese de rescisão:')
    expect(t).not.toContain('SUSPENSÃO POR IMPOSSIBILIDADE')
    expect(t).not.toContain('forma de pagamento')
  })

  it('usa os dados do intermediador, das testemunhas, a cidade e a data informados', () => {
    const t = texto(parcelada())
    expect(t).toContain('**INTERMEDIADOR: 55.116.497 OTAVIO MORETTO**')
    expect(t).toContain('CNPJ sob nº 55.116.497/0001-08')
    expect(t).toContain('CPF nº 520.525.368-17')
    expect(t).toContain('Jaú/SP, 16 de novembro de 2026.')
    expect(t).toContain('ÁLESIS SILVA QUIO CPF n° 542.342.458-52 TESTEMUNHA I')
    expect(t).not.toContain('(14) 99999-8888') // este modelo não tem telefone do comprador
    expect(t).not.toMatch(/\[[^\]]+\]/)
  })

  it('ajusta o texto à quantidade de parcelas', () => {
    const tres = parcelada()
    tres.compra.pagamentos = '3'
    tres.compra.vencimentos = ['2026-12-10', '2027-01-10', '2027-02-10']
    expect(texto(tres)).toContain('03 (três) parcelas mensais')
    expect(texto(tres)).toContain('com vencimentos em 10/12/2026, 10/01/2027 e 10/02/2027;')
    const uma = parcelada()
    uma.compra.pagamentos = '1'
    expect(texto(uma)).toContain('Em 01 (uma) parcela no valor de')
    expect(texto(uma)).toContain('com vencimento em 10/12/2026;')
    const vinteUma = parcelada()
    vinteUma.compra.pagamentos = '21'
    expect(texto(vinteUma)).toContain('21 (vinte e uma) parcelas')
  })

  it('formulário vazio mostra lacunas e o PDF é gerado', async () => {
    const vazio = inputPromessaVazio('promessa-compra-parcelada')
    const t = texto(vazio)
    expect(t).toContain('[NOME COMPLETO]')
    expect(t).toContain('[vencimento 1]')
    expect(t).toContain('[data]')
    expect(t).not.toMatch(/NaN|undefined/)
    const buf = await renderToBuffer(
      createElement(ContratoBlocosDocument, { contrato: montarContratoGerado(parcelada(), hoje), nomeCliente: 'Maria' }) as never,
    )
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('a promessa à vista continua com o pagamento à vista', () => {
    const t = montarContratoGerado(entrada(), hoje).blocos.map(textoDe).join('\n')
    expect(t).toContain('será realizado à vista, em parcela única')
    expect(t).toContain('DA SUSPENSÃO POR IMPOSSIBILIDADE SUPERVENIENTE')
  })
})

describe('prestação de serviços de intermediação', () => {
  const prestacao = (casal = false): GerarContratoInput => {
    const base = entrada()
    base.tipo = casal ? 'prestacao-servico-casal' : 'prestacao-servico'
    base.contratante.rg = '123456789'
    base.compra.dataPagamento = '2026-12-05'
    if (casal) {
      base.vendedor2 = { ...base.contratante, nome: 'João Souza', cpf: '11144477735', rg: '987654321' }
    }
    return base
  }
  const hoje = new Date(2026, 10, 16)
  const t = (i: GerarContratoInput) => montarContratoGerado(i, hoje).blocos.map(textoDe).join(' ')

  it('um vendedor: sem vendedor II e sem RG', () => {
    const i = prestacao()
    expect(validarGerarContrato(i)).toBeNull()
    const x = t(i)
    expect(x).toContain('VENDEDOR: MARIA DA SILVA')
    expect(x).not.toContain('VENDEDOR II')
    expect(x).not.toContain('RG nº')
    expect(x).toContain('LIBERTY CAR VEICULOS LTDA')
    expect(x).toContain('pagamento à vista até o dia 05/12/2026')
    expect(x).toContain('ALEX RODRIGO LEVORATO PARRELLA')
    expect(x).not.toMatch(/NaN|undefined/)
  })

  it('casal: dois vendedores com RG e duas assinaturas', () => {
    const i = prestacao(true)
    expect(validarGerarContrato(i)).toBeNull()
    const x = t(i)
    expect(x).toContain('VENDEDOR I: MARIA DA SILVA')
    expect(x).toContain('VENDEDOR II: JOÃO SOUZA')
    expect(x).toContain('RG nº 987654321')
    const ass = montarPrestacao(i, hoje).blocos.find((b) => b.tipo === 'assinaturas')
    expect(ass?.tipo === 'assinaturas' && ass.itens.map((a) => a.papel)).toEqual(['VENDEDOR I', 'VENDEDOR II', 'INTERMEDIADOR', 'TESTEMUNHA I', 'TESTEMUNHA II'])
  })

  it('cláusulas opcionais saem quando desmarcadas', () => {
    const i = prestacao()
    i.compra.limpaNome = false
    i.compra.seguroPrestamista = false
    const x = t(i)
    expect(x).not.toContain('Limpa Nome')
    expect(x).not.toContain('seguro prestamista')
    expect(t(prestacao())).toContain('Limpa Nome')
  })

  it('validação e formulário vazio', async () => {
    const i = prestacao(true)
    i.vendedor2.rg = ''
    expect(validarGerarContrato(i)).toBe('Informe o RG do vendedor II.')
    const j = prestacao()
    j.compra.dataPagamento = ''
    expect(validarGerarContrato(j)).toBe('Informe a data limite do pagamento.')
    const vazio = inputPromessaVazio('prestacao-servico-casal')
    expect(t(vazio)).toContain('[NOME COMPLETO]')
    const buf = await renderToBuffer(createElement(ContratoBlocosDocument, { contrato: montarContratoGerado(prestacao(true), hoje), nomeCliente: 'Maria' }) as never)
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })
})

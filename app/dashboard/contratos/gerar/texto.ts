// Texto dos contratos gerados. RASCUNHO: as cláusulas (principalmente seguro
// prestamista e limpa nome) precisam de revisão jurídica antes do uso real.
// Dados da contratada ficam todos em CONTRATADA — conferir razão social/CNPJ.

import { labelEstadoCivil, precisaConjuge } from '@/utils/cobrancas/pessoa'
import { maskCPFCNPJ } from '@/utils/masks'
import { numeroDe, type GerarContratoInput } from './types'

export const CONTRATADA = {
  nome: 'LIBERTY CAR',
  documento: 'CNPJ 00.000.000/0001-00', // TODO confirmar CNPJ e razão social
  endereco: 'Jaú/SP', // TODO confirmar endereço da sede
  foro: 'Jaú/SP', // TODO confirmar foro
}

export interface ClausulaTexto {
  titulo: string
  itens: string[]
}

export interface ContratoTexto {
  titulo: string
  assinantes: string[]
  introducao: string
  clausulas: ClausulaTexto[]
  local: string
}

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const r = n % 100
  const partes: string[] = []
  if (c) partes.push(CENTENAS[c])
  if (r) {
    if (r < 20) partes.push(UNIDADES[r])
    else partes.push(DEZENAS[Math.floor(r / 10)] + (r % 10 ? ` e ${UNIDADES[r % 10]}` : ''))
  }
  return partes.join(' e ')
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero'
  const milhoes = Math.floor(n / 1_000_000)
  const milhares = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const blocos: { texto: string; valor: number }[] = []
  if (milhoes) blocos.push({ texto: milhoes === 1 ? 'um milhão' : `${ate999(milhoes)} milhões`, valor: 1000000 })
  if (milhares) blocos.push({ texto: milhares === 1 ? 'mil' : `${ate999(milhares)} mil`, valor: milhares * 1000 })
  if (resto) blocos.push({ texto: ate999(resto), valor: resto })
  // "e" antes do último bloco quando ele é < 100 ou múltiplo de 100.
  const ultimo = blocos[blocos.length - 1]
  const usaE = blocos.length > 1 && (ultimo.valor % 1000 < 100 || ultimo.valor % 100 === 0)
  const textos = blocos.map((b) => b.texto)
  if (!usaE) return textos.join(' ')
  const fim = textos.pop() as string
  return `${textos.join(' ')} e ${fim}`
}

/** 1234.5 → "mil duzentos e trinta e quatro reais e cinquenta centavos". */
export function reaisPorExtenso(valor: number): string {
  const cents = Math.round(valor * 100)
  const reais = Math.floor(cents / 100)
  const centavos = cents % 100
  const partes: string[] = []
  if (reais > 0 || centavos === 0) partes.push(`${inteiroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`)
  if (centavos > 0) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  return partes.join(' e ')
}

export function brl(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function dinheiro(raw: string): string {
  const v = numeroDe(raw)
  return `${brl(v)} (${reaisPorExtenso(v)})`
}

function meses(raw: string): string {
  const n = Number(raw)
  return `${n} (${inteiroPorExtenso(n)}) ${n === 1 ? 'mês' : 'meses'}`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function dataPorExtenso(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

function qualificacao(i: GerarContratoInput): string {
  const c = i.contratante
  const cep = c.cep.trim() ? `, CEP ${c.cep.trim()}` : ''
  let t = `${c.nome.trim().toUpperCase()}, ${labelEstadoCivil(c.estadoCivil).toLowerCase()}, ${c.profissao.trim()}, portador(a) do RG nº ${c.rg.trim()} e inscrito(a) no CPF sob o nº ${maskCPFCNPJ(c.cpf)}, e-mail ${c.email.trim()}, residente e domiciliado(a) em ${c.endereco.trim()}${cep}`
  if (precisaConjuge(c.estadoCivil)) {
    const j = i.conjuge
    t += `, neste ato com a anuência de seu(sua) cônjuge ${j.nome.trim().toUpperCase()}, ${j.profissao.trim() || 'profissão não informada'}, portador(a) do RG nº ${j.rg.trim() || '—'} e do CPF nº ${maskCPFCNPJ(j.cpf)}, que também assina este instrumento`
  }
  return t
}

function veiculoTexto(i: GerarContratoInput): string {
  const v = i.veiculo
  return `${v.marcaModelo.trim()}, ano ${v.ano.trim()}, placa ${v.placa.trim().toUpperCase()}, RENAVAM ${v.renavam.trim()}, avaliado pela Tabela FIPE em ${brl(numeroDe(v.fipe))}`
}

const ORDINAL = ['PRIMEIRA', 'SEGUNDA', 'TERCEIRA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÉTIMA', 'OITAVA', 'NONA', 'DÉCIMA']

/** Numera as cláusulas na ordem em que aparecem (as opcionais entram no meio). */
function numerar(base: ClausulaTexto[]): ClausulaTexto[] {
  return base.map((c, idx) => ({ ...c, titulo: `CLÁUSULA ${ORDINAL[idx]} — ${c.titulo}` }))
}

function prestacao(i: GerarContratoInput, hoje: Date): ContratoTexto {
  const p = i.prestacao
  const qtd = Number(p.qtdParcelas)
  const pagas = Number(p.parcelasPagas)
  const atraso = Number(p.parcelasAtraso)
  const restantes = Math.max(0, qtd - pagas)
  const clausulas: ClausulaTexto[] = [
    {
      titulo: 'DO OBJETO',
      itens: [
        `O presente contrato tem por objeto a prestação, pela CONTRATADA, de serviços de intermediação, gestão e regularização do financiamento do veículo ${veiculoTexto(i)}, de propriedade/posse do CONTRATANTE, financiado junto ao ${p.banco.trim()}.`,
      ],
    },
    {
      titulo: 'DA SITUAÇÃO DO FINANCIAMENTO',
      itens: [
        `O financiamento foi contratado em ${qtd} (${inteiroPorExtenso(qtd)}) parcelas de ${dinheiro(p.valorParcela)}, das quais ${pagas} (${inteiroPorExtenso(pagas)}) foram pagas, restando ${restantes} (${inteiroPorExtenso(restantes)}) a vencer.`,
        atraso > 0
          ? `Na data de assinatura constam ${atraso} (${inteiroPorExtenso(atraso)}) parcela(s) em atraso, declaradas pelo CONTRATANTE, que reconhece sua responsabilidade pelos encargos decorrentes do atraso até a execução dos serviços.`
          : 'O CONTRATANTE declara que não há parcelas em atraso na data de assinatura.',
      ],
    },
    {
      titulo: 'DO PRAZO E DO VALOR',
      itens: [
        `O prazo de vigência deste contrato é de ${meses(p.prazo)}, contados da data de assinatura.`,
        `Pelos serviços, as partes ajustam o valor de ${dinheiro(p.valorProposta)}, conforme proposta aceita pelo CONTRATANTE, a ser pago na forma combinada entre as partes.`,
      ],
    },
    {
      titulo: 'DAS OBRIGAÇÕES DO CONTRATANTE',
      itens: [
        'Fornecer à CONTRATADA toda a documentação e informação verdadeiras necessárias à execução dos serviços, respondendo pela veracidade delas.',
        'Manter o veículo regular, sem novos débitos, restrições ou alienações não informadas à CONTRATADA durante a vigência.',
        'Não transferir, alienar ou onerar o veículo sem prévia comunicação à CONTRATADA.',
      ],
    },
    {
      titulo: 'DAS OBRIGAÇÕES DA CONTRATADA',
      itens: [
        'Executar os serviços descritos na cláusula do objeto com diligência e manter o CONTRATANTE informado sobre o andamento.',
        'Guardar sigilo sobre os dados pessoais e financeiros do CONTRATANTE, tratando-os conforme a Lei nº 13.709/2018 (LGPD).',
      ],
    },
  ]
  if (p.seguroPrestamista) {
    clausulas.push({
      titulo: 'DO SEGURO PRESTAMISTA',
      itens: [
        'O CONTRATANTE opta pela contratação de seguro prestamista, destinado a quitar ou amortizar o saldo do financiamento nas hipóteses previstas na apólice (como morte ou invalidez), conforme condições da seguradora, cujas coberturas, exclusões e carências integram a apólice entregue ao CONTRATANTE.',
        'O prêmio do seguro é de responsabilidade do CONTRATANTE, na forma informada pela CONTRATADA. A CONTRATADA atua apenas como intermediadora, não sendo responsável pelo pagamento de sinistros, que cabe exclusivamente à seguradora.',
      ],
    })
  }
  if (p.limpaNome) {
    clausulas.push({
      titulo: 'DO SERVIÇO DE LIMPA NOME',
      itens: [
        'O CONTRATANTE contrata, em caráter adicional, o serviço de limpa nome, consistente na orientação e no acompanhamento da regularização de apontamentos em cadastros de proteção ao crédito (como SPC e Serasa) relativos a débitos do CONTRATANTE.',
        'A CONTRATADA obriga-se a empregar os meios adequados, sem garantir resultado em prazo determinado, uma vez que a exclusão depende de terceiros (credores e órgãos de proteção ao crédito). O pagamento dos débitos apontados é de responsabilidade exclusiva do CONTRATANTE.',
      ],
    })
  }
  clausulas.push({
    titulo: 'DA RESCISÃO E DO FORO',
    itens: [
      'O descumprimento de qualquer cláusula autoriza a rescisão pela parte inocente, mediante comunicação por escrito, sem prejuízo de perdas e danos.',
      `Fica eleito o foro da comarca de ${CONTRATADA.foro} para dirimir questões deste contrato, com renúncia a qualquer outro.`,
    ],
  })
  return montar('CONTRATO DE PRESTAÇÃO DE SERVIÇOS', i, numerar(clausulas), hoje, 'prestação de serviços')
}

function locacao(i: GerarContratoInput, hoje: Date): ContratoTexto {
  const l = i.locacao
  const caucao = numeroDe(l.caucao)
  const clausulas: ClausulaTexto[] = [
    {
      titulo: 'DO OBJETO',
      itens: [`A CONTRATADA (LOCADORA) cede em locação ao CONTRATANTE (LOCATÁRIO) o veículo ${veiculoTexto(i)}, em perfeito estado de funcionamento, que será restituído nas mesmas condições, ressalvado o desgaste natural.`],
    },
    {
      titulo: 'DO PRAZO',
      itens: [`A locação vigora por ${meses(l.prazo)}, contados da entrega do veículo, podendo ser renovada por acordo escrito entre as partes.`],
    },
    {
      titulo: 'DO VALOR E DO PAGAMENTO',
      itens: [
        `O LOCATÁRIO pagará o aluguel semanal de ${dinheiro(l.valorSemanal)}, em dia e forma ajustados com a LOCADORA.`,
        'O atraso no pagamento sujeita o LOCATÁRIO a multa e juros na forma da lei, e autoriza a LOCADORA a retomar o veículo após notificação.',
      ],
    },
    {
      titulo: 'DA CAUÇÃO',
      itens: [
        caucao > 0
          ? `A título de caução, o LOCATÁRIO entrega à LOCADORA ${dinheiro(l.caucao)}, a ser devolvida ao fim da locação, descontados eventuais débitos, multas, avarias ou valores em aberto.`
          : 'As partes dispensam a caução nesta locação.',
      ],
    },
    {
      titulo: 'DAS OBRIGAÇÕES DO LOCATÁRIO',
      itens: [
        'Usar o veículo conforme sua destinação e a legislação de trânsito, sendo o único responsável por multas, pedágios e infrações ocorridas durante a locação.',
        'Zelar pela conservação do veículo, comunicando de imediato qualquer sinistro, avaria ou furto, e não sublocar, emprestar ou ceder o veículo a terceiros.',
        'Responder por danos causados ao veículo ou a terceiros por culpa ou dolo seus ou de quem o conduza com sua autorização.',
      ],
    },
    {
      titulo: 'DAS OBRIGAÇÕES DA LOCADORA',
      itens: ['Entregar o veículo em condições de uso, com a documentação em dia, e garantir ao LOCATÁRIO o uso pacífico durante a vigência.'],
    },
    {
      titulo: 'DA RESCISÃO E DO FORO',
      itens: [
        'O descumprimento de qualquer cláusula autoriza a rescisão pela parte inocente, com a restituição imediata do veículo, sem prejuízo de perdas e danos.',
        `Fica eleito o foro da comarca de ${CONTRATADA.foro} para dirimir questões deste contrato, com renúncia a qualquer outro.`,
      ],
    },
  ]
  return montar('CONTRATO DE LOCAÇÃO DE VEÍCULO', i, numerar(clausulas), hoje, 'locação de veículo')
}

function montar(titulo: string, i: GerarContratoInput, clausulas: ClausulaTexto[], hoje: Date, objeto: string): ContratoTexto {
  const loc = i.tipo === 'locacao-de-veiculo'
  const papelContratada = loc ? 'CONTRATADA (LOCADORA)' : 'CONTRATADA'
  const papelContratante = loc ? 'CONTRATANTE (LOCATÁRIO)' : 'CONTRATANTE'
  const assinantes = [`${CONTRATADA.nome} — ${papelContratada}`, `${i.contratante.nome.trim().toUpperCase()} — ${papelContratante}`]
  if (precisaConjuge(i.contratante.estadoCivil)) assinantes.push(`${i.conjuge.nome.trim().toUpperCase()} — CÔNJUGE`)
  return {
    titulo,
    assinantes,
    introducao: `Pelo presente instrumento particular de ${objeto}, de um lado ${CONTRATADA.nome}, ${CONTRATADA.documento}, com sede em ${CONTRATADA.endereco}, doravante denominada ${papelContratada}, e de outro lado ${qualificacao(i)}, doravante denominado(a) ${papelContratante}, têm entre si justo e contratado o seguinte:`,
    clausulas,
    local: `${CONTRATADA.foro.split('/')[0]}, ${dataPorExtenso(hoje)}.`,
  }
}

export function montarContrato(i: GerarContratoInput, hoje: Date = new Date()): ContratoTexto {
  return i.tipo === 'prestacao-de-servico' ? prestacao(i, hoje) : locacao(i, hoje)
}

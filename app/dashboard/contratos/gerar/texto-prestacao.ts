// Texto do "Contrato de prestação de serviços de intermediação e outras avenças"
// (um vendedor ou casal). Transcrição dos modelos em PDF: só as lacunas ([...])
// são variáveis. O texto jurídico NÃO deve ser alterado aqui sem aval do jurídico.
//
// `**texto**` marca negrito (lido por ContratoBlocosDocument).

import { ESTADOS_CIVIS, labelEstadoCivil } from '@/utils/cobrancas/pessoa'
import { maskPhone, onlyDigits } from '@/utils/masks'
import type { BlocoContrato, ContratoBlocos } from './blocos'
import { assinaturasTestemunhas, brl, dataPorExtenso, dinheiro, lacuna } from './texto'
import { TIPO_PRESTACAO_CASAL, numeroDe, type ContratanteInput, type GerarContratoInput } from './types'

const TITULO = 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE INTERMEDIAÇÃO E OUTRAS AVENÇAS'
const LOCAL_ASSINATURA = 'Jaú/SP'

// Intermediador deste modelo: fixo, como no PDF. As testemunhas vêm do formulário
// (valor inicial em TESTEMUNHAS_PADRAO_SERVICOS).
const SOCIO = 'OTÁVIO MORETTO'
const CPF_SOCIO = '520.525.368-17'

export const ou = (valor: string, rotulo: string) => valor.trim() || lacuna(rotulo)
const moeda = (raw: string) => brl(numeroDe(raw))
const contagem = (raw: string) => String(Number(raw))

/** "2026-11-16" → "16/11/2026" (lacuna se inválida). */
function dataCurta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : lacuna('data limite do pagamento')
}

export function cpfFormatado(raw: string): string {
  const d = onlyDigits(raw)
  return d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : d ? d : lacuna('CPF')
}

interface Vendedor {
  nome: string
  cpf: string
  /** Descrição completa para o preâmbulo. */
  paragrafo: string
}

function vendedor(c: ContratanteInput, papel: string, comRg: boolean): Vendedor {
  const nome = c.nome.trim() ? c.nome.trim().toUpperCase() : lacuna('NOME COMPLETO')
  const cpf = cpfFormatado(c.cpf)
  const estadoCivil = ESTADOS_CIVIS.some((e) => e.value === c.estadoCivil) ? labelEstadoCivil(c.estadoCivil).toLowerCase() : lacuna('estado civil')
  const telefone = onlyDigits(c.telefone) ? maskPhone(c.telefone) : lacuna('telefone')
  const rg = comRg ? ` e **RG nº ${ou(c.rg, 'RG')}**` : ''
  return {
    nome,
    cpf,
    paragrafo: `**${papel}: ${nome},** ${ou(c.nacionalidade, 'nacionalidade')}, ${estadoCivil}, ${ou(c.profissao, 'profissão')}, portador do **CPF nº ${cpf}**${rg}, com endereço na ${ou(c.endereco, 'endereço completo')}, com o telefone **${telefone}** e endereço eletrônico **${ou(c.email, 'e-mail')}**.`,
  }
}

export function montarPrestacao(i: GerarContratoInput, hoje: Date = new Date()): ContratoBlocos {
  const casal = i.tipo === TIPO_PRESTACAO_CASAL
  const v = i.veiculo
  const k = i.compra
  const p = i.prestacao
  const qtdOk = /^\d+$/.test(p.qtdParcelas.trim())
  const pagasOk = /^\d+$/.test(p.parcelasPagas.trim())
  const vincendas = qtdOk && pagasOk ? String(Math.max(0, Number(p.qtdParcelas) - Number(p.parcelasPagas))) : ''
  const valorPago = numeroDe(k.valorTotal) > 0 ? dinheiro(k.valorTotal) : lacuna('valor por extenso')

  const v1 = vendedor(i.contratante, casal ? 'VENDEDOR I' : 'VENDEDOR', casal)
  const v2 = casal ? vendedor(i.vendedor2, 'VENDEDOR II', true) : null

  const topo: BlocoContrato[] = [
    { tipo: 'titulo', texto: TITULO },
    { tipo: 'p', texto: v1.paragrafo },
    ...(v2 ? [{ tipo: 'p' as const, texto: v2.paragrafo }] : []),
    {
      tipo: 'p',
      texto: `**INTERMEDIADOR: LIBERTY CAR VEICULOS LTDA**, pessoa jurídica de direito privado, inscrita no **CNPJ sob nº 55.116.497/0001-08**, com sede na **Av. Doutor Quinzinho, 995, Sala 4, Jardim Jorge Atalla, Jaú/SP – CEP 17.211-478**, neste ato representada por seu sócio administrador **${SOCIO}**, brasileiro, casado, empresário, portador do **CPF nº ${CPF_SOCIO}**, com telefone **(14) 99898-6940** endereço eletrônico **libertycar7@gmail.com.**`,
    },
    { tipo: 'p', texto: 'As partes acima entendem como justas as seguintes cláusulas e condições do presente contrato.' },
  ]

  const clausula1: BlocoContrato[] = [
    { tipo: 'secao', texto: '1. OBJETO' },
    {
      tipo: 'p',
      texto:
        '**1.1.** O presente contrato tem como objeto a prestação de serviços de intermediação para a venda de veículo automotor financiado, de propriedade do VENDEDOR e atualmente alienado fiduciariamente junto à instituição financeira, bem como a cessão, pelo VENDEDOR ao INTERMEDIADOR, dos direitos de posse e de negociação do referido veículo, com o fim específico de viabilizar sua quitação e transferência futura a terceiro interessado, durante o prazo de vigência contratual.',
    },
    {
      tipo: 'p',
      texto:
        '**1.1.1.** A presente cessão de direitos não implica transferência da propriedade, que permanecerá em nome do VENDEDOR até que ocorra a quitação integral do financiamento por terceiro e a subsequente regularização da titularidade junto aos órgãos competentes.',
    },
    { tipo: 'p', texto: '**1.2.** O veículo objeto deste contrato é de propriedade do VENDEDOR e possui as seguintes características:' },
    {
      tipo: 'tabela',
      linhas: [
        ['Marca', k.marca.trim()],
        ['Modelo', k.modelo.trim()],
        ['Ano', v.ano.trim()],
        ['Cor', k.cor.trim()],
        ['Placa', v.placa.trim().toUpperCase()],
        ['Chassi', k.chassi.trim().toUpperCase()],
        ['RENAVAM', v.renavam.trim()],
        ['Categoria', k.categoria.trim()],
        ['Estado de conservação', k.conservacao.trim()],
      ],
    },
    {
      tipo: 'p',
      texto: '**1.3.** O veículo acima descrito encontra-se financiado por meio de contrato com a instituição financeira abaixo mencionada, nas seguintes condições:',
    },
    {
      tipo: 'tabela',
      linhas: [
        ['Instituição financeira', p.banco.trim()],
        ['Tipo de financiamento', k.tipoFinanciamento.trim()],
        ['Valor total financiado', numeroDe(k.valorFinanciado) >= 0 ? moeda(k.valorFinanciado) : ''],
        ['Quantidade total de parcelas', qtdOk ? contagem(p.qtdParcelas) : ''],
        ['Valor de cada parcela', numeroDe(p.valorParcela) >= 0 ? moeda(p.valorParcela) : ''],
        ['Parcelas já quitadas', pagasOk ? contagem(p.parcelasPagas) : ''],
        ['Parcelas vincendas', vincendas],
        ['Parcelas em atraso', /^\d+$/.test(p.parcelasAtraso.trim()) ? contagem(p.parcelasAtraso) : ''],
        ['Saldo devedor aproximado', numeroDe(k.saldoDevedor) >= 0 ? moeda(k.saldoDevedor) : ''],
      ],
    },
    {
      tipo: 'p',
      texto:
        '**1.4.** O VENDEDOR declara e reconhece que o INTERMEDIADOR está autorizado a receber a posse do veículo, bem como a praticar todos os atos necessários à sua divulgação, promoção, exibição, anúncio e negociação junto a terceiros interessados, com a finalidade de concretizar sua venda mediante a quitação do financiamento junto à instituição credora.',
    },
    {
      tipo: 'p',
      texto:
        '**1.5.** A cessão de direitos de posse ao INTERMEDIADOR será exercida sob condição resolutiva, de forma que o INTERMEDIADOR se compromete a envidar todos os esforços para localizar, no prazo máximo de 24 (vinte e quatro) meses contados da assinatura deste contrato, um comprador que se disponha a quitar integralmente o financiamento vigente junto à instituição financeira credora, assumindo, quando cabível, as obrigações decorrentes do contrato de financiamento e promovendo a regularização da titularidade do veículo, dentro de 15 dias uteis, via órgãos públicos.',
    },
    {
      tipo: 'p',
      texto:
        '**1.5.1.** Caso não seja encontrado comprador dentro do prazo de 24 meses, obriga-se o INTERMEDIADOR a efetuar a quitação integral do saldo devedor junto à instituição financeira dentro de 15 dias uteis, assumindo, a partir de então, a plena propriedade e posse do veículo, com todas as responsabilidades e direitos inerentes à condição de novo proprietário.',
    },
    ...(k.limpaNome
      ? [
          {
            tipo: 'p' as const,
            texto:
              '**1.6.** Além dos serviços descritos nas cláusulas anteriores, está incluído no escopo contratual o serviço de “Limpa Nome”, consistindo na atuação do INTERMEDIADOR para viabilizar judicialmente e por quantas vezes necessárias a retirada do nome do VENDEDOR de cadastros de inadimplentes (como SPC, SERASA, SCPC e afins), exclusivamente em razão do financiamento do veículo objeto deste contrato, desde que este esteja sendo negociado nos termos do presente instrumento.',
          },
        ]
      : []),
  ]

  const clausulas2a4: BlocoContrato[] = [
    { tipo: 'secao', texto: '2. RESPONSABILIDADES E OBRIGAÇÕES DAS PARTES' },
    {
      tipo: 'p',
      texto:
        '**2.1.** O INTERMEDIADOR compromete-se a envidar esforços para localizar e intermediar a negociação com possível comprador interessado no referido veículo, dentro do prazo máximo de 24 (vinte e quatro) meses a contar da assinatura deste contrato.',
    },
    {
      tipo: 'p',
      texto:
        '**2.2.** As partes reconhecem que este contrato é firmado entre o INTERMEDIADOR e o VENDEDOR, e que eventual comprador do veículo será parte de contrato autônomo a ser celebrado futuramente com o INTERMEDIADOR, assumindo o compromisso de quitação do financiamento diretamente com a instituição financeira.',
    },
    {
      tipo: 'p',
      texto:
        '**2.3.** O INTERMEDIADOR atuará como facilitador entre o VENDEDOR e o futuro COMPRADOR, sendo responsável por assessorar, acompanhar e operacionalizar a transação, inclusive com vistas à regularização documental e eventual substituição do devedor fiduciário.',
    },
    {
      tipo: 'p',
      texto:
        '**2.4.** O VENDEDOR desde já autoriza o INTERMEDIADOR a representar seus interesses perante terceiros, inclusive junto à instituição financeira, mediante procuração pública específica a ser outorgada, se necessário.',
    },
    { tipo: 'p', texto: '**2.5.** São obrigações do INTERMEDIADOR:' },
    {
      tipo: 'alineas',
      itens: [
        'Envidar esforços, dentro dos limites éticos e legais, para localizar um COMPRADOR interessado na aquisição do veículo;',
        'Manter o VENDEDOR informado sobre o andamento das tratativas com possíveis compradores e sobre quaisquer alterações relevantes no processo de intermediação;',
        'Assessorar e acompanhar todas as etapas da negociação com o comprador, inclusive no que se refere à quitação do financiamento e à regularização documental do veículo;',
        'Assumir, caso não seja encontrado um comprador dentro do prazo previsto, a obrigação de adquirir o veículo nas condições estabelecidas na cláusula específica deste contrato;',
        'Atuar com diligência, boa-fé e transparência durante toda a execução do presente contrato, preservando os interesses de ambas as partes.',
        'O INTERMEDIADOR declara estar ciente de que assume o veículo com todas as pendências, débitos, encargos e obrigações a ele vinculados, sejam de natureza tributária, administrativa ou financeira, incluindo, mas não se limitando a, IPVA, licenciamento, multas de trânsito, taxas e demais débitos existentes, responsabilizando-se por sua regularização, salvo se houver acordo diferente, expressamente estabelecido entre as partes.',
      ],
    },
    { tipo: 'p', texto: '**2.6.** São obrigações do VENDEDOR:' },
    {
      tipo: 'alineas',
      itens: [
        'Fornecer todas as informações necessárias, corretas e atualizadas sobre o veículo e o financiamento vigente, incluindo eventuais débitos, restrições e ônus existentes;',
        'Entregar o veículo ao INTERMEDIADOR, caso acordado entre as partes, com os respectivos documentos, chaves, e em condições regulares de uso, conforme declaração no termo de entrega;',
        'Outorgar, quando solicitado, procuração pública com poderes específicos para que o INTERMEDIADOR possa representar seus interesses junto à instituição financeira, ao DETRAN e a terceiros, até a conclusão da operação;',
        'Abster-se de negociar, vender, prometer venda ou transferir o veículo a terceiros, enquanto vigente este contrato, salvo com a anuência expressa do INTERMEDIADOR;',
        'Responder pela veracidade das informações prestadas e por débitos anteriores à assinatura deste contrato, inclusive multas, impostos vencidos, licenciamento e outras obrigações vinculadas ao bem;',
        'Comunicar imediatamente ao INTERMEDIADOR qualquer mudança de endereço, telefone ou e-mail, bem como qualquer ocorrência que possa impactar a execução deste contrato;',
        'Cooperar com o INTERMEDIADOR para viabilizar a quitação do financiamento e a transferência do veículo, inclusive assinando os documentos que forem necessários.',
      ],
    },
    {
      tipo: 'p',
      texto:
        '**2.7.** O inadimplemento de qualquer cláusula ou obrigação assumida neste contrato por qualquer das partes acarretará a aplicação de multa não compensatória no valor de 20% (vinte por cento) sobre o valor estimado do saldo devedor do financiamento do veículo, sem prejuízo de indenização por perdas e danos e outras cominações legais aplicáveis, inclusive danos morais, se for o caso.',
    },

    { tipo: 'secao', texto: '3. PENHORA OU INDISPONIBILIDADE DO VEÍCULO' },
    {
      tipo: 'p',
      texto:
        '**3.1.** Caso o veículo objeto deste contrato venha a ser penhorado, apreendido, arrestado, tornado indisponível judicialmente ou administrativamente durante a vigência deste contrato, por dívidas de responsabilidade do VENDEDOR ou decorrentes de omissão de informações relevantes, será este o único responsável por tais medidas e suas consequências.',
    },
    { tipo: 'p', texto: '**3.2.** Nessas hipóteses, o INTERMEDIADOR poderá, a seu exclusivo critério:' },
    {
      tipo: 'alineas',
      itens: [
        'Rescindir o presente contrato imediatamente, sem necessidade de notificação judicial ou extrajudicial, com a exigência do pagamento de multa não compensatória de 20% (vinte por cento) sobre o valor estimado do saldo devedor e indenização por perdas e danos, se houver;',
        'Reter, a título de ressarcimento, valores eventualmente pagos ou depositados em nome do VENDEDOR, inclusive com compensação contra quaisquer prejuízos sofridos;',
        'Adotar medidas judiciais ou extrajudiciais para preservar os seus direitos, incluindo habilitação em eventual processo de execução, protesto de títulos ou inscrição em órgãos de proteção ao crédito, se for o caso.',
      ],
    },
    {
      tipo: 'p',
      texto:
        '**3.3.** O VENDEDOR declara, neste ato, não ter ciência de existência de ações judiciais, processos de execução, protestos ou débitos capazes de ensejar a penhora, indisponibilidade ou apreensão do veículo, assumindo responsabilidade integral por qualquer ônus oculto.',
    },

    { tipo: 'secao', texto: '4. DURAÇÃO DO CONTRATO' },
    {
      tipo: 'p',
      texto:
        '**4.1.** O presente contrato tem duração determinada de 24 (vinte e quatro) meses, com início na data de sua assinatura, podendo ser prorrogado mediante acordo escrito entre as partes.',
    },
    {
      tipo: 'p',
      texto:
        '**4.2.** Findo o prazo estabelecido na Cláusula 4.1, sem que tenha sido celebrado contrato de cessão com terceiro interessado, obriga-se o INTERMEDIADOR a efetuar a aquisição do referido veículo, nos termos e condições pactuados, assumindo integralmente o saldo devedor do financiamento junto à instituição financeira dentro do prazo de 15 dias úteis.',
    },
  ]

  const clausula5: BlocoContrato[] = [
    { tipo: 'secao', texto: '5. REMUNERAÇÃO DO INTERMEDIADOR' },
    {
      tipo: 'p',
      texto:
        '**5.1.** As partes reconhecem que a remuneração do INTERMEDIADOR será ajustada diretamente com o COMPRADOR, podendo este realizar o pagamento de valor adicional à quitação do financiamento como contrapartida pelos serviços de intermediação prestados, valor este que será devido exclusivamente ao INTERMEDIADOR e não constituirá crédito do VENDEDOR.',
    },
    {
      tipo: 'p',
      texto:
        '**5.2.** O VENDEDOR declara ciência e concordância com esta forma de remuneração, renunciando, desde já, a qualquer direito sobre os valores eventualmente recebidos pelo INTERMEDIADOR a título de comissão, ágio, taxa de intermediação ou similar.',
    },
    ...(k.seguroPrestamista
      ? [
          {
            tipo: 'p' as const,
            texto:
              '**5.3.** O VENDEDOR declara que o contrato de financiamento do veículo objeto deste instrumento contém seguro prestamista ou similar, o qual poderá gerar restituição de valores em caso de cancelamento.',
          },
          {
            tipo: 'p' as const,
            texto:
              '**5.3.1.** No ato da transferência da posse do veículo, o VENDEDOR compromete-se a outorgar ao INTERMEDIADOR procuração específica, com poderes para realizar, em seu nome, o cancelamento do referido seguro junto à instituição financeira ou seguradora responsável.',
          },
          {
            tipo: 'p' as const,
            texto:
              '**5.3.2.** Eventual valor devolvido em decorrência do cancelamento do seguro, seja via crédito bancário, cheque ou qualquer outra forma de restituição, deverá ser integralmente repassado ao INTERMEDIADOR no prazo máximo de 3 (três) dias úteis após o recebimento pelo VENDEDOR, sob pena de incorrer em multa não compensatória equivalente a 20% (vinte por cento) do valor restituído, além da obrigação de devolver o valor principal.',
          },
          {
            tipo: 'p' as const,
            texto:
              '**5.3.3.** O VENDEDOR reconhece que o valor a ser restituído pelo cancelamento do seguro pertence ao INTERMEDIADOR, em razão das tratativas e encargos assumidos por este no âmbito da intermediação da venda e quitação do financiamento do veículo.',
          },
        ]
      : []),
  ]

  const clausula6: BlocoContrato[] = [
    { tipo: 'secao', texto: '6. PAGAMENTO PELO VEÍCULO' },
    {
      tipo: 'p',
      texto: `**6.1.** Pelo presente instrumento, o INTERMEDIADOR paga ao VENDEDOR, a título de compensação pela cessão dos direitos de posse e negociação do veículo objeto deste contrato, o valor fixo de ${valorPago}, cuja quitação ocorrerá por meio de pagamento à vista até o dia ${dataCurta(k.dataPagamento)}.`,
    },
    {
      tipo: 'p',
      texto:
        '**6.2.** O VENDEDOR reconhece, por este instrumento, o recebimento do referido valor como justa e suficiente compensação pela cessão dos direitos de posse e comercialização do veículo, não havendo, após o pagamento, qualquer crédito ou expectativa de recebimento adicional, ainda que o veículo venha a ser quitado por terceiro ou pelo próprio INTERMEDIADOR.',
    },
    {
      tipo: 'p',
      texto:
        '**6.3.** O INTERMEDIADOR, por sua vez, compromete-se a buscar, no prazo contratual, terceiro interessado que se disponha a quitar o saldo devedor do financiamento diretamente junto à instituição financeira. Caso não seja possível localizar tal comprador, o INTERMEDIADOR assumirá, nos termos da cláusula 1.5, a obrigação de quitação do financiamento e se tornará proprietário do bem.',
    },
  ]

  const clausulas7a11: BlocoContrato[] = [
    { tipo: 'secao', texto: '7. RESCISÃO CONTRATUAL' },
    {
      tipo: 'p',
      texto: '**7.1.** O presente contrato poderá ser rescindido a qualquer tempo, observadas as hipóteses, condições e consequências estabelecidas nesta cláusula.',
    },
    {
      tipo: 'p',
      texto:
        '**7.2. Rescisão motivada:** Ocorrerá a rescisão imediata e de pleno direito, independentemente de aviso prévio, notificação judicial ou extrajudicial, caso qualquer das partes:',
    },
    {
      tipo: 'alineas',
      itens: [
        'Descumpra total ou parcialmente as obrigações previstas neste instrumento, especialmente aquelas estabelecidas neste instrumento;',
        'Preste informações falsas ou omita dados relevantes;',
        'Obstrua ou inviabilize o cumprimento das obrigações contratuais da outra parte;',
        'Cometa qualquer ato ilícito ou fraudulento relacionado ao presente contrato ou ao veículo objeto da intermediação.',
      ],
    },
    {
      tipo: 'p',
      texto:
        '**7.2.1.** A parte infratora responderá pelo pagamento de multa não compensatória equivalente a 20% (vinte por cento) do valor do saldo devedor do financiamento do veículo, vigente à data da infração contratual, bem como por eventuais danos, custas processuais, honorários advocatícios, despesas extrajudiciais e quaisquer outros prejuízos diretos ou indiretos decorrentes do rompimento antecipado por culpa sua.',
    },
    {
      tipo: 'p',
      texto:
        '**7.3. Rescisão imotivada:** Qualquer das partes poderá rescindir o presente contrato sem necessidade de justificar o motivo, desde que:',
    },
    {
      tipo: 'alineas',
      itens: [
        'Comunique a outra parte por escrito com antecedência mínima de 30 (trinta) dias;',
        'Não haja proposta formal de compra em andamento, nem obrigações assumidas pelo INTERMEDIADOR com terceiros.',
      ],
    },
    {
      tipo: 'p',
      texto:
        '**7.3.1.** Na hipótese de rescisão imotivada, a parte que der causa ao encerramento antecipado do contrato deverá arcar com o pagamento de multa compensatória equivalente a 20% (vinte por cento) do valor do saldo devedor do financiamento do veículo, vigente à data da rescisão, sem prejuízo do ressarcimento de eventuais despesas comprovadamente realizadas pela parte inocente em razão da execução deste contrato.',
    },
    {
      tipo: 'p',
      texto: '**7.4.** Este contrato poderá ser considerado rescindido automaticamente, sem penalidade para nenhuma das partes, nas seguintes situações:',
    },
    {
      tipo: 'alineas',
      itens: [
        'Morte ou incapacidade civil superveniente do(a) VENDEDOR(A) ou do INTERMEDIADOR;',
        'Alienação, bloqueio judicial, furto, roubo, perda total ou apreensão administrativa do veículo objeto deste contrato, que impeça sua comercialização;',
        'Recusa na entrega, da documentação essencial ou de quaisquer elementos indispensáveis à execução do contrato;',
        'Evento de força maior ou caso fortuito que torne impossível o cumprimento das obrigações assumidas por ambas as partes.',
      ],
    },
    { tipo: 'p', texto: '**7.5.** Em qualquer hipótese de rescisão:' },
    {
      tipo: 'alineas',
      itens: [
        'O INTERMEDIADOR deverá devolver os documentos originais do veículo em sua posse, salvo se houver cláusula de retenção vigente por descumprimento contratual;',
        'O VENDEDOR deverá ressarcir o INTERMEDIADOR por todas as despesas já incorridas em favor da negociação, tais como laudos, registros, cópias autenticadas, deslocamentos e outros custos operacionais devidamente comprovados;',
        'As partes se obrigam a assinar termo de rescisão, caso solicitado por qualquer uma delas, para formalização da extinção contratual;',
        'Cláusulas relativas a penalidades, responsabilidade civil, foro e confidencialidade continuarão a produzir efeitos mesmo após o término deste contrato.',
      ],
    },

    { tipo: 'secao', texto: '8. COMPARTILHAMENTO E TRATAMENTO DE DADOS' },
    {
      tipo: 'p',
      texto:
        '**8.1.** As partes declaram estar cientes e de acordo com o tratamento de seus dados pessoais fornecidos no presente contrato, que poderão ser utilizados exclusivamente para fins de execução das obrigações aqui assumidas, incluindo comunicação entre as partes, negociação com terceiros interessados, cumprimento de exigências legais, fiscais e administrativas, bem como diligências junto a instituições financeiras, cartórios, órgãos de trânsito e demais entidades envolvidas na operação.',
    },
    {
      tipo: 'p',
      texto:
        '**8.2.** O INTERMEDIADOR poderá compartilhar os dados do VENDEDOR com possíveis compradores, desde que limitado à finalidade de intermediação da venda do veículo e observadas as diretrizes da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).',
    },
    {
      tipo: 'p',
      texto:
        '**8.3.** Nenhuma das partes poderá divulgar os dados da outra para finalidades alheias ao contrato, sob pena de responsabilização civil e penal, salvo quando exigido por ordem judicial ou por autoridade competente.',
    },

    { tipo: 'secao', texto: '9. DECLARAÇÕES E GARANTIAS' },
    { tipo: 'p', texto: '**9.1.** O VENDEDOR declara que:' },
    {
      tipo: 'alineas',
      itens: [
        'É legítimo possuidor e proprietário do veículo objeto deste contrato e está legalmente autorizado a dispor dos direitos relativos ao bem, inclusive transferi-lo após quitação do financiamento;',
        'Está ciente de que o veículo se encontra alienado fiduciariamente junto a instituição financeira e que há saldo devedor pendente, conforme descrito neste contrato;',
        'Informou corretamente todos os dados relacionados ao veículo, ao financiamento e à sua situação jurídica pessoal, incluindo eventuais dívidas, restrições, bloqueios judiciais, pendências administrativas ou ônus que possam impactar a execução deste contrato;',
        'O veículo não está envolvido em ações judiciais, processos administrativos, disputas de propriedade, leilões, penhoras ou qualquer outra situação que impeça sua livre disposição ou negociação, salvo se expressamente informado neste instrumento;',
        'Não praticou, nem permitirá que sejam praticados, atos que possam comprometer ou dificultar a negociação do veículo com terceiros ou a regularização da documentação perante os órgãos competentes;',
        'Se compromete a entregar toda a documentação original e necessária à intermediação, cessão de direitos e posterior transferência do bem, assumindo integral responsabilidade caso haja omissão ou falsificação;',
        'Assume integral responsabilidade por débitos incidentes sobre o veículo anteriores à assinatura deste contrato, inclusive multas, IPVA, taxas de licenciamento, seguros e outros encargos.',
      ],
    },
    { tipo: 'p', texto: '**9.2.** O INTERMEDIADOR declara que:' },
    {
      tipo: 'alineas',
      itens: [
        'Compromete-se a atuar com diligência, boa-fé e transparência, observando os princípios éticos e legais que regem a atividade de intermediação;',
        'Não utilizará o veículo ou os dados recebidos para fins diversos dos estabelecidos neste contrato, salvo com consentimento expresso do(a) VENDEDOR(A).',
      ],
    },

    { tipo: 'secao', texto: '10. DISPOSIÇÕES GERAIS' },
    {
      tipo: 'p',
      texto:
        '**10.1.** Este contrato representa o acordo integral entre as partes, substituindo quaisquer entendimentos, propostas ou comunicações anteriores, verbais ou escritas, que tratem do mesmo objeto.',
    },
    {
      tipo: 'p',
      texto:
        '**10.2.** A eventual tolerância de uma parte para com a outra quanto ao descumprimento de cláusulas contratuais não constituirá novação ou renúncia de direitos, podendo a parte prejudicada exigir, a qualquer tempo, o cumprimento das obrigações pactuadas.',
    },
    {
      tipo: 'p',
      texto:
        '**10.3.** Nenhuma das partes poderá ceder ou transferir, total ou parcialmente, os direitos e obrigações decorrentes deste contrato sem o consentimento prévio e por escrito da outra parte.',
    },
    {
      tipo: 'p',
      texto:
        '**10.4.** As partes reconhecem a validade da assinatura eletrônica deste contrato, realizada por meio de plataformas digitais, sistemas de gestão contratual, e-mails com confirmação mútua ou qualquer outro meio eletrônico seguro, conferindo a este instrumento plena eficácia jurídica e força probatória, nos termos da legislação vigente, inclusive da Medida Provisória nº 2.200-2/2001.',
    },

    { tipo: 'secao', texto: '11. FORO' },
    {
      tipo: 'p',
      texto:
        '**11.1.** Para dirimir quaisquer dúvidas ou controvérsias oriundas deste contrato, as partes elegem o Foro da Comarca de Jaú/SP, com renúncia expressa a qualquer outro, por mais privilegiado que seja.',
    },
  ]

  const fecho: BlocoContrato[] = [
    { tipo: 'p', texto: `${LOCAL_ASSINATURA}, ${dataPorExtenso(hoje)}.` },
    {
      tipo: 'assinaturas',
      itens: [
        { nome: v1.nome, documento: `CPF nº ${v1.cpf}`, papel: casal ? 'VENDEDOR I' : 'VENDEDOR' },
        ...(v2 ? [{ nome: v2.nome, documento: `CPF nº ${v2.cpf}`, papel: 'VENDEDOR II' }] : []),
        { nome: SOCIO, documento: `CPF nº ${CPF_SOCIO}`, papel: 'INTERMEDIADOR' },
        ...assinaturasTestemunhas(i.compra.testemunhas),
      ],
    },
  ]

  return { titulo: TITULO, blocos: [...topo, ...clausula1, ...clausulas2a4, ...clausula5, ...clausula6, ...clausulas7a11, ...fecho] }
}

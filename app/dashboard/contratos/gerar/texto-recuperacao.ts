// Texto do "Contrato particular de prestação de serviços de análise, cancelamento
// e recuperação de valores". Transcrição do modelo em PDF: só as lacunas ([...])
// são variáveis. O texto jurídico NÃO deve ser alterado aqui sem aval do jurídico.
// (Retiradas apenas as sobras de edição do PDF: o "1. OBJETO / LIBERTY CAR" solto
// e o "Qualquer" duplicado na cláusula 7.1.)
//
// `**texto**` marca negrito (lido por ContratoBlocosDocument).

import { ESTADOS_CIVIS, labelEstadoCivil } from '@/utils/cobrancas/pessoa'
import { maskCPFCNPJ, maskPhone, onlyDigits } from '@/utils/masks'
import type { BlocoContrato, ContratoBlocos } from './blocos'
import { cpfFormatado, ou } from './texto-prestacao'
import { dataPorExtenso, lacuna } from './texto'
import type { GerarContratoInput } from './types'

const TITULO = 'CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ANÁLISE, CANCELAMENTO E RECUPERAÇÃO DE VALORES'
const LOCAL_ASSINATURA = 'Jaú/SP'

const SOCIO = 'OTÁVIO MORETTO'
const CPF_SOCIO = '520.525.368-17'
const TESTEMUNHAS = [
  { nome: 'ALESIS SILVA QUIO', cpf: '542.342.458-52', papel: 'TESTEMUNHA I' },
  { nome: 'ALEX RODRIGO LEVORATO PARRELLA', cpf: '262.988.758-83', papel: 'TESTEMUNHA II' },
]

export function montarRecuperacao(i: GerarContratoInput, hoje: Date = new Date()): ContratoBlocos {
  const c = i.contratante
  const v = i.veiculo
  const k = i.compra
  const conta = k.conta

  const nome = c.nome.trim() ? c.nome.trim().toUpperCase() : lacuna('NOME COMPLETO')
  const cpf = cpfFormatado(c.cpf)
  const estadoCivil = ESTADOS_CIVIS.some((e) => e.value === c.estadoCivil) ? labelEstadoCivil(c.estadoCivil).toLowerCase() : lacuna('estado civil')
  const telefone = onlyDigits(c.telefone) ? maskPhone(c.telefone) : lacuna('telefone')
  const docConta = onlyDigits(conta.documento) ? maskCPFCNPJ(conta.documento) : ''

  const topo: BlocoContrato[] = [
    { tipo: 'titulo', texto: TITULO },
    {
      tipo: 'p',
      texto: `**CONTRATANTE: ${nome},** ${ou(c.nacionalidade, 'nacionalidade')}, ${estadoCivil}, ${ou(c.profissao, 'profissão')}, portador do CPF nº ${cpf} e RG nº ${ou(c.rg, 'RG')}, com endereço na ${ou(c.endereco, 'endereço completo')}, com ${telefone} e endereço eletrônico ${ou(c.email, 'e-mail')}.`,
    },
    {
      tipo: 'p',
      texto: `**CONTRATADA: 55.116.497 OTAVIO MORETTO**, pessoa jurídica de direito privado, inscrita no **CNPJ sob nº 55.116.497/0001-08**, com sede na Av. Doutor Quinzinho, 995, Sala 4, Jardim Jorge Atalla, Jaú/SP, neste ato representada por seu sócio administrador **${SOCIO}**, brasileiro, casado, empresário, portador do CPF nº ${CPF_SOCIO}, e com endereço eletrônico otaviomoretto01@gmail.com.`,
    },
    {
      tipo: 'p',
      texto: 'As partes acima identificadas resolvem celebrar o presente Contrato de Prestação de Serviços, mediante as cláusulas e condições seguintes.',
    },
  ]

  const p = (texto: string): BlocoContrato => ({ tipo: 'p', texto })

  const clausulas: BlocoContrato[] = [
    { tipo: 'secao', texto: 'CLÁUSULA 1ª — DO OBJETO E DA PRESTAÇÃO DOS SERVIÇOS' },
    p('**1.1.** A **CONTRATADA** prestará serviços de análise documental de contratos bancários e de financiamento, com o objetivo de identificar valores potencialmente passíveis de cancelamento, contestação ou restituição.'),
    p('**1.2.** Os serviços poderão abranger seguros prestamistas, seguros de acidentes pessoais, seguros de proteção financeira e outras coberturas, bem como tarifas de cadastro, avaliação do bem e demais encargos que, conforme a análise do caso, possam ser passíveis de contestação ou restituição.'),
    p('**1.3.** A **CONTRATADA** poderá preparar, encaminhar e acompanhar solicitações administrativas perante bancos, financeiras, seguradoras e demais instituições responsáveis, mediante as autorizações necessárias.'),
    p('**1.4.** A **CONTRATADA** não garante a aprovação dos pedidos nem a recuperação de valores específicos, pois o resultado depende da análise dos documentos, das condições contratuais e das instituições envolvidas. A identificação de uma tarifa ou seguro não significa, por si só, que a cobrança seja indevida.'),
    p('**1.5.** Os serviços não incluem representação judicial, propositura de ações ou prática de atos privativos de advogados.'),

    { tipo: 'secao', texto: 'CLÁUSULA 2ª — DA AUSÊNCIA DE PAGAMENTO ANTECIPADO E DOS HONORÁRIOS' },
    p('**2.1.** O **CONTRATANTE** não pagará entrada, taxa de adesão ou qualquer valor antecipado pelos serviços contratados.'),
    p('**2.2.** Como remuneração, a **CONTRATADA** terá direito a **50% (cinquenta por cento)** dos valores efetivamente recuperados em decorrência direta dos serviços prestados, sendo os outros **50%** destinados ao **CONTRATANTE**.'),
    p('**2.3.** Os honorários somente serão devidos após o recebimento efetivo dos valores pelo **CONTRATANTE**. A simples identificação de valores, o envio de solicitações ou a aprovação ainda não concretizada de uma restituição não gera obrigação de pagamento.'),
    p('**2.4.** Caso não haja recuperação financeira, nenhum honorário será cobrado. Eventuais despesas adicionais somente poderão ser cobradas mediante prévia informação e autorização expressa do **CONTRATANTE**.'),
    p('**2.5.** O pagamento será realizado pelo **CONTRATANTE** à **CONTRATADA**, via **PIX** na chave **“e-mail – libertycred01@gmail.com”**, transferência bancária ou outro meio acordado, em até 2 (dois) dias úteis após o recebimento e a disponibilização dos valores restituídos. Em caso de restituição parcelada, os honorários serão pagos proporcionalmente a cada parcela recebida.'),
    p('**2.6.** O **CONTRATANTE** compromete-se a comunicar o recebimento dos valores relacionados aos serviços e, quando solicitado de forma razoável, apresentar comprovante para conferência dos honorários.'),

    { tipo: 'secao', texto: 'CLÁUSULA 3ª — DO INADIMPLEMENTO E DAS MEDIDAS DE COBRANÇA' },
    p('**3.1.** Caso o **CONTRATANTE** receba os valores recuperados e deixe de pagar os honorários devidos no prazo estabelecido, sem justificativa legítima, ficará caracterizado o inadimplemento contratual.'),
    p('**3.2.** Sobre os honorários vencidos e não pagos poderão incidir **multa** moratória de **2% (dois por cento),** correção monetária e juros de mora, observados os limites legais aplicáveis.'),
    p('**3.3.** Persistindo a inadimplência, a **CONTRATADA** poderá realizar cobrança extrajudicial e, se necessário, adotar as medidas judiciais cabíveis para exigir o pagamento, desde que disponha de elementos que comprovem a prestação dos serviços, o recebimento da restituição e o valor dos honorários devidos.'),
    p('**3.4.** Eventuais honorários advocatícios e demais encargos decorrentes de cobrança judicial serão exigidos conforme a legislação aplicável e, quando cabível, mediante fixação judicial.'),
    p('**3.5.** A cobrança deverá respeitar os direitos do **CONTRATANTE**, sendo vedados constrangimentos, ameaças, exposição pública ou qualquer meio ilícito de cobrança.'),

    { tipo: 'secao', texto: 'CLÁUSULA 4ª — DAS AUTORIZAÇÕES E DAS OBRIGAÇÕES DAS PARTES' },
    p('**4.1.** O **CONTRATANTE** autoriza a **CONTRATADA** a analisar os documentos fornecidos, preparar e encaminhar solicitações administrativas e acompanhar os procedimentos abrangidos por este contrato.'),
    p('**4.2.** Quando necessário, o **CONTRATANTE** deverá assinar autorização, procuração específica ou formulário exigido pela instituição responsável, com indicação dos poderes concedidos.'),
    p('**4.3.** Nenhum cancelamento de seguro deverá ser solicitado sem a autorização específica do **CONTRATANTE**. Este declara estar ciente de que o cancelamento poderá resultar na perda ou redução das coberturas contratadas e não implica, automaticamente, quitação ou redução do saldo do financiamento.'),
    p('**4.4.** O **CONTRATANTE** compromete-se a fornecer informações verdadeiras, disponibilizar os documentos necessários, comunicar o recebimento de valores e cumprir as obrigações de pagamento previstas neste instrumento.'),
    p('**4.5.** A **CONTRATADA** compromete-se a atuar com diligência, transparência e boa-fé, respeitar os limites das autorizações concedidas, manter registros pertinentes e informar ao **CONTRATANTE**, quando possível, o andamento dos procedimentos.'),
    p('**4.6.** Este contrato não autoriza a **CONTRATADA** a movimentar contas bancárias do **CONTRATANTE**, contratar empréstimos em seu nome ou praticar atos não expressamente autorizados. A **CONTRATADA** não solicitará senhas bancárias ou códigos pessoais de autenticação.'),

    { tipo: 'secao', texto: 'CLÁUSULA 5ª — DO PRAZO, ENCERRAMENTO E PROTEÇÃO DE DADOS' },
    p('**5.1.** O contrato entra em vigor na data de sua assinatura e permanecerá vigente até a conclusão dos procedimentos, sem prazo fixo, considerando os prazos de resposta das instituições envolvidas.'),
    p('**5.2.** Qualquer parte poderá solicitar o encerramento da contratação mediante comunicação escrita, observadas as disposições legais aplicáveis. O encerramento não autoriza a cobrança de honorários sobre valores não recuperados, sem prejuízo da apuração de valores posteriormente recebidos que decorram comprovadamente dos serviços prestados, conforme a legislação aplicável.'),
    p('**5.3.** Nas contratações realizadas fora do estabelecimento comercial, inclusive por telefone ou meio eletrônico, será respeitado o direito de arrependimento previsto na legislação consumerista, quando aplicável.'),
    p('**5.4.** Os dados pessoais e documentos do **CONTRATANTE** serão tratados na medida necessária à execução do contrato, podendo ser compartilhados com bancos, financeiras, seguradoras e profissionais habilitados quando necessário aos procedimentos autorizados ou ao cumprimento de obrigações legais, em conformidade com a Lei nº 13.709/2018 (LGPD).'),
    p('**5.5.** As partes poderão utilizar telefone, WhatsApp e e-mail para comunicações e envio de documentos relacionados ao contrato, observadas as exigências legais aplicáveis.'),

    { tipo: 'secao', texto: 'CLÁUSULA 6ª — DAS DISPOSIÇÕES GERAIS' },
    p('**6.1.** Qualquer alteração relevante deste contrato deverá ser formalizada por escrito e aceita pelas partes.'),
    p('**6.2.** O presente instrumento será interpretado conforme a legislação brasileira, especialmente as normas contratuais e de proteção ao consumidor.'),
    p('**6.3.** Para eventuais controvérsias, será observado o foro legalmente competente, respeitadas as regras de proteção ao consumidor.'),
  ]

  const anexo: BlocoContrato[] = [
    { tipo: 'secao', texto: 'ANEXO — IDENTIFICAÇÃO DO CONTRATO E DOS SERVIÇOS' },
    {
      tipo: 'tabela',
      linhas: [
        ['Marca', k.marca.trim()],
        ['Modelo', k.modelo.trim()],
        ['Ano', v.ano.trim()],
        ['Cor', k.cor.trim()],
        ['Placa', v.placa.trim().toUpperCase()],
        ['Chassi', k.chassi.trim().toUpperCase()],
        ['Renavam', v.renavam.trim()],
        ['Categoria', k.categoria.trim()],
        ['Estado de Conservação', k.conservacao.trim()],
        ['Alienação Fiduciaria', i.prestacao.banco.trim()],
        ['N° Contrato', k.numeroContrato.trim()],
      ],
    },
    p('O **CONTRATANTE** declara estar ciente dos serviços assinalados e autoriza a **CONTRATADA** a realizar os procedimentos administrativos correspondentes, nos limites deste contrato e das autorizações específicas eventualmente exigidas.'),
    {
      tipo: 'tabela',
      linhas: [
        ['Titular da Conta', conta.titular.trim()],
        ['CPF/CNPJ do Titular', docConta],
        ['Banco', conta.banco.trim()],
        ['Agencia', conta.agencia.trim()],
        ['Conta', conta.conta.trim()],
        ['Tipo da Conta', conta.tipoConta.trim()],
        ['Chave PIX', conta.chavePix.trim()],
      ],
    },
  ]

  const foro: BlocoContrato[] = [
    { tipo: 'secao', texto: 'CLÁUSULA 7ª — FORO' },
    p('**7.1.** Para dirimir quaisquer dúvidas ou controvérsias oriundas deste contrato, as partes elegem o Foro da Comarca de Jaú/SP, com renúncia expressa a qualquer outro, por mais privilegiado que seja.'),
    { tipo: 'p', texto: `${LOCAL_ASSINATURA}, ${dataPorExtenso(hoje)}.` },
    {
      tipo: 'assinaturas',
      itens: [
        { nome: nome, documento: `CPF nº ${cpf}`, papel: 'CONTRATANTE' },
        { nome: SOCIO, documento: `CPF nº ${CPF_SOCIO}`, papel: 'CONTRATADA' },
        ...TESTEMUNHAS.map((t) => ({ nome: t.nome, documento: `CPF n° ${t.cpf}`, papel: t.papel })),
      ],
    },
  ]

  return { titulo: TITULO, blocos: [...topo, ...clausulas, ...anexo, ...foro] }
}

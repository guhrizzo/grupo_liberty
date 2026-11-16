// Texto do "Contrato de promessa de compra de veículo financiado com assunção
// de obrigações". Transcrição do modelo em PDF: só as lacunas ([...]) são
// variáveis. O texto jurídico NÃO deve ser alterado aqui sem aval do jurídico.
//
// `**texto**` marca negrito (lido por ContratoBlocosDocument).

import { ESTADOS_CIVIS, labelEstadoCivil } from '@/utils/cobrancas/pessoa'
import { maskCPFCNPJ, maskPhone, onlyDigits } from '@/utils/masks'
import type { BlocoContrato, ContratoBlocos } from './blocos'
import { dataPorExtenso, dinheiro, inteiroPorExtenso, meses } from './texto'
import {
  FORMAS_PAGAMENTO,
  INTERMEDIADOR_PADRAO,
  TESTEMUNHAS_PADRAO,
  TIPO_PROMESSA_PARCELADA,
  numeroDe,
  type GerarContratoInput,
} from './types'

/**
 * Intermediador e testemunhas da promessa à vista: fixos. Na parcelada os mesmos
 * dados são só o valor inicial do formulário (INTERMEDIADOR_PADRAO).
 */
export const INTERMEDIADOR = {
  empresa: INTERMEDIADOR_PADRAO.razaoSocial,
  cnpj: maskCPFCNPJ(INTERMEDIADOR_PADRAO.cnpj),
  endereco: INTERMEDIADOR_PADRAO.endereco,
  socio: INTERMEDIADOR_PADRAO.nome,
  cpf: maskCPFCNPJ(INTERMEDIADOR_PADRAO.cpf),
  email: INTERMEDIADOR_PADRAO.email,
}

export const TESTEMUNHAS = TESTEMUNHAS_PADRAO.map((t, idx) => ({
  nome: t.nome,
  cpf: maskCPFCNPJ(t.cpf),
  papel: idx === 0 ? 'TESTEMUNHA I' : 'TESTEMUNHA II',
}))

export const LOCAL_ASSINATURA = 'Jaú/SP'

const FORMA_TEXTO: Record<string, string> = {
  pix: 'PIX',
  transferencia: 'transferência bancária',
  dinheiro: 'dinheiro',
}

const brl = (raw: string) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeroDe(raw))

// Campo ainda não preenchido vira "[rótulo]" (a prévia destaca; o contrato
// gerado só sai com tudo preenchido, pois o formulário é validado antes).
const lacuna = (rotulo: string) => `[${rotulo}]`
const ou = (valor: string, rotulo: string) => valor.trim() || lacuna(rotulo)
const moeda = (raw: string, rotulo: string) => (numeroDe(raw) >= 0 ? brl(raw) : lacuna(rotulo))
const contagem = (raw: string, rotulo: string) => (/^\d+$/.test(raw.trim()) ? String(Number(raw)) : lacuna(rotulo))

/** "um" → "uma", "dois" → "duas" (parcelas), inclusive ao fim de "vinte e um". */
const feminino = (extenso: string) => extenso.replace(/\bum$/, 'uma').replace(/\bdois$/, 'duas')

/** "2026-11-16" → "16/11/2026" (vazio se inválida). */
function dataCurta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** "2026-11-16" → "16 de novembro de 2026" (lacuna se inválida). */
function dataLonga(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? dataPorExtenso(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : lacuna('data')
}

export function montarPromessa(i: GerarContratoInput, hoje: Date = new Date()): ContratoBlocos {
  const parcelado = i.tipo === TIPO_PROMESSA_PARCELADA
  const c = i.contratante
  const v = i.veiculo
  const k = i.compra
  const p = i.prestacao
  const qtdOk = /^\d+$/.test(p.qtdParcelas.trim())
  const pagasOk = /^\d+$/.test(p.parcelasPagas.trim())
  const vincendas = qtdOk && pagasOk ? String(Math.max(0, Number(p.qtdParcelas) - Number(p.parcelasPagas))) : lacuna('parcelas vincendas')
  const forma = FORMA_TEXTO[k.formaPagamento] ?? FORMAS_PAGAMENTO.find((f) => f.value === k.formaPagamento)?.label ?? lacuna('forma de pagamento')
  const nomeComprador = c.nome.trim() ? c.nome.trim().toUpperCase() : lacuna('NOME COMPLETO')
  const cpfComprador = onlyDigits(c.cpf) ? maskCPFCNPJ(c.cpf) : lacuna('CPF')
  const estadoCivil = ESTADOS_CIVIS.some((e) => e.value === c.estadoCivil) ? labelEstadoCivil(c.estadoCivil).toLowerCase() : lacuna('estado civil')
  const telefone = onlyDigits(c.telefone) ? maskPhone(c.telefone) : lacuna('telefone')
  const prazoQuitacao = /^[1-9]\d*$/.test(k.prazoQuitacao.trim()) ? meses(k.prazoQuitacao) : lacuna('prazo em meses')
  const valorTotal = numeroDe(k.valorTotal) > 0 ? dinheiro(k.valorTotal) : lacuna('valor total')

  // Trechos iguais nas duas variantes: objeto (cláusula 1), cláusulas 2 a 5, 7.1 a 7.3.1 e 8 a 11.
  const objeto: BlocoContrato[] = [
    { tipo: 'secao', texto: '1. OBJETO' },
    {
      tipo: 'p',
      texto:
        '**1.1.** O presente contrato tem por objeto a promessa do **COMPRADOR** de compra de veículo automotor abaixo descrito, atualmente financiado junto a instituição financeira e de titularidade de terceiro, cuja intermediação é realizada pelo **INTERMEDIADOR**.',
    },
    { tipo: 'p', texto: '**1.2.** O veículo objeto deste contrato possui as seguintes características:' },
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
      texto:
        '**1.3.** O veículo acima descrito encontra-se financiado por meio de contrato com a instituição financeira abaixo mencionada, nas seguintes condições:',
    },
    {
      tipo: 'tabela',
      linhas: [
        ['Instituição financeira', p.banco.trim()],
        ['Tipo de financiamento', k.tipoFinanciamento.trim()],
        ['Valor total financiado', k.valorFinanciado.trim() ? moeda(k.valorFinanciado, '') : ''],
        ['Quantidade total de parcelas', p.qtdParcelas.trim() ? contagem(p.qtdParcelas, '') : ''],
        ['Valor de cada parcela', p.valorParcela.trim() ? moeda(p.valorParcela, '') : ''],
        ['Parcelas já quitadas', p.parcelasPagas.trim() ? contagem(p.parcelasPagas, '') : ''],
        ['Parcelas vincendas', qtdOk && pagasOk ? vincendas : ''],
        ['Parcelas em atraso', p.parcelasAtraso.trim() ? contagem(p.parcelasAtraso, '') : ''],
        ['Saldo devedor aproximado', k.saldoDevedor.trim() ? moeda(k.saldoDevedor, '') : ''],
      ],
    },
    {
      tipo: 'p',
      texto: `**1.3.1.** O **COMPRADOR** se compromete a quitar as parcelas do financiamento em até ${prazoQuitacao} contados a partir da assinatura deste instrumento.`,
    },
    {
      tipo: 'p',
      texto:
        '**1.4.** O **COMPRADOR** declara ter ciência de que o presente contrato decorre de operação de intermediação previamente estabelecida entre o **INTERMEDIADOR** e o legítimo proprietário do veículo (VENDEDOR), conforme contrato de prestação de serviços e procuração pública, cujas condições principais foram informadas previamente ao COMPRADOR.',
    },
  ]

  const clausulas2a5: BlocoContrato[] = [
    { tipo: 'secao', texto: '2. RESPONSABILIDADES E OBRIGAÇÕES DAS PARTES' },
    { tipo: 'p', texto: '**2.1.** São obrigações do **INTERMEDIADOR**:' },
    {
      tipo: 'alineas',
      itens: [
        'Disponibilizar ao **COMPRADOR**, no ato da assinatura deste contrato, os documentos essenciais do veículo, incluindo o CRLV, comprovante do financiamento, extrato de parcelas já quitadas e procuração pública;',
        'Fornecer ao **COMPRADOR** todas as instruções e informações necessárias para o correto pagamento das parcelas vincendas do financiamento diretamente à instituição financeira;',
        'Acompanhar e monitorar a regularidade dos pagamentos do financiamento, podendo exigir, a qualquer tempo, os comprovantes de quitação das parcelas realizadas;',
        'Acompanhar a formalização da entrega definitiva do CRV e demais documentos originais, bem como a assinatura da procuração pública para prosseguir com a transferência do veículo após a quitação;',
        'Atuar como facilitador na transição documental junto ao antigo proprietário e órgãos públicos, inclusive auxiliando na comunicação com a instituição financeira e o DETRAN, sempre que necessário.',
      ],
    },
    { tipo: 'p', texto: '**2.2.** São obrigações do COMPRADOR:' },
    {
      tipo: 'alineas',
      itens: [
        'Assumir total responsabilidade pela quitação do saldo devedor do financiamento do veículo, mediante o pagamento direto perante a instituição financeira credora, no prazo determinado na Cláusula 1.3.1, em uma parcela única;',
        'Enviar ao INTERMEDIADOR o comprovante de pagamento do financiamento, após a quitação;',
        'Arcar integralmente com os encargos incidentes sobre o veículo a partir da data de assinatura deste contrato, incluindo, mas não se limitando a: IPVA, licenciamento, multas de trânsito, taxas de regularização, seguro obrigatório, seguro facultativo, despesas de manutenção e conservação;',
        'Cadastrar-se como condutor principal do veículo junto aos órgãos de trânsito competentes, responsabilizando-se por eventuais infrações, multas, pontuações na CNH, bem como por quaisquer encargos decorrentes do uso do veículo a partir da data da assinatura deste contrato;',
        'Preservar a integridade e o bom estado do veículo, sendo responsável por quaisquer avarias, perdas, sinistros ou danos decorrentes de uso imprudente, negligente ou de terceiros sob sua responsabilidade, ainda que o veículo não esteja formalmente transferido;',
        'Abster-se de alienar, prometer venda, ceder, alugar, emprestar ou transferir a terceiros, total ou parcialmente, os direitos sobre o veículo, até a quitação integral do financiamento e formalização da cessão de titularidade;',
        'Promover, após a quitação, o registro da transferência da titularidade do veículo em seu nome junto ao DETRAN, assumindo integral responsabilidade por multas decorrentes da não transferência.',
      ],
    },
    {
      tipo: 'p',
      texto:
        '**2.3.** O inadimplemento de qualquer cláusula ou obrigação assumida neste contrato por qualquer das partes acarretará a aplicação de multa não compensatória no valor de 20% (vinte por cento) sobre o valor estimado do saldo devedor do financiamento do veículo, sem prejuízo de indenização por perdas e danos e outras cominações legais aplicáveis, inclusive danos morais, se for o caso.',
    },

    { tipo: 'secao', texto: '3. INDISPONIBILIDADE, RESTRIÇÃO OU BLOQUEIO DO VEÍCULO' },
    {
      tipo: 'p',
      texto:
        '**3.1.** As partes reconhecem que o veículo objeto do presente compromisso ainda se encontra formalmente registrado em nome de terceiro (**VENDEDOR** original) e alienado fiduciariamente a instituição financeira, razão pela qual o INTERMEDIADOR não possui, até a conclusão da transação, domínio pleno sobre o bem.',
    },
    {
      tipo: 'p',
      texto:
        '**3.2.** Caso, após a assinatura deste contrato, seja identificada qualquer restrição judicial, administrativa, bloqueio, indisponibilidade, penhora, gravame oculto, apontamento de furto, duplicidade de registro ou qualquer outro impedimento à circulação, uso ou transferência do veículo, que não tenha sido previamente informado, o **INTERMEDIADOR** não poderá ser responsabilizado por tais fatos, eis que alheios à sua vontade e originados por terceiros.',
    },
    {
      tipo: 'p',
      texto:
        '**3.3.** Nessas hipóteses, o **INTERMEDIADOR** se compromete a envidar os esforços cabíveis para solucionar a restrição junto ao **VENDEDOR** original.',
    },
    {
      tipo: 'p',
      texto:
        '**3.4.** O COMPRADOR declara estar ciente de que tais impedimentos podem existir, e que, por serem de responsabilidade exclusiva do **VENDEDOR** original, não gerarão direito à rescisão contratual com penalidade contra o **INTERMEDIADOR**, nem ensejarão qualquer indenização, compensação ou devolução de valores por parte deste.',
    },
    {
      tipo: 'p',
      texto:
        '**3.5.** Caso a indisponibilidade ou restrição seja insanável e torne impossível a transferência da titularidade ou a regular utilização do veículo, as partes poderão, de comum acordo, resolver este contrato de forma consensual, sem aplicação de penalidades ao **INTERMEDIADOR**, ficando ressalvado o direito do **COMPRADOR** de reaver valores eventualmente pagos, diretamente junto ao **VENDEDOR**, mediante as medidas legais cabíveis.',
    },

    { tipo: 'secao', texto: '4. QUITAÇÃO DO FINANCIAMENTO E TRANSFERÊNCIA DE TITULARIDADE' },
    {
      tipo: 'p',
      texto:
        '**4.1.** A posse do veículo será transferida ao COMPRADOR no ato da assinatura deste contrato, mediante a lavratura de Termo de Entrega contendo o estado de conservação do bem, assinado por ambas as partes.',
    },
    {
      tipo: 'p',
      texto:
        '**4.1.1.** O **COMPRADOR** declara ter ciência de que, enquanto não houver quitação integral do financiamento e transferência formal da titularidade, o veículo permanecerá registrado em nome de terceiro, assumindo desde já todas as responsabilidades pela posse e uso do bem.',
    },
    {
      tipo: 'p',
      texto:
        '**4.2.** Caso o **COMPRADOR**, por qualquer motivo, abandone a negociação, inadimple com o financiamento ou descumpra as obrigações contratuais, o **INTERMEDIADOR** poderá declarar o contrato rescindido por inadimplemento e tomar as medidas legais cabíveis para a reintegração de posse do veículo, se necessário, além do pagamento de multa rescisória especificada na Cláusula 7.',
    },
    {
      tipo: 'p',
      texto:
        '**4.3.** O **COMPRADOR** obriga-se a quitar integralmente o saldo devedor do financiamento do veículo junto à instituição financeira, assumindo todos os valores, encargos, juros e eventuais custos administrativos, conforme previamente informado pelo **INTERMEDIADOR**.',
    },
    {
      tipo: 'p',
      texto:
        '**4.4.** A transferência da titularidade perante o DETRAN deverá ser realizada pelo **COMPRADOR** em até 10 (dez) dias úteis contados da entrega dos documentos, assumindo o mesmo integral responsabilidade por:',
    },
    {
      tipo: 'alineas',
      itens: [
        'Custas de cartório, taxas de transferência, emplacamento, seguro obrigatório e outros encargos administrativos;',
        'Multas e penalidades legais pela não transferência dentro do prazo legal;',
        'Danos causados a terceiros ou ao veículo durante o período em que já o utilizava, mas ainda não era formalmente proprietário.',
      ],
    },
    {
      tipo: 'p',
      texto:
        '**4.5.** O INTERMEDIADOR não poderá ser responsabilizado por qualquer evento, ônus ou responsabilidade decorrente da não efetivação da transferência pelo COMPRADOR após a regularização financeira.',
    },

    { tipo: 'secao', texto: '5. DURAÇÃO DO CONTRATO' },
    {
      tipo: 'p',
      texto:
        '**5.1.** O presente contrato vigorará por prazo indeterminado, com início na data de sua assinatura e perdurará até a efetiva transferência da titularidade do veículo em nome do COMPRADOR, o que deverá ocorrer após a quitação integral do financiamento junto à instituição financeira e o cumprimento de todas as demais obrigações assumidas neste instrumento.',
    },
    {
      tipo: 'p',
      texto:
        '**5.2.** A eventual ausência ou atraso na quitação do financiamento ou na transferência do veículo, por culpa exclusiva do COMPRADOR, não extinguirá automaticamente o presente contrato, permanecendo este vigente e exigível até o cumprimento integral das obrigações, sem prejuízo da aplicação das penalidades cabíveis.',
    },
    {
      tipo: 'p',
      texto:
        '**5.3.** A rescisão deste contrato antes da efetiva transferência da titularidade somente poderá ocorrer nas hipóteses previstas na cláusula específica de rescisão, mediante formalização por escrito e observância das penalidades estipuladas.',
    },
  ]

  // Só na promessa à vista.
  const topoAvista: BlocoContrato[] = [
    { tipo: 'titulo', texto: 'CONTRATO DE PROMESSA DE COMPRA DE VEÍCULO FINANCIADO COM ASSUNÇÃO DE OBRIGAÇÕES' },
    {
      tipo: 'p',
      texto: `**COMPRADOR: ${nomeComprador}**, ${ou(c.nacionalidade, 'nacionalidade')}, ${estadoCivil}, ${ou(c.profissao, 'profissão')}, portador do **CPF nº ${cpfComprador}**, com endereço na ${ou(c.endereco, 'endereço completo')}, com **${telefone}** e endereço eletrônico **${ou(c.email, 'e-mail')}**.`,
    },
    {
      tipo: 'p',
      texto: `**INTERMEDIADOR: ${INTERMEDIADOR.empresa},** pessoa jurídica de direito privado, inscrita no **CNPJ sob nº ${INTERMEDIADOR.cnpj},** com sede na ${INTERMEDIADOR.endereco}, neste ato representada por seu sócio administrador **${INTERMEDIADOR.socio},** brasileiro, casado, empresário, portador do **CPF nº ${INTERMEDIADOR.cpf},** e com endereço eletrônico **${INTERMEDIADOR.email}**.`,
    },
    { tipo: 'p', texto: 'As partes acima entendem como justas as seguintes cláusulas e condições do presente contrato.' },
  ]

  const pagamentoAvista: BlocoContrato[] = [
    { tipo: 'secao', texto: '6. PAGAMENTO' },
    {
      tipo: 'p',
      texto: `**6.1.** Pelo presente contrato, o **COMPRADOR** se compromete a pagar ao **INTERMEDIADOR** o valor total de **${valorTotal}**, a título de preço pela aquisição do veículo.`,
    },
    {
      tipo: 'p',
      texto: `**6.2.** O pagamento do valor integral previsto no item 6.1 será realizado à vista, em parcela única, mediante pagamento em **${forma}**, na data de assinatura deste contrato.`,
    },
    {
      tipo: 'p',
      texto:
        '**6.3.** O pagamento será considerado efetivamente quitado após a confirmação do recebimento integral do valor pelo **INTERMEDIADOR**.',
    },
    {
      tipo: 'p',
      texto:
        '**6.4.** O valor referido nesta cláusula abrange o direito de posse e futura propriedade do veículo, bem como a intermediação e cessão de direitos realizadas pelo **INTERMEDIADOR**, sendo considerado quitado após a efetivação do pagamento integral.',
    },
  ]

  const suspensaoAvista: BlocoContrato[] = [
    { tipo: 'secao', texto: '7.4. DA SUSPENSÃO POR IMPOSSIBILIDADE SUPERVENIENTE:' },
    {
      tipo: 'p',
      rotulo: '7.4.1.',
      texto:
        'Na ocorrência de qualquer evento que impossibilite temporária ou permanentemente a continuidade do contrato por fato alheio à vontade das partes — incluindo, mas não se limitando a, busca e apreensão, bloqueio judicial, furto, roubo ou sinistro com perda total —, o contrato não será automaticamente rescindido, mas terá sua eficácia e seus pagamentos suspensos pelo prazo de até 180 (cento e oitenta) dias.',
    },
    {
      tipo: 'p',
      rotulo: '7.4.2.',
      texto:
        'Durante o período de suspensão, o(a) **INTERMEDIADOR**(A) se compromete a adotar, às suas expensas, as medidas cabíveis para solucionar o impedimento.',
    },
    {
      tipo: 'p',
      rotulo: '7.4.3.',
      texto: 'Se o impedimento for solucionado dentro do prazo de suspensão, o contrato será reativado e voltará a vigorar em seus termos originais.',
    },
    {
      tipo: 'p',
      rotulo: '7.4.4.',
      texto:
        'Se, ao final do prazo de suspensão, o impedimento não tiver sido solucionado, o contrato será considerado definitivamente rescindido. Nesta hipótese, o(a) **INTERMEDIADOR(A)** restituirá ao(à) **CESSIONÁRIO(A)** os valores por este pagos, com a devida correção monetária, operando-se a mútua e plena quitação, nada mais sendo devido a título de multas ou indenizações.',
    },
  ]

  const fechoAvista: BlocoContrato[] = [
    { tipo: 'p', texto: `${LOCAL_ASSINATURA}, ${dataPorExtenso(hoje)}.` },
    {
      tipo: 'assinaturas',
      itens: [
        { nome: nomeComprador, documento: `CPF nº ${cpfComprador}`, papel: 'COMPRADOR(A)' },
        { nome: INTERMEDIADOR.socio, documento: `CPF nº ${INTERMEDIADOR.cpf}`, papel: 'INTERMEDIADOR' },
        ...TESTEMUNHAS.map((t) => ({ nome: t.nome, documento: `CPF n° ${t.cpf}`, papel: t.papel })),
      ],
    },
  ]

  const rescisao: BlocoContrato[] = [
    { tipo: 'secao', texto: '7. RESCISÃO CONTRATUAL' },
    {
      tipo: 'p',
      texto:
        '**7.1.** O presente contrato poderá ser rescindido a qualquer tempo, desde que respeitadas as hipóteses, condições e consequências previstas nesta cláusula.',
    },
    {
      tipo: 'p',
      texto:
        '**7.2. Rescisão motivada:** A rescisão deste contrato poderá ocorrer de forma imediata e de pleno direito, sem necessidade de aviso prévio, notificação judicial ou extrajudicial, nos seguintes casos:',
    },
    {
      tipo: 'alineas',
      itens: [
        'Descumprimento, total ou parcial, de quaisquer das obrigações assumidas neste contrato por qualquer das partes;',
        'Prestação de informações falsas, omissão de dados relevantes ou conduta que cause prejuízo direto à outra parte;',
        'Ações ou omissões que obstruam ou inviabilizem o cumprimento das obrigações contratuais, inclusive a quitação do financiamento ou a regularização documental;',
        'Prática de atos ilícitos, fraudulentos ou contrários à boa-fé objetiva, relacionados ao presente contrato, ao veículo ou à sua negociação.',
      ],
    },
    {
      tipo: 'p',
      texto:
        '**7.2.1.** A parte que der causa à rescisão motivada responderá pelo pagamento de multa não compensatória equivalente a 20% (vinte por cento) do valor atualizado do saldo devedor do financiamento, vigente na data da infração contratual, bem como por eventuais danos, custas processuais, honorários advocatícios, despesas extrajudiciais e quaisquer outros prejuízos diretos ou indiretos decorrentes do rompimento antecipado por culpa sua.',
    },
    {
      tipo: 'p',
      texto:
        '**7.3. Rescisão imotivada:** Qualquer das partes poderá rescindir o presente contrato sem necessidade de justificar o motivo, desde que comunique a outra parte por escrito com antecedência mínima de 30 (trinta) dias, desde que o veículo esteja nas mesmas condições do momento da entrega.',
    },
    {
      tipo: 'p',
      texto:
        '**7.3.1.** Na hipótese de rescisão imotivada, a parte que a requerer deverá pagar à outra multa compensatória de 20% (vinte por cento) do valor atualizado do saldo devedor do financiamento, além de ressarcir eventuais despesas já incorridas pela parte inocente em razão da execução do contrato.',
    },
  ]

  const clausulas8a11: BlocoContrato[] = [
    { tipo: 'secao', texto: '8. COMPARTILHAMENTO E TRATAMENTO DE DADOS' },
    {
      tipo: 'p',
      texto:
        '**8.1.** As partes declaram estar cientes e de acordo com o tratamento de seus dados pessoais fornecidos no presente contrato, que poderão ser utilizados exclusivamente para fins de execução das obrigações aqui assumidas, incluindo comunicação entre as partes, negociação com terceiros interessados, cumprimento de exigências legais, fiscais e administrativas, bem como diligências junto a instituições financeiras, cartórios, órgãos de trânsito e demais entidades envolvidas na operação.',
    },
    {
      tipo: 'p',
      texto:
        '**8.2.** O **INTERMEDIADOR** poderá compartilhar os dados do **VENDEDOR** com possíveis compradores, desde que limitado à finalidade de intermediação da venda do veículo e observadas as diretrizes da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).',
    },
    {
      tipo: 'p',
      texto:
        '**8.3.** Nenhuma das partes poderá divulgar os dados da outra para finalidades alheias ao contrato, sob pena de responsabilização civil e penal, salvo quando exigido por ordem judicial ou por autoridade competente.',
    },

    { tipo: 'secao', texto: '9. DECLARAÇÕES E GARANTIAS' },
    { tipo: 'p', texto: '**9.1.** O **COMPRADOR** declara que:' },
    {
      tipo: 'alineas',
      itens: [
        'Está plenamente ciente de que o veículo objeto deste contrato não se encontra em nome do **INTERMEDIADOR**, mas sim de terceiro proprietário (VENDEDOR), e que o presente instrumento não representa a transferência imediata da propriedade, mas sim uma promessa de compra futura condicionada à quitação do financiamento e ao cumprimento das demais obrigações assumidas;',
        'Compromete-se a quitar integralmente o financiamento vigente do veículo, nos termos deste contrato, assumindo diretamente o pagamento das parcelas vincendas junto à instituição financeira credora;',
        'Tem plena ciência de que o veículo se encontra alienado fiduciariamente, estando sua posse e uso vinculados à regularidade contratual com a instituição financeira, até a liberação total do bem;',
        'Está ciente de que o **INTERMEDIADOR** não é o titular formal do veículo, razão pela qual não poderá responsabilizá-lo por ônus ocultos, restrições administrativas, débitos anteriores ou impedimentos à transferência de titularidade, salvo se decorrentes de dolo ou culpa comprovada do **INTERMEDIADOR**;',
        'Está ciente de que, até a conclusão da transferência formal, não poderá negociar, vender, prometer venda ou transferir os direitos sobre o veículo sem a expressa autorização do **INTERMEDIADOR**.',
      ],
    },
    { tipo: 'p', texto: '**9.2.** O **INTERMEDIADOR** declara que:' },
    {
      tipo: 'alineas',
      itens: [
        'Compromete-se a atuar com diligência, boa-fé e transparência, observando os princípios éticos e legais que regem a atividade de intermediação de negócios e cessão de direitos sobre bens financiados;',
        'Informou previamente ao **COMPRADOR** todas as condições relativas ao veículo, inclusive os dados disponíveis sobre o financiamento, situação documental e eventuais encargos incidentes;',
        'Não utilizará o veículo ou os dados recebidos do **COMPRADOR** para qualquer fim diverso daqueles estabelecidos neste contrato, salvo mediante consentimento expresso e por escrito;',
        'Compromete-se a entregar ao **COMPRADOR**, após a quitação do financiamento e cumprimento de todas as obrigações contratuais, os documentos necessários à transferência da titularidade do veículo, bem como a formalizar os atos de cessão de direitos e registros perante os órgãos competentes;',
        'Envidará esforços razoáveis para garantir que o veículo esteja livre e desembaraçado no momento da transferência, adotando, se necessário, medidas para sanar eventuais pendências deixadas pelo **VENDEDOR** original.',
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

  const parcelas = parcelado ? pecasParceladas(i, valorTotal) : null

  const blocos: BlocoContrato[] = [
    ...(parcelas ? parcelas.topo : topoAvista),
    ...objeto,
    ...clausulas2a5,
    ...(parcelas ? parcelas.pagamento : pagamentoAvista),
    ...rescisao,
    ...(parcelas ? parcelas.rescisaoFinal : suspensaoAvista),
    ...clausulas8a11,
    ...(parcelas ? parcelas.fecho : fechoAvista),
  ]

  return { titulo: 'CONTRATO DE PROMESSA DE COMPRA DE VEÍCULO FINANCIADO COM ASSUNÇÃO DE OBRIGAÇÕES', blocos }
}

/** Trechos que mudam na promessa parcelada: abertura, cláusula 6, fim da cláusula 7 e assinaturas. */
function pecasParceladas(i: GerarContratoInput, valorTotal: string) {
  const c = i.contratante
  const k = i.compra
  const m = k.intermediador
  const nomeComprador = c.nome.trim() ? c.nome.trim().toUpperCase() : lacuna('NOME COMPLETO')
  const cpfComprador = onlyDigits(c.cpf) ? maskCPFCNPJ(c.cpf) : lacuna('CPF')
  const estadoCivil = ESTADOS_CIVIS.some((e) => e.value === c.estadoCivil) ? labelEstadoCivil(c.estadoCivil).toLowerCase() : lacuna('estado civil')
  const cpfIntermediador = onlyDigits(m.cpf) ? maskCPFCNPJ(m.cpf) : lacuna('CPF do sócio')
  const cnpjIntermediador = onlyDigits(m.cnpj) ? maskCPFCNPJ(m.cnpj) : lacuna('CNPJ')
  const nomeSocio = m.nome.trim() ? m.nome.trim().toUpperCase() : lacuna('nome do sócio')

  const topo: BlocoContrato[] = [
    { tipo: 'titulo', texto: 'CONTRATO DE PROMESSA DE COMPRA DE VEÍCULO FINANCIADO COM ASSUNÇÃO DE OBRIGAÇÕES' },
    {
      tipo: 'p',
      texto: `**COMPRADOR: ${nomeComprador}**, ${ou(c.nacionalidade, 'nacionalidade')}, ${estadoCivil}, ${ou(c.profissao, 'profissão')}, portador do **CPF nº ${cpfComprador}**, com endereço na ${ou(c.endereco, 'endereço completo')}, e com endereço eletrônico ${ou(c.email, 'e-mail')}.`,
    },
    {
      tipo: 'p',
      texto: `**INTERMEDIADOR: ${ou(m.razaoSocial, 'RAZÃO SOCIAL').toUpperCase()}**, pessoa jurídica de direito privado, inscrita no **CNPJ sob nº ${cnpjIntermediador}**, com sede no ${ou(m.endereco, 'endereço completo')}, neste ato representada por seu sócio administrador **${nomeSocio}**, ${ou(m.nacionalidade, 'nacionalidade')}, ${ou(m.estadoCivil, 'estado civil')}, empresário, portador do **CPF nº ${cpfIntermediador}**, e com endereço eletrônico ${ou(m.email, 'e-mail')}.`,
    },
    { tipo: 'p', texto: 'As partes acima entendem como justas as seguintes cláusulas e condições do presente contrato.' },
  ]

  // Cláusula 6: pagamento em parcelas mensais.
  const n = /^[1-9]\d*$/.test(k.pagamentos.trim()) ? Number(k.pagamentos) : null
  const datas =
    n === null
      ? [lacuna('vencimentos')]
      : Array.from({ length: n }, (_, idx) => dataCurta(k.vencimentos[idx] ?? '') || lacuna(`vencimento ${idx + 1}`))
  const vencimentos =
    datas.length === 1
      ? `com vencimento em ${datas[0]}`
      : datas.length === 2
        ? `com o primeiro vencimento em ${datas[0]} e ${datas[1]}`
        : `com vencimentos em ${datas.slice(0, -1).join(', ')} e ${datas[datas.length - 1]}`
  const quantidade = n === null ? lacuna('quantidade de parcelas') : `${String(n).padStart(2, '0')} (${feminino(inteiroPorExtenso(n))})`
  const valorParcela = numeroDe(k.valorPagamento) > 0 ? dinheiro(k.valorPagamento) : lacuna('valor da parcela')
  const forma = n === 1 ? 'parcela' : 'parcelas mensais, fixas e sucessivas,'

  const pagamento: BlocoContrato[] = [
    { tipo: 'secao', texto: '6. PAGAMENTO' },
    {
      tipo: 'p',
      texto: `**6.1.** Pelo presente contrato, o COMPRADOR se compromete a pagar ao INTERMEDIADOR o valor total de **${valorTotal}**, a título de preço pela aquisição do veículo.`,
    },
    { tipo: 'p', texto: '**6.2.** O pagamento do valor descrito no item 6.1 será realizado da seguinte forma:' },
    {
      tipo: 'p',
      texto: `**a)** Em ${quantidade} ${forma} no valor de **${valorParcela}** cada, ${vencimentos};`,
    },
    {
      tipo: 'p',
      texto:
        '**6.3.** O valor referido nesta cláusula abrange o direito de posse e futura propriedade do veículo, bem como a intermediação e cessão de direitos realizados pelo INTERMEDIADOR, e será considerado quitado com a efetivação dos pagamentos previstos.',
    },
  ]

  // Fim da cláusula 7: rescisão automática (7.4) e efeitos da rescisão (7.5).
  const rescisaoFinal: BlocoContrato[] = [
    {
      tipo: 'p',
      texto: '**7.4.** Este contrato poderá ser considerado rescindido automaticamente, sem penalidade para nenhuma das partes, nas seguintes situações:',
    },
    {
      tipo: 'alineas',
      itens: [
        'Morte ou incapacidade civil superveniente do COMPRADOR ou do INTERMEDIADOR;',
        'Bloqueio judicial, alienação forçada, furto, roubo, sinistro com perda total ou qualquer evento que torne impossível a regularização e transferência do veículo;',
        'Desaparecimento do veículo ou da documentação essencial à operação;',
        'Ocorrência de caso fortuito ou força maior que torne inviável o cumprimento das obrigações por ambas as partes.',
      ],
    },
    { tipo: 'p', texto: '**7.5.** Em qualquer hipótese de rescisão:' },
    {
      tipo: 'alineas',
      itens: [
        'O COMPRADOR deverá restituir o veículo ao INTERMEDIADOR, nas mesmas condições em que o recebeu, exceto desgaste natural pelo uso regular;',
        'As partes deverão assinar Termo de Rescisão Contratual, se solicitado por qualquer delas, para formalização da extinção da relação jurídica;',
        'Permanecerão em vigor, mesmo após a rescisão, as cláusulas relativas à responsabilidade civil, penalidades, confidencialidade, tratamento de dados e foro.',
      ],
    },
  ]

  const testemunhas = [0, 1].map((idx) => {
    const t = k.testemunhas[idx]
    return {
      nome: t?.nome.trim() ? t.nome.trim().toUpperCase() : lacuna(`NOME DA TESTEMUNHA ${idx === 0 ? 'I' : 'II'}`),
      documento: `CPF n° ${t && onlyDigits(t.cpf) ? maskCPFCNPJ(t.cpf) : lacuna('CPF')}`,
      papel: idx === 0 ? 'TESTEMUNHA I' : 'TESTEMUNHA II',
    }
  })

  const fecho: BlocoContrato[] = [
    { tipo: 'p', texto: `${ou(k.cidade, 'CIDADE/UF')}, ${dataLonga(k.dataAssinatura)}.` },
    {
      tipo: 'assinaturas',
      itens: [
        { nome: nomeComprador, documento: `CPF nº ${cpfComprador}`, papel: 'COMPRADOR(A)' },
        { nome: nomeSocio, documento: `CPF nº ${cpfIntermediador}`, papel: 'INTERMEDIADOR' },
        ...testemunhas,
      ],
    },
  ]

  return { topo, pagamento, rescisaoFinal, fecho }
}

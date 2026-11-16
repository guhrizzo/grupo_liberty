// Texto do "Contrato de locação de veículo com opção de aquisição". Transcrição do
// modelo em PDF: só as lacunas ([...]) são variáveis. O texto jurídico NÃO deve ser
// alterado aqui sem aval do jurídico.
//
// Ajustes feitos na transcrição (sobras do modelo anterior, de motocicleta):
//  - "moto/motocicleta" virou "veículo";
//  - a franquia do seguro (cláusulas 16.1 e 16.2) usa um único valor, informado no formulário;
//  - a segunda "Cláusula 21" foi renumerada e as seguintes avançaram um número;
//  - a remissão da cláusula 6.3 à oficina aponta para a cláusula 7;
//  - erros de digitação corrigidos (LOCATÓRIO, localizanada, presençade etc.).
//
// `**texto**` marca negrito (lido por ContratoBlocosDocument).

import { ESTADOS_CIVIS, labelEstadoCivil } from '@/utils/cobrancas/pessoa'
import { maskCPFCNPJ, maskPhone, onlyDigits } from '@/utils/masks'
import type { BlocoContrato, ContratoBlocos } from './blocos'
import { cpfFormatado, ou } from './texto-prestacao'
import { brl, dataPorExtenso, dinheiro, lacuna } from './texto'
import { numeroDe, type GerarContratoInput } from './types'

const TITULO = 'CONTRATO DE LOCAÇÃO DE VEÍCULO COM OPÇÃO DE AQUISIÇÃO'
const SOCIO = 'OTÁVIO MORETTO'
const CPF_SOCIO = '520.525.368-17'

/** "2026-11-16" → "16/11/2026" (lacuna se inválida). */
function dataCurta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : lacuna('data do primeiro pagamento')
}

const p = (texto: string): BlocoContrato => ({ tipo: 'p', texto })
const secao = (texto: string): BlocoContrato => ({ tipo: 'secao', texto })
const maiusculo = (raw: string, rotulo: string) => dinheiro(raw, rotulo).toUpperCase()

export function montarLocacao(i: GerarContratoInput, hoje: Date = new Date()): ContratoBlocos {
  const c = i.contratante
  const v = i.veiculo
  const k = i.compra
  const l = k.locacao

  const nome = c.nome.trim() ? c.nome.trim().toUpperCase() : lacuna('NOME COMPLETO')
  const cpf = cpfFormatado(c.cpf)
  const estadoCivil = ESTADOS_CIVIS.some((e) => e.value === c.estadoCivil) ? labelEstadoCivil(c.estadoCivil).toLowerCase() : lacuna('estado civil')
  const telefone = onlyDigits(c.telefone) ? maskPhone(c.telefone) : lacuna('telefone')
  const enderecoMaiusculo = c.endereco.trim() ? c.endereco.trim().toUpperCase() : lacuna('ENDEREÇO')

  const aluguel = numeroDe(l.aluguel)
  const entrada = numeroDe(l.entrada)
  const qtd = /^[1-9]\d*$/.test(l.parcelas.trim()) ? Number(l.parcelas) : null
  const total = aluguel > 0 && entrada >= 0 && qtd !== null ? entrada + qtd * aluguel : NaN
  const aluguelBrl = aluguel > 0 ? brl(aluguel) : lacuna('valor do aluguel')
  const entradaBrl = entrada >= 0 ? brl(entrada) : lacuna('entrada')
  const totalBrl = Number.isFinite(total) ? brl(total) : lacuna('valor total')
  const dia = /^(?:[1-9]|[12]\d|3[01])$/.test(l.diaVencimento.trim()) ? String(Number(l.diaVencimento)) : lacuna('dia')
  const parcelas = qtd !== null ? String(qtd) : lacuna('parcelas')
  const franquia = maiusculo(l.franquia, 'franquia')

  const veiculo = `veículo automotor, marca/modelo: **${ou(k.marca, 'marca').toUpperCase()}/${ou(k.modelo, 'modelo').toUpperCase()}**, ano/modelo: **${ou(v.ano, 'ano')}**, de placa **${ou(v.placa, 'placa').toUpperCase()}**, COR: **${ou(k.cor, 'cor').toUpperCase()}**, chassi nº **${ou(k.chassi, 'chassi').toUpperCase()}**, Renavam nº **${ou(v.renavam, 'RENAVAM')}**`

  const topo: BlocoContrato[] = [
    { tipo: 'titulo', texto: TITULO },
    {
      tipo: 'p',
      texto: `**LOCADORA: 55.116.497 OTAVIO MORETTO**, pessoa jurídica de direito privado, inscrita no **CNPJ sob nº 55.116.497/0001-08**, com sede na **Av. Doutor Quinzinho, 995, Sala 4, Jardim Jorge Atalla, Jaú/SP**, neste ato representada por seu sócio administrador **${SOCIO}**, brasileiro, casado, empresário, portador do **CPF nº ${CPF_SOCIO}**, e com endereço eletrônico **otaviomoretto01@gmail.com.**`,
    },
    {
      tipo: 'p',
      texto: `**LOCATÁRIO: ${nome}**, ${ou(c.nacionalidade, 'nacionalidade')}, ${estadoCivil}, ${ou(c.profissao, 'profissão')}, portador do **CPF nº ${cpf}**, com endereço na **${ou(c.endereco, 'endereço completo')}**, e com endereço eletrônico **${ou(c.email, 'e-mail')}** e telefone **${telefone}**.`,
    },
  ]

  const clausulas1a3: BlocoContrato[] = [
    p(`**Cláusula 01** – O objeto da presente contratação é a locação do seguinte ${veiculo}, de propriedade exclusiva da LOCADORA.`),
    p(`**Cláusula 02** – O aluguel do veículo acima descrito será de **${maiusculo(l.aluguel, 'valor do aluguel')}** por mês a serem pagos **TODO DIA ${dia} cada MÊS**.`),
    p(`O PRIMEIRO pagamento será feito na data ${dataCurta(l.primeiroPagamento)}. O valor TOTAL acordado é de ${totalBrl}, sendo ${entradaBrl} de entrada na data de assinatura do presente contrato e todo dia ${dia} o valor de ${aluguelBrl}.`),
    p(`• ${entradaBrl} em dinheiro ou PIX na chave de Otávio Moretto ou de Álesis Quio`),
    p(`Cumpridas todas as obrigações contratuais e quitadas as ${parcelas} parcelas mensais, a LOCADORA concederá ao LOCATÁRIO a opção de aquisição do veículo, mediante assinatura do Termo de Entrega Final.`),
    p('**Cláusula 03** – As duas primeiras semanas serão pagas mediante transferência bancária para a conta corrente da LOCADORA, no Banco (ITAU S/A), cuja chave PIX é a seguinte libertycred01@gmail.com ou alesisquiojau@gmail.com'),
  ]

  const clausulas4a11: BlocoContrato[] = [
    secao('Cláusula 04 - USO ADEQUADO DO VEÍCULO'),
    p('**1.** O veículo, objeto deste contrato, é de uso exclusivo do LOCATÁRIO. Este se compromete a não transferir ou ceder os direitos concedidos por este contrato a terceiros, nem permitir que o veículo seja conduzido por outra pessoa sem a prévia, inequívoca e expressa autorização da LOCADORA. Na eventualidade do veículo ser conduzido por terceiro sem a devida autorização da LOCADORA, este contrato será imediatamente rescindido e suportará o LOCATÁRIO multa rescisória no valor de 4 semanas de aluguel, e não será devido a devolução da caução (Esta responsabilidade estende-se a cobrir todos os custos relacionados a reparos, substituições e quaisquer outros prejuízos financeiros sofridos pela LOCADORA em decorrência de tais danos. O LOCATÁRIO assumirá total responsabilidade por quaisquer danos causados ao veículo durante o período de locação, incluindo, mas não limitando-se a danos decorrentes de caso fortuito ou força maior).'),
    p('**2.** O LOCATÁRIO deverá conduzir o veículo de maneira prudente, respeitando as normas de trânsito e a legislação vigente. Qualquer multa ou infração decorrente de uso indevido será de total responsabilidade do LOCATÁRIO.'),
    p('**3.** É expressamente vedado o uso do veículo em competições, rachas, eventos esportivos, transporte de materiais perigosos ou carga superior à capacidade do veículo.'),
    p('**4.** O descumprimento desta cláusula poderá resultar na rescisão imediata do contrato, com cobrança de multas e ressarcimento de danos, conforme estabelecido nas demais cláusulas deste contrato.'),

    p('**Cláusula 05** – A relação jurídica existente entre as partes é de natureza privada contratual (locação de bem móvel), motivo pelo qual, inexistirá, entre elas, qualquer espécie de subordinação, prestação de serviços ou trabalho.'),
    p('**1.** Encerrada a locação, por iniciativa de qualquer das partes (resilição unilateral/ denúncia), o LOCATÁRIO devolverá o veículo locado no mesmo estado de conservação recebido, ressalvados eventuais desgastes naturais decorrentes do uso e do tempo.'),
    p('**2.** É expressamente vedada a sublocação ou empréstimo gratuito do veículo locado, a quem quer que seja, sob pena de rescisão culposa do presente negócio jurídico e responsabilização do LOCATÁRIO por perdas e danos. Também é expressamente vedada a cessão do presente contrato a terceiros. Ainda é expressamente vedado deixar o veículo locado pernoitar na rua ou estacionar fora de locais apropriados (estacionamentos ou garagens).'),

    secao('Cláusula 06 – MANUTENÇÕES'),
    p('**1.** As despesas de conservação do veículo locado (lavagem, higienização, limpeza, combustível, fluido de freio, lubrificação, troca de lâmpadas queimadas, reparo de pneus, estacionamento etc.) correrão sempre por conta exclusiva do LOCATÁRIO.'),
    p('**2.** As despesas de manutenções básicas preventivas do veículo locado (reparos de oficina, substituição de peças, substituição de pneus, troca de óleo do motor, etc) serão sempre 100% pagas pelo LOCATÁRIO.'),
    p('**3.** As despesas com manutenções corretivas serão 100% a cargo do LOCATÁRIO, quando constatado que o veículo apresentou problemas por mau uso do LOCATÁRIO. Essa manutenção será realizada na oficina mecânica indicada pela LOCADORA na cláusula 7.'),
    p('**4.** Caso a bomba de combustível do veículo objeto deste contrato venha a sofrer danos ou queima diretamente atribuíveis à falta de combustível ou à negligência por parte do LOCATÁRIO durante o período de locação, este último assumirá a responsabilidade total pelos custos associados ao reparo do dano. Isso inclui, mas não se limita a, o custo integral da peça de reposição, a mão de obra necessária para o conserto, os custos de reboque do veículo até a oficina mecânica designada pela LOCADORA, bem como quaisquer outros custos diretos relacionados à reparação do veículo.'),
    p('**5. A troca de óleo será feita a cada 1 mil km rodados, e terão os custos 100% pagos pelo LOCATÁRIO.**'),

    p('**Cláusula 07** – Em caso de manutenção do veículo locado (reparos de oficina, substituição de peças, substituição de pneus, troca de óleo do motor, troca de óleo do câmbio, troca da bomba de combustível etc.), os reparos serão realizados sempre em oficina de confiança exclusiva da LOCADORA, a saber: **“AUTO MECÂNICA CÉSAR”** localizada na Avenida Décio Pacheco De Almeida Prado, 661 - Jardim Brasilia - Jaú/SP, 17212-222, **Telefone: (14) 99800-2062, e/ou “CASA DO ÓLEO”** localizada na Av. Dr. Luciano Pachêco de Almeida Prado Neto, 484 - Jardim Nova Jau, Jaú - SP, 17213-481 **Telefone:** (14)3626-6663.'),

    secao('Cláusula 08 – VISTORIAS MENSAIS'),
    p('**1.** O LOCATÁRIO se compromete a disponibilizar o veículo para vistoria realizada pela LOCADORA uma vez por mês, permitindo assim a verificação de seu estado de conservação e manutenção. A vistoria MENSAL já está agendada a partir da assinatura deste contrato todo dia 05 de cada mês na sede da LOCADORA no endereço: **Av. Doutor Quinzinho, 995, Sala 4, Jardim Jorge Atalla, Jaú/SP.**'),
    p('**2.** **Em caso eventual da LOCADORA** desmarcar a vistoria presencial, deverá o LOCATÁRIO realizar a vistoria de forma online, no mesmo dia e horário da vistoria presencial. O LOCATÁRIO deverá enviar um vídeo para o WhatsApp comercial da LOCADORA (14)99865-9046, vídeo este que deve ser completo, capturando de forma detalhada e uniforme o veículo em 360 graus, esse vídeo deverá incluir a quilometragem atual do veículo, painel do veículo.'),
    p('**3.** A não apresentação do veículo locado para a vistoria mensal acarretará a imediata rescisão culposa do presente contrato e sujeitará o LOCATÁRIO a perda total do valor caução e mais multa rescisória no valor de 4 semanas de aluguel. O não envio do vídeo da vistoria online (**este somente no caso da LOCADORA desmarcar a vistoria presencial**) também acarretará as mesmas medidas anteriormente citadas.'),
    p('**4.** Durante a vistoria mensal, a LOCADORA avaliará o estado geral do veículo (motor, carroceria, freios, pneus e interior), para assegurar que o bem esteja sendo devidamente cuidado, conforme previsto nesta contratação.'),

    p('**Cláusula 09** - As partes manterão um registro geral de todas as manutenções realizadas, nele descritos todos os dados relevantes, tais como, data, serviço executado, peças substituídas e observações importantes, a fim de assegurar transparência sobre a manutenção do veículo.'),
    p('**Cláusula 10** – Todos os gastos decorrentes das manutenções periódicas serão **100% pagos pelo LOCATÁRIO**. O LOCATÁRIO não poderá fazer qualquer reparo por conta própria, sem prévia anuência da LOCADORA e fora da oficina escolhida pela LOCADORA, sob pena de ter a imediata rescisão culposa do presente contrato e sujeitará o LOCATÁRIO a perda total do valor caução e mais multa rescisória no valor de 4 semanas de aluguel, além de não ser reembolsado pelos gastos efetuados e ainda responder por eventuais danos causados.'),
    p('**Cláusula 11** – Qualquer dano resultante da falta de combustível ou de negligência do LOCATÁRIO, acarretará o pagamento de perdas e danos, conforme cláusula adiante que trata deste assunto.'),
    p('**Cláusula 12** - O LOCATÁRIO pagará o IPVA e o seguro facultativo todos os anos. A LOCADORA escolherá a companhia seguradora e a modalidade de seguro contratado. Em caso de sinistro (furto, roubo, incêndio, colisão, acidente, inundação, etc), o aviso de sinistro será sempre dado pela LOCADORA. Em hipótese de sinistro, a franquia do seguro será sempre imposta ao LOCATÁRIO.'),
    p('**Cláusula 13** - O LOCATÁRIO pagará quaisquer multas de trânsito durante a vigência deste contrato. As multas serão pagas de imediato, antes do seu vencimento, independente de qualquer recurso administrativo ou procedimento de transferência legal de pontos.'),
    p('**Cláusula 14** – A LOCADORA apontará o LOCATÁRIO como principal condutor do veículo locado, na carteira digital de trânsito, sempre que houver infrações cometidas durante a presente locação, nos termos do artigo 257, do Código Brasileiro de Trânsito.'),
    p('**Cláusula 15** - Caso o veículo locado seja rebocado por estacionamento proibido, o LOCATÁRIO arcará com todos os custos necessários à sua recuperação junto ao pátio de recolhimento (multas, diárias de utilização, guincho, etc). O LOCATÁRIO não será isento do aluguel durante o período em que o veículo estiver apreendido.'),

    secao('Cláusula 16 - FRANQUIAS EM CASO DE SINISTROS'),
    p(`**1.** Qualquer sinistro envolvendo o veículo locado como e não se limitando apenas a: roubo, furto, enchentes, queda de árvore, perda total, batidas, acidentes de trânsito entre outros, onde a LOCADORA tenha que acionar a seguradora, o LOCATÁRIO fica responsável em assumir o valor da franquia de ${franquia}. Em caso de roubo ou furto do veículo e o mesmo for recuperado pelos órgãos competentes a franquia continua sendo obrigatória e deverá ser paga única e exclusivamente pelo LOCATÁRIO.`),
    p(`**2.** O valor deverá ser pago no PIX, ou 12x no cartão de crédito (no crédito será acrescido juros da maquininha referente ao parcelamento e a taxa de saque que será cobrada da LOCADORA). Havendo sinistro onde a LOCADORA precise acionar a seguradora é de inteira e exclusiva responsabilidade do LOCATÁRIO pagar a franquia no valor de ${franquia} imediatamente após a constatação do sinistro.`),
    p('**3.** Em caso de roubo ou furto, o LOCATÁRIO comunicará o fato imediatamente à LOCADORA, e, logo em seguida, comparecerá à delegacia de polícia mais próxima para registrar a ocorrência. O LOCATÁRIO também comparecerá à sede da companhia seguradora (ou qualquer outro local por ela apontado), para atender aos trâmites exigidos pelo processo administrativo de cobertura securitária.'),
    p('**4.** Em caso de sinistro e negativa de cobertura por parte da companhia seguradora, o LOCATÁRIO arcará com o pagamento integral dos danos causados ao veículo locado; inclusive a sua remoção por guincho particular. Em caso de perda total, a indenização corresponderá ao valor do veículo locado, pelo preço da tabela FIPE, equivalente àquele ano e modelo.'),
    p('**5.** Em caso de acidente envolvendo o veículo locado (colisão, abalroamento, queda de árvores, inundações etc.), o LOCATÁRIO arcará com o pagamento da remoção por guincho, quando esta não estiver coberta pelo seguro contratado pela LOCADORA. O LOCATÁRIO também será responsável pelas diárias e taxas, para liberação do veículo locado, quando este for apreendido por qualquer autoridade pública.'),
    p('**6.** É de responsabilidade do LOCATÁRIO o pagamento do reboque, taxas e reparos ao veículo objeto do presente contrato ou a veículo de outrem na ocorrência de acidentes e colisões sofridas na vigência do presente contrato quando não contempladas pela cobertura do seguro a este contratado, independente de dolo, culpa, negligência, imprudência ou imperícia do LOCATÁRIO.'),
    p('**7.** Em caso de deterioração do veículo locado, decorrente de acidente automobilístico ou sinistro equivalente, sem culpa do LOCATÁRIO, o contrato será resolvido sem perdas e danos e sem qualquer redução proporcional do aluguel vencido.'),
    p('**8.** O LOCATÁRIO será sempre responsável por todos os danos causados a terceiros, decorrentes de qualquer acidente envolvendo o veículo locado (colisão, abalroamento, etc), quando não cobertos pelo seguro contratado pela LOCADORA.'),
    p('**9.** O LOCATÁRIO é o responsável por tudo o que acontece com o veículo, enquanto este estiver sob sua posse através deste contrato de locação. Ele será o responsável pelo pagamento da franquia (em casos que esse procedimento se aplica) e será o responsável pelo conserto do veículo após as batidas. Se o mesmo achar que o terceiro envolvido é o culpado pelo acidente, deverá entrar em acordo com o terceiro para o conserto do veículo alugado (sem a interferência da LOCADORA) se o mesmo não conseguir entrar em comum acordo com o terceiro, ele será o único responsável pelo conserto do veículo, independente de sua culpa no ocorrido, ele pode, após o conserto buscar uma ação de regresso contra esse terceiro (utilizando os seus recursos próprios).'),

    p('**Cláusula 17** - Fica vedado ao LOCATÁRIO sair do Estado com o veículo objeto deste contrato sem a autorização expressa e por escrito da LOCADORA, o descumprimento dessa cláusula acarretará a imediata rescisão culposa do presente contrato e sujeitará o LOCATÁRIO a perda total do valor caução e mais multa rescisória no valor de 4 semanas de aluguel, além de responsabilização por quaisquer danos ocorridos no veículo, inclusive caso fortuito e força maior.'),

    secao('Cláusula 18 - MULTA POR ATRASO NO PAGAMENTO'),
    p('**1.** Caso o pagamento da semana seja efetuado com atraso superior a 7 (sete) dias em relação ao vencimento anterior, incidirá multa de R$ 80,00 (oitenta reais), além de correção monetária e juros moratórios de 10% (dez por cento) ao mês.'),
    p('**2.** O atraso superior a 7 (sete) dias caracterizará inadimplemento contratual, autorizando a **rescisão imediata do contrato**, devendo o LOCATÁRIO devolver o veículo no prazo máximo de 24 (vinte e quatro) horas, no endereço indicado pela LOCADORA.'),
    p('**3.** O inadimplemento de qualquer obrigação prevista neste contrato, especialmente o atraso no pagamento por prazo superior a 5 (cinco) dias, implicará no **vencimento antecipado de todas as parcelas vincendas**, tornando-se imediatamente exigível a totalidade do débito, independentemente de notificação judicial ou extrajudicial.'),
    p('**4.** A rescisão contratual prevista nesta cláusula **não afasta o direito da LOCADORA de exigir o pagamento integral do débito**, incluindo as parcelas vencidas e vincendas, acrescidas de multa, juros, correção monetária, honorários advocatícios e demais encargos previstos neste contrato.'),
    p('**5.** O não cumprimento da obrigação de devolução do veículo no prazo estipulado autorizará a LOCADORA a adotar todas as medidas legais cabíveis, inclusive **execução do débito, reintegração de posse e busca e apreensão do bem**, sem prejuízo das medidas penais cabíveis.'),

    secao('Cláusula 19 - DA VIGÊNCIA DO CONTRATO E RESCISÃO'),
    p('**1.** O presente contrato tem um prazo mínimo de 3 (três) meses, contados a partir da data de assinatura.'),
    p('**2.** Caso o LOCATÁRIO opte por rescindir o contrato antes do término deste período, será aplicada uma multa correspondente ao valor do caução.'),
    p('**3.** O descumprimento de qualquer das obrigações previstas neste instrumento, por qualquer uma das partes, acarretará a rescisão culposa deste negócio jurídico e imporá à parte culpada o pagamento de perdas e danos. As perdas e danos serão fixadas em juízo conforme a extensão do dano; mas, jamais serão inferiores a dois salários mínimos.'),
    p('**4.** Este contrato será renovado automaticamente por períodos iguais e sucessivos de 3 (três) meses, caso não haja manifestação expressa de qualquer das partes.'),
    p('**5.** Para que o contrato não seja renovado automaticamente, a parte interessada deverá comunicar sua intenção de rescisão com no mínimo 30 (trinta) dias.'),

    secao('Cláusula 20 - DEVOLUÇÃO DO VEÍCULO'),
    p('**1.** É assegurada às partes a resilição unilateral do presente contrato (denúncia imotivada), a qualquer tempo, sem qualquer penalidade, mediante aviso prévio com antecedência mínima de três dias.'),
    p('**2.** Em caso de resilição unilateral do presente contrato (denúncia imotivada), o LOCATÁRIO devolverá o veículo à LOCADORA no endereço informado, no prazo improrrogável de 24 horas, a contar da denúncia imotivada (data de consumação da resilição unilateral por qualquer uma das partes).'),
    p('**3.** Caso o veículo locado não seja devolvido dentro do prazo de 24 horas, a conduta omissiva do LOCATÁRIO configurará ESBULHO POSSESSÓRIO (Código Civil, arts. 1202 e 1218) e autorizará a imediata reintegração da LOCADORA na posse de seu bem. Em caso de ESBULHO POSSESSÓRIO, o LOCATÁRIO pagará à LOCADORA uma multa cominatória diária de R$ 150,00 (CENTO E CINQUENTA REAIS), por dia de atraso, até a efetiva devolução do bem (Código Civil, art. 1216). Não haverá direito de retenção em nenhuma hipótese.'),
    p('**4.** Faz-se necessário frisar que a não devolução do veículo pelo LOCATÁRIO no prazo de 24 horas após a notificação por escrito da LOCADORA configura-se também crime de APROPRIAÇÃO INDÉBITA conforme artigo 168 do Código Penal Brasileiro, com pena de reclusão de um a quatro anos de prisão e multa.'),

    secao('Cláusula 21 - DA QUANTIA'),
    p('**1.** As partes ajustam que não será exigida caução para a celebração deste contrato, inexistindo qualquer valor a ser pago pelo LOCATÁRIO a esse título no ato da retirada do veículo.'),
    p('**2.** Em razão da inexistência de caução, não haverá restituição de valores ao término da vigência contratual, permanecendo integralmente válidas as demais obrigações assumidas pelas partes neste instrumento.'),
  ]

  const clausulas22a31: BlocoContrato[] = [
    p('**Cláusula 22** - A LOCADORA não é obrigada a disponibilizar veículo reserva e não se responsabiliza caso o LOCATÁRIO não possa dirigir devido à indisponibilidade do veículo.'),
    p('**Cláusula 23** – As partes declaram estar cientes e conscientes de todos os termos contidos no presente contrato e que aceitam livremente todas as cláusulas e condições aqui estipuladas. Declaram também ter tido tempo suficiente para obter todas as informações e esclarecimentos que julgaram necessários à celebração do presente negócio jurídico.'),
    p('**Cláusula 24** – A presente locação de bem móvel será regida pelas disposições do Código Civil Brasileiro e, além das partes contratantes, também obrigará seus herdeiros e sucessores.'),

    secao('Cláusula 25 - AUTORIZAÇÃO DE IMAGEM'),
    p('**1.** O LOCATÁRIO autoriza a LOCADORA a utilizar sua imagem, nome, e depoimento para fins comerciais, promocionais e publicitários, em meios físicos ou digitais, sem que isso gere qualquer tipo de compensação financeira, direitos autorais ou de imagem.'),
    p('**2.** As imagens poderão ser utilizadas em redes sociais, websites, anúncios publicitários, materiais impressos, e quaisquer outros meios de comunicação que a LOCADORA julgar pertinentes, desde que respeitada a boa-fé e o uso adequado da imagem do LOCATÁRIO.'),
    p('**3.** A autorização é concedida por prazo indeterminado.'),
    p('**4.** A LOCADORA compromete-se a utilizar a imagem do LOCATÁRIO de forma ética e respeitosa, sem distorções ou uso indevido que possa prejudicar a reputação do LOCATÁRIO.'),

    p('**Cláusula 26** - As partes convencionam que todas as comunicações, realizadas entre si, dar-se-ão através do WhatsApp Comercial da LOCADORA (14)99865-9046 ou pelo correio eletrônico libertycar7@gmail.com, motivo porque declinam aqui os seus respectivos endereços:'),
    p('a) LOCADORA: AV. DOUTOR QUINZINHO, 995, SALA 4, JARDIM JORGE ATALLA, JAÚ/SP'),
    p(`b) LOCATÁRIO: ${enderecoMaiusculo}`),

    secao('Cláusula 27 – DA APROPRIAÇÃO INDÉBITA, ESBULHO POSSESSÓRIO E CONSEQUÊNCIAS PENAIS E CIVIS'),
    p('**1.** O LOCATÁRIO declara, para todos os fins de direito, que recebe o veículo objeto deste contrato em **POSSE LÍCITA, PRECÁRIA E TEMPORÁRIA**, exclusivamente em razão do presente instrumento de locação, reconhecendo expressamente que a **propriedade plena e exclusiva** do bem pertence à LOCADORA.'),
    p('**2.** Constituirá **INFRAÇÃO CONTRATUAL GRAVÍSSIMA**, além de **ILÍCITO PENAL**, a conduta do LOCATÁRIO que, após a rescisão do contrato, por qualquer motivo, **deixar de devolver o veículo no prazo, local e condições estipulados**, ou ainda **ocultar, reter, alienar, ceder, abandonar ou dar destinação diversa ao bem**, configurando inequívoca **INVERSÃO DO ÂNIMO DA POSSE.**'),
    p('**3.** Nessas hipóteses, poderá caracterizar, em tese, o crime de **APROPRIAÇÃO INDÉBITA**, nos termos do artigo 168 do Código Penal, uma vez que o LOCATÁRIO, **tendo a posse legítima inicial**, passa a se comportar como se proprietário fosse, em prejuízo direto da LOCADORA.'),
    p('**4.** A LOCADORA poderá, **independentemente de notificação judicial**, adotar imediatamente todas as medidas legais cabíveis, incluindo, mas não se limitando a:'),
    {
      tipo: 'alineas',
      itens: [
        'Registro de **Boletim de Ocorrência**;',
        'Representação criminal perante a autoridade policial;',
        'Propositura de **ação de reintegração de posse**;',
        'Pedido de **busca e apreensão do bem**;',
        'Cobrança integral de **perdas e danos**, lucros cessantes, multas contratuais e demais prejuízos apurados.',
      ],
    },
    p('**5.** Fica expressamente pactuado que a configuração do ilícito penal **não se confunde com mero inadimplemento contratual**, sendo reconhecida pelas partes a presença de **DOLO**, consistente na vontade consciente do LOCATÁRIO de se apropriar de bem móvel alheio, nos termos da legislação penal vigente.'),
    p('**6.** A restituição posterior do veículo **não elide o crime**, tampouco afasta a responsabilidade penal, civil e contratual do LOCATÁRIO.'),

    secao('Cláusula 28 – DO TÍTULO EXECUTIVO EXTRAJUDICIAL'),
    p('O presente contrato constitui **título executivo extrajudicial**, nos termos do artigo 784, inciso III, do Código de Processo Civil, por conter obrigação certa, líquida e exigível.'),
    p('As partes reconhecem, de forma expressa, que todas as obrigações pecuniárias assumidas pelo LOCATÁRIO, incluindo, mas não se limitando a, aluguéis, multas contratuais, encargos moratórios, indenizações por perdas e danos, franquias de seguro e quaisquer outros valores decorrentes deste instrumento, são **líquidas, exigíveis e passíveis de execução direta**, independentemente de prévia notificação judicial.'),
    p('O LOCATÁRIO declara ciência de que o inadimplemento de qualquer obrigação prevista neste contrato autorizará a LOCADORA a promover a competente **ação de execução**, podendo exigir o pagamento integral do débito, acrescido de correção monetária, juros, multa e honorários advocatícios.'),

    secao('Cláusula 29 – DA LIQUIDEZ E CERTEZA DO DÉBITO'),
    p('As partes convencionam que os valores decorrentes deste contrato serão considerados **líquidos e certos**, podendo ser apurados mediante simples cálculo aritmético, com base nos valores, prazos e condições estabelecidos neste instrumento.'),
    p('Para fins de execução, bastará a apresentação de demonstrativo atualizado do débito, elaborado pela LOCADORA, o qual gozará de presunção relativa de veracidade, até prova em contrário.'),

    secao('Cláusula 30 – DA MORA'),
    p('O não pagamento de qualquer valor na data de vencimento constituirá o LOCATÁRIO automaticamente em mora, independentemente de notificação ou interpelação judicial ou extrajudicial.'),

    secao('Cláusula 31 – DO FORO'),
    p('Fica eleito o foro da Comarca de JAÚ/SP, como o único competente para dirimir quaisquer dúvidas ou controvérsias oriundas do presente contrato, inclusive para fins de execução de título extrajudicial, cobrança de valores, busca e apreensão e reintegração de posse, com renúncia expressa a qualquer outro, por mais privilegiado que seja ou venha a ser.'),
    p('O LOCATÁRIO declara que a presente eleição de foro foi livremente pactuada, não lhe causando qualquer prejuízo, estando ciente de seus efeitos jurídicos.'),
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
    p(`Jaú, ${dataPorExtenso(hoje)}.`),
    {
      tipo: 'assinaturas',
      itens: [
        { nome: SOCIO, documento: `CPF n° ${CPF_SOCIO}`, papel: 'LOCADORA' },
        { nome, documento: `CPF n° ${cpf}`, papel: 'LOCATÁRIO' },
        ...testemunhas,
      ],
    },
  ]

  return { titulo: TITULO, blocos: [...topo, ...clausulas1a3, ...clausulas4a11, ...clausulas22a31, ...fecho] }
}

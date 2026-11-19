// Tipos e regras do gerador de contratos preenchidos. Ficam aqui (não em
// actions.ts) porque arquivos 'use server' só podem exportar funções async.

import { ESTADOS_CIVIS } from '@/utils/cobrancas/pessoa'
import { validarCPF } from '@/utils/validadorCpf'
import { onlyDigits } from '@/utils/masks'

/** Promessa de compra com o preço pago à vista. */
export const TIPO_PROMESSA = 'promessa-compra-financiado' as const
/** Mesma promessa de compra, com o pagamento em parcelas e intermediador/testemunhas preenchíveis. */
export const TIPO_PROMESSA_PARCELADA = 'promessa-compra-parcelada' as const

/** Prestação de serviços de intermediação, com um vendedor. */
export const TIPO_PRESTACAO = 'prestacao-servico' as const
/** Mesmo contrato, com dois vendedores (casal). */
export const TIPO_PRESTACAO_CASAL = 'prestacao-servico-casal' as const

/** Análise, cancelamento e recuperação de valores de financiamento (honorários de 50%). */
export const TIPO_RECUPERACAO = 'recuperacao-valores' as const

/** Locação de veículo com opção de aquisição ao fim das parcelas. */
export const TIPO_LOCACAO = 'locacao-opcao-aquisicao' as const

export type TipoContratoGerado =
  | 'locacao-opcao-aquisicao'
  | 'recuperacao-valores'
  | 'promessa-compra-financiado'
  | 'promessa-compra-parcelada'
  | 'prestacao-servico'
  | 'prestacao-servico-casal'

export const ehLocacao = (t: TipoContratoGerado) => t === TIPO_LOCACAO
export const ehRecuperacao = (t: TipoContratoGerado) => t === TIPO_RECUPERACAO
export const ehPrestacao = (t: TipoContratoGerado) => t === TIPO_PRESTACAO || t === TIPO_PRESTACAO_CASAL

export const TIPOS_CONTRATO_GERADO: {
  value: TipoContratoGerado
  label: string
  descricao: string
  /** Slug da categoria de contrato (CATEGORIAS_CONTRATO_FIXAS) usada ao guardar no veículo. */
  categoriaSlug: string
}[] = [
  {
    value: 'promessa-compra-financiado',
    label: 'Promessa de compra de veículo financiado (à vista)',
    descricao: 'Promessa de compra de veículo financiado com assunção das parcelas pelo comprador, prazo para quitação e prévia do contrato em folhas A4.',
    categoriaSlug: 'venda-de-veiculo-financiado',
  },
  {
    value: 'promessa-compra-parcelada',
    label: 'Promessa de compra de veículo financiado (parcelada)',
    descricao: 'Mesma promessa de compra, com o preço pago em parcelas mensais. Intermediador, testemunhas, cidade e data são preenchíveis.',
    categoriaSlug: 'venda-de-veiculo-financiado',
  },
  {
    value: 'prestacao-servico',
    label: 'Prestação de serviços de intermediação',
    descricao: 'Intermediação da venda de veículo financiado, com cessão dos direitos de posse pelo vendedor. Um vendedor.',
    categoriaSlug: 'prestacao-de-servico',
  },
  {
    value: 'prestacao-servico-casal',
    label: 'Prestação de serviços de intermediação (casal)',
    descricao: 'Mesmo contrato de intermediação, com dois vendedores (casal), cada um com CPF e RG.',
    categoriaSlug: 'prestacao-de-servico',
  },
  {
    value: 'recuperacao-valores',
    label: 'Análise, cancelamento e recuperação de valores',
    descricao: 'Análise do financiamento para cancelar e recuperar seguros e tarifas, com honorários de 50% só sobre o que for devolvido.',
    categoriaSlug: 'prestacao-de-servico',
  },
  {
    value: 'locacao-opcao-aquisicao',
    label: 'Locação de veículo com opção de aquisição',
    descricao: 'Aluguel mensal com entrada e parcelas; cumpridas todas, o locatário pode adquirir o veículo. Inclui manutenção, vistorias, sinistros e multas.',
    categoriaSlug: 'locacao-com-venda-de-veiculo',
  },
]

/** Quem contrata (cliente). Textos livres, cpf com ou sem máscara. */
export interface ContratanteInput {
  nome: string
  /** Usada só na promessa de compra ("brasileiro(a)"). */
  nacionalidade: string
  rg: string
  cpf: string
  cep: string
  endereco: string
  estadoCivil: string
  profissao: string
  email: string
  telefone: string
}

export interface VeiculoContratoInput {
  /** Veículo do estoque (opcional). Se informado, o PDF é guardado nos contratos dele. */
  veiculoId: string
  ano: string
  placa: string
  renavam: string
}

/** Dados do financiamento do veículo (tabela da cláusula 1.3). */
export interface PrestacaoInput {
  banco: string
  qtdParcelas: string
  parcelasPagas: string
  parcelasAtraso: string
  valorParcela: string
}

export const FORMAS_PAGAMENTO = [
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência bancária' },
  { value: 'dinheiro', label: 'Dinheiro' },
] as const

/** Condições financeiras da locação com opção de aquisição. */
export interface LocacaoInput {
  /** Valor de cada aluguel mensal. */
  aluguel: string
  /** Dia do mês do vencimento (1 a 31). */
  diaVencimento: string
  /** Data do primeiro pagamento (AAAA-MM-DD). */
  primeiroPagamento: string
  /** Entrada paga na assinatura. */
  entrada: string
  /** Quantidade de parcelas mensais até a opção de aquisição. */
  parcelas: string
  /** Franquia do seguro em caso de sinistro. */
  franquia: string
}

/** Conta que recebe a restituição (anexo da recuperação de valores). */
export interface ContaInput {
  titular: string
  /** CPF ou CNPJ do titular. */
  documento: string
  banco: string
  agencia: string
  conta: string
  tipoConta: string
  chavePix: string
}

export interface IntermediadorInput {
  razaoSocial: string
  cnpj: string
  endereco: string
  /** Sócio administrador que assina pelo intermediador. */
  nome: string
  nacionalidade: string
  estadoCivil: string
  cpf: string
  email: string
}

export interface TestemunhaInput {
  nome: string
  /** CPF só com dígitos. */
  cpf: string
}

/** Valores de partida da promessa parcelada (editáveis no formulário). */
export const INTERMEDIADOR_PADRAO: IntermediadorInput = {
  razaoSocial: '55.116.497 OTAVIO MORETTO',
  cnpj: '55116497000108',
  endereco: 'Av. Doutor Quinzinho, 995, Sala 4, Jardim Jorge Atalla, Jaú/SP',
  nome: 'OTÁVIO MORETTO',
  nacionalidade: 'brasileiro',
  estadoCivil: 'casado',
  cpf: '52052536817',
  email: 'otaviomoretto01@gmail.com',
}

export const TESTEMUNHAS_PADRAO: TestemunhaInput[] = [
  { nome: 'ÁLESIS SILVA QUIO', cpf: '54234245852' },
  { nome: 'ALEX RODRIGO LEVORATO PARRELLA', cpf: '54440899803' },
]

/**
 * Valor inicial das testemunhas na prestação de serviços e na recuperação de valores.
 * São os dados que esses modelos já traziam fixos (o CPF do Alex difere do de
 * TESTEMUNHAS_PADRAO); agora são só o ponto de partida do formulário.
 */
export const TESTEMUNHAS_PADRAO_SERVICOS: TestemunhaInput[] = [
  { nome: 'ALESIS SILVA QUIO', cpf: '54234245852' },
  { nome: 'ALEX RODRIGO LEVORATO PARRELLA', cpf: '26298875883' },
]

/**
 * Dados próprios da promessa de compra. Instituição financeira, parcelas e valor
 * da parcela do financiamento vêm de `prestacao`.
 */
export interface CompraInput {
  marca: string
  modelo: string
  cor: string
  chassi: string
  categoria: string
  conservacao: string
  tipoFinanciamento: string
  valorFinanciado: string
  /** Saldo devedor aproximado, informado pelo usuário. */
  saldoDevedor: string
  /** Prazo em meses para quitar o financiamento (cláusula 1.3.1). */
  prazoQuitacao: string
  valorTotal: string
  formaPagamento: string
  // ── Só na promessa parcelada ──
  intermediador: IntermediadorInput
  testemunhas: TestemunhaInput[]
  /** Quantidade de parcelas do pagamento do preço. */
  pagamentos: string
  valorPagamento: string
  /** Vencimentos (AAAA-MM-DD), um por parcela. */
  vencimentos: string[]
  /** "Cidade/UF" do local de assinatura. */
  cidade: string
  /** Data de assinatura (AAAA-MM-DD). */
  dataAssinatura: string
  // ── Só na prestação de serviços ──
  /** Data limite do pagamento ao vendedor (AAAA-MM-DD). */
  dataPagamento: string
  /** Inclui a cláusula 1.6 (Limpa Nome). */
  limpaNome: boolean
  /** Inclui as cláusulas 5.3 a 5.3.3 (seguro prestamista). */
  seguroPrestamista: boolean
  // ── Só na recuperação de valores ──
  /** Nº do contrato de financiamento (alienação fiduciária). */
  numeroContrato: string
  conta: ContaInput
  // ── Só na locação com opção de aquisição ──
  locacao: LocacaoInput
}

export interface GerarContratoInput {
  tipo: TipoContratoGerado
  contratante: ContratanteInput
  /** Segundo vendedor (só em `prestacao-servico-casal`). */
  vendedor2: ContratanteInput
  veiculo: VeiculoContratoInput
  prestacao: PrestacaoInput
  compra: CompraInput
  salvarCliente: boolean
}

export const contratanteVazio = (): ContratanteInput => ({
  nome: '', nacionalidade: 'brasileiro(a)', rg: '', cpf: '', cep: '', endereco: '', estadoCivil: '', profissao: '', email: '', telefone: '',
})
export const veiculoContratoVazio = (): VeiculoContratoInput => ({
  veiculoId: '', ano: '', placa: '', renavam: '',
})
export const prestacaoVazia = (): PrestacaoInput => ({
  banco: '', qtdParcelas: '', parcelasPagas: '', parcelasAtraso: '', valorParcela: '',
})
export const compraVazia = (parcelado = false, testemunhas: TestemunhaInput[] = TESTEMUNHAS_PADRAO): CompraInput => ({
  marca: '', modelo: '', cor: '', chassi: '',
  categoria: parcelado ? 'PARTICULAR' : '',
  conservacao: parcelado ? 'USADO' : '',
  tipoFinanciamento: '', valorFinanciado: '', saldoDevedor: '',
  prazoQuitacao: '12', valorTotal: '', formaPagamento: 'pix',
  intermediador: parcelado
    ? { ...INTERMEDIADOR_PADRAO }
    : { razaoSocial: '', cnpj: '', endereco: '', nome: '', nacionalidade: '', estadoCivil: '', cpf: '', email: '' },
  testemunhas: testemunhas.map((t) => ({ ...t })),
  pagamentos: '2', valorPagamento: '', vencimentos: ['', ''],
  cidade: parcelado ? 'Jaú/SP' : '',
  dataAssinatura: '',
  dataPagamento: '', limpaNome: true, seguroPrestamista: true,
  numeroContrato: '',
  conta: { titular: '', documento: '', banco: '', agencia: '', conta: '', tipoConta: '', chavePix: '' },
  locacao: { aluguel: '', diaVencimento: '', primeiroPagamento: '', entrada: '', parcelas: '36', franquia: '' },
})

/** Dados da compra com o valor inicial (inclusive das testemunhas, sempre editáveis) de cada modelo. */
export const compraDoTipo = (tipo: TipoContratoGerado): CompraInput => {
  const servicos = ehPrestacao(tipo) || tipo === TIPO_RECUPERACAO
  const base = compraVazia(tipo === TIPO_PROMESSA_PARCELADA, servicos ? TESTEMUNHAS_PADRAO_SERVICOS : TESTEMUNHAS_PADRAO)
  // Locação: a testemunha I é fixa por padrão; a II varia de contrato para contrato.
  return tipo === TIPO_LOCACAO ? { ...base, testemunhas: [{ ...TESTEMUNHAS_PADRAO[0] }, { nome: '', cpf: '' }] } : base
}

/** Formulário do modelo escolhido ainda sem nada preenchido. */
export const inputPromessaVazio = (tipo: TipoContratoGerado = TIPO_PROMESSA): GerarContratoInput => ({
  tipo,
  contratante: contratanteVazio(),
  vendedor2: contratanteVazio(),
  veiculo: veiculoContratoVazio(),
  prestacao: prestacaoVazia(),
  compra: compraDoTipo(tipo),
  salvarCliente: false,
})

/** Veículo do estoque como os formulários de contrato o usam para pré-preencher. */
export interface VeiculoParaContrato {
  id: string
  rotulo: string
  marca: string
  modelo: string
  ano: string
  placa: string
  renavam: string
  banco: string
  valorParcela: number | null
  parcelasAtraso: number | null
}

/** Cliente guardado para reaproveitar em novos contratos (coleção `clientes_contrato`). */
export interface ClienteContrato {
  /** CPF só com dígitos. */
  id: string
  contratante: ContratanteInput
  atualizadoEm: string
}

export type GerarContratoResponse =
  | { error: string }
  | {
      success: string
      fileName: string
      /** PDF em base64 para o navegador baixar. */
      pdfBase64: string
      /** Preenchido quando o PDF foi guardado nos contratos do veículo. */
      guardadoNoVeiculo: boolean
      avisos: string[]
    }

/** Converte "R$ 1.234,56" / "1234,56" / "1234.56" em número. NaN se vazio/ inválido. */
export function numeroDe(raw: string): number {
  const s = String(raw ?? '').replace(/R\$/gi, '').replace(/\s/g, '')
  if (!s) return NaN
  const normal = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  return Number(normal)
}

function inteiroDe(raw: string): number {
  const s = String(raw ?? '').trim()
  return /^\d+$/.test(s) ? Number(s) : NaN
}

/** "AAAA-MM-DD" que existe no calendário. */
export function dataIsoValida(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return false
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])
}

/** As duas testemunhas (nome e CPF), em qualquer modelo. */
function validarTestemunhas(k: CompraInput): string | null {
  for (let n = 0; n < 2; n++) {
    const t = k.testemunhas[n]
    if (!t?.nome.trim()) return `Informe o nome da testemunha ${n + 1}.`
    if (onlyDigits(t.cpf).length !== 11) return `Informe o CPF da testemunha ${n + 1} (11 dígitos).`
  }
  return null
}

/** Parte própria da promessa parcelada: intermediador, testemunhas, parcelas, local e data. */
function validarParcelada(i: GerarContratoInput): string | null {
  const k = i.compra
  const m = k.intermediador
  if (!m.razaoSocial.trim()) return 'Informe a razão social do intermediador.'
  if (onlyDigits(m.cnpj).length !== 14) return 'Informe o CNPJ do intermediador (14 dígitos).'
  if (!m.endereco.trim()) return 'Informe o endereço do intermediador.'
  if (!m.nome.trim()) return 'Informe o nome do sócio administrador.'
  if (!m.nacionalidade.trim()) return 'Informe a nacionalidade do sócio administrador.'
  if (!m.estadoCivil.trim()) return 'Informe o estado civil do sócio administrador.'
  if (onlyDigits(m.cpf).length !== 11) return 'Informe o CPF do sócio administrador (11 dígitos).'
  if (!/^\S+@\S+\.\S+$/.test(m.email.trim())) return 'Informe o e-mail do intermediador.'

  const qtd = inteiroDe(k.pagamentos)
  if (!(qtd >= 1 && qtd <= 60)) return 'Informe a quantidade de parcelas do pagamento (de 1 a 60).'
  if (!(numeroDe(k.valorPagamento) > 0)) return 'Informe o valor de cada parcela do pagamento.'
  for (let n = 0; n < qtd; n++) {
    if (!dataIsoValida(k.vencimentos[n] ?? '')) return `Informe o vencimento da parcela ${n + 1}.`
  }
  const erroTestemunhas = validarTestemunhas(k)
  if (erroTestemunhas) return erroTestemunhas
  if (!k.cidade.trim()) return 'Informe a cidade/UF da assinatura.'
  if (!dataIsoValida(k.dataAssinatura)) return 'Informe a data da assinatura.'
  return null
}

/** Promessa de compra (as duas variantes). */
function validarCompra(i: GerarContratoInput): string | null {
  const parcelado = i.tipo === TIPO_PROMESSA_PARCELADA
  const c = i.contratante
  if (!c.nome.trim()) return 'Informe o nome completo.'
  if (!c.nacionalidade.trim()) return 'Informe a nacionalidade.'
  if (!ESTADOS_CIVIS.some((e) => e.value === c.estadoCivil)) return 'Informe o estado civil.'
  if (!c.profissao.trim()) return 'Informe a profissão.'
  if (!validarCPF(onlyDigits(c.cpf))) return 'CPF inválido.'
  if (!c.endereco.trim()) return 'Informe o endereço.'
  if (!parcelado && onlyDigits(c.telefone).length < 10) return 'Informe o telefone com DDD.'
  if (!c.email.trim() || !/^\S+@\S+\.\S+$/.test(c.email.trim())) return 'Informe um e-mail válido.'

  const k = i.compra
  const v = i.veiculo
  if (!k.marca.trim()) return 'Informe a marca do veículo.'
  if (!k.modelo.trim()) return 'Informe o modelo do veículo.'
  if (!v.ano.trim()) return 'Informe o ano do veículo.'
  if (!k.cor.trim()) return 'Informe a cor do veículo.'
  if (!v.placa.trim()) return 'Informe a placa.'
  if (!k.chassi.trim()) return 'Informe o chassi.'
  if (!v.renavam.trim()) return 'Informe o RENAVAM.'
  if (!k.categoria.trim()) return 'Informe a categoria do veículo.'
  if (!k.conservacao.trim()) return 'Informe o estado de conservação.'

  const p = i.prestacao
  if (!p.banco.trim()) return 'Informe a instituição financeira.'
  if (!k.tipoFinanciamento.trim()) return 'Informe o tipo de financiamento.'
  if (!(numeroDe(k.valorFinanciado) > 0)) return 'Informe o valor total financiado.'
  const qtd = inteiroDe(p.qtdParcelas)
  const pagas = inteiroDe(p.parcelasPagas)
  const atraso = inteiroDe(p.parcelasAtraso)
  if (!(qtd > 0)) return 'Informe a quantidade de parcelas.'
  if (!(numeroDe(p.valorParcela) > 0)) return 'Informe o valor da parcela.'
  if (!(pagas >= 0)) return 'Informe as parcelas pagas (0 se nenhuma).'
  if (pagas > qtd) return 'Parcelas pagas maior que o total de parcelas.'
  if (!(atraso >= 0)) return 'Informe as parcelas em atraso (0 se nenhuma).'
  if (!(numeroDe(k.saldoDevedor) > 0)) return 'Informe o saldo devedor aproximado.'
  if (!(inteiroDe(k.prazoQuitacao) > 0)) return 'Informe o prazo para quitação (em meses).'
  if (!(numeroDe(k.valorTotal) > 0)) return 'Informe o valor total do contrato.'
  if (parcelado) return validarParcelada(i)
  if (!FORMAS_PAGAMENTO.some((f) => f.value === k.formaPagamento)) return 'Informe a forma de pagamento.'
  return validarTestemunhas(k)
}

/** Dados pessoais de um vendedor da prestação de serviços (RG só no contrato do casal). */
function validarVendedor(c: ContratanteInput, rotulo: string, exigeRg: boolean): string | null {
  if (!c.nome.trim()) return `Informe o nome completo${rotulo}.`
  if (!c.nacionalidade.trim()) return `Informe a nacionalidade${rotulo}.`
  if (!ESTADOS_CIVIS.some((e) => e.value === c.estadoCivil)) return `Informe o estado civil${rotulo}.`
  if (!c.profissao.trim()) return `Informe a profissão${rotulo}.`
  if (!validarCPF(onlyDigits(c.cpf))) return `CPF inválido${rotulo}.`
  if (exigeRg && !c.rg.trim()) return `Informe o RG${rotulo}.`
  if (!c.endereco.trim()) return `Informe o endereço${rotulo}.`
  if (onlyDigits(c.telefone).length < 10) return `Informe o telefone com DDD${rotulo}.`
  if (!/^\S+@\S+\.\S+$/.test(c.email.trim())) return `Informe um e-mail válido${rotulo}.`
  return null
}

/** Prestação de serviços de intermediação (um vendedor ou casal). */
function validarPrestacao(i: GerarContratoInput): string | null {
  const casal = i.tipo === TIPO_PRESTACAO_CASAL
  const erro1 = validarVendedor(i.contratante, casal ? ' do vendedor I' : '', casal)
  if (erro1) return erro1
  if (casal) {
    const erro2 = validarVendedor(i.vendedor2, ' do vendedor II', true)
    if (erro2) return erro2
    if (onlyDigits(i.vendedor2.cpf) === onlyDigits(i.contratante.cpf)) return 'Os dois vendedores têm o mesmo CPF.'
  }

  const k = i.compra
  const v = i.veiculo
  const p = i.prestacao
  if (!k.marca.trim()) return 'Informe a marca do veículo.'
  if (!k.modelo.trim()) return 'Informe o modelo do veículo.'
  if (!v.ano.trim()) return 'Informe o ano do veículo.'
  if (!k.cor.trim()) return 'Informe a cor do veículo.'
  if (!v.placa.trim()) return 'Informe a placa.'
  if (!k.chassi.trim()) return 'Informe o chassi.'
  if (!v.renavam.trim()) return 'Informe o RENAVAM.'
  if (!k.categoria.trim()) return 'Informe a categoria do veículo.'
  if (!k.conservacao.trim()) return 'Informe o estado de conservação.'
  if (!p.banco.trim()) return 'Informe a instituição financeira.'
  if (!k.tipoFinanciamento.trim()) return 'Informe o tipo de financiamento.'
  if (!(numeroDe(k.valorFinanciado) > 0)) return 'Informe o valor total financiado.'
  const qtd = inteiroDe(p.qtdParcelas)
  const pagas = inteiroDe(p.parcelasPagas)
  const atraso = inteiroDe(p.parcelasAtraso)
  if (!(qtd > 0)) return 'Informe a quantidade de parcelas.'
  if (!(numeroDe(p.valorParcela) > 0)) return 'Informe o valor da parcela.'
  if (!(pagas >= 0)) return 'Informe as parcelas pagas (0 se nenhuma).'
  if (pagas > qtd) return 'Parcelas pagas maior que o total de parcelas.'
  if (!(atraso >= 0)) return 'Informe as parcelas em atraso (0 se nenhuma).'
  if (!(numeroDe(k.saldoDevedor) > 0)) return 'Informe o saldo devedor aproximado.'
  if (!(numeroDe(k.valorTotal) > 0)) return 'Informe o valor pago ao vendedor.'
  if (!dataIsoValida(k.dataPagamento)) return 'Informe a data limite do pagamento.'
  return validarTestemunhas(k)
}

/** Locação com opção de aquisição: locatário, veículo, condições e testemunhas. */
function validarLocacao(i: GerarContratoInput): string | null {
  const erroC = validarVendedor(i.contratante, '', false)
  if (erroC) return erroC
  const k = i.compra
  const v = i.veiculo
  if (!k.marca.trim()) return 'Informe a marca do veículo.'
  if (!k.modelo.trim()) return 'Informe o modelo do veículo.'
  if (!v.ano.trim()) return 'Informe o ano do veículo.'
  if (!k.cor.trim()) return 'Informe a cor do veículo.'
  if (!v.placa.trim()) return 'Informe a placa.'
  if (!k.chassi.trim()) return 'Informe o chassi.'
  if (!v.renavam.trim()) return 'Informe o RENAVAM.'
  const l = k.locacao
  if (!(numeroDe(l.aluguel) > 0)) return 'Informe o valor do aluguel mensal.'
  const dia = inteiroDe(l.diaVencimento)
  if (!(dia >= 1 && dia <= 31)) return 'Informe o dia do vencimento (de 1 a 31).'
  if (!dataIsoValida(l.primeiroPagamento)) return 'Informe a data do primeiro pagamento.'
  if (!(numeroDe(l.entrada) >= 0)) return 'Informe o valor da entrada (0 se não houver).'
  if (!(inteiroDe(l.parcelas) > 0)) return 'Informe a quantidade de parcelas.'
  if (!(numeroDe(l.franquia) > 0)) return 'Informe o valor da franquia do seguro.'
  const erroTestemunhas = validarTestemunhas(k)
  if (erroTestemunhas) return erroTestemunhas
  return null
}

/** Recuperação de valores: contratante com RG, dados do veículo, alienação e conta. */
function validarRecuperacao(i: GerarContratoInput): string | null {
  const erroC = validarVendedor(i.contratante, '', true)
  if (erroC) return erroC
  const k = i.compra
  const v = i.veiculo
  if (!k.marca.trim()) return 'Informe a marca do veículo.'
  if (!k.modelo.trim()) return 'Informe o modelo do veículo.'
  if (!v.ano.trim()) return 'Informe o ano do veículo.'
  if (!k.cor.trim()) return 'Informe a cor do veículo.'
  if (!v.placa.trim()) return 'Informe a placa.'
  if (!k.chassi.trim()) return 'Informe o chassi.'
  if (!v.renavam.trim()) return 'Informe o RENAVAM.'
  if (!k.categoria.trim()) return 'Informe a categoria do veículo.'
  if (!k.conservacao.trim()) return 'Informe o estado de conservação.'
  if (!i.prestacao.banco.trim()) return 'Informe a instituição da alienação fiduciária.'
  if (!k.numeroContrato.trim()) return 'Informe o nº do contrato de financiamento.'
  const c = k.conta
  if (!c.titular.trim()) return 'Informe o titular da conta.'
  const doc = onlyDigits(c.documento).length
  if (doc !== 11 && doc !== 14) return 'Informe o CPF ou CNPJ do titular da conta.'
  if (!c.banco.trim()) return 'Informe o banco da conta.'
  if (!c.agencia.trim()) return 'Informe a agência.'
  if (!c.conta.trim()) return 'Informe o número da conta.'
  if (!c.tipoConta.trim()) return 'Informe o tipo da conta.'
  return validarTestemunhas(k)
}

/** Retorna a mensagem do primeiro problema do formulário, ou null. */
export function validarGerarContrato(i: GerarContratoInput): string | null {
  if (ehLocacao(i.tipo)) return validarLocacao(i)
  if (ehRecuperacao(i.tipo)) return validarRecuperacao(i)
  return ehPrestacao(i.tipo) ? validarPrestacao(i) : validarCompra(i)
}

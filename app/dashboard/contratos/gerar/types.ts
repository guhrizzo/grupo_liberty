// Tipos e regras do gerador de contratos preenchidos. Ficam aqui (não em
// actions.ts) porque arquivos 'use server' só podem exportar funções async.

import { ESTADOS_CIVIS, precisaConjuge } from '@/utils/cobrancas/pessoa'
import { validarCPF } from '@/utils/validadorCpf'
import { onlyDigits } from '@/utils/masks'

/** Modelo com página própria (/dashboard/contratos/promessa-compra), fora do modal. */
export const TIPO_PROMESSA = 'promessa-compra-financiado' as const

export type TipoContratoGerado = 'prestacao-de-servico' | 'locacao-de-veiculo' | 'promessa-compra-financiado'

export const TIPOS_CONTRATO_GERADO: {
  value: TipoContratoGerado
  label: string
  descricao: string
  /** Slug da categoria de contrato (CATEGORIAS_CONTRATO_FIXAS) usada ao guardar no veículo. */
  categoriaSlug: string
}[] = [
  {
    value: 'prestacao-de-servico',
    label: 'Prestação de serviço',
    descricao: 'Serviços de intermediação e regularização do financiamento de um veículo financiado, com seguro prestamista e limpa nome opcionais.',
    categoriaSlug: 'prestacao-de-servico',
  },
  {
    value: 'locacao-de-veiculo',
    label: 'Locação de veículo',
    descricao: 'Locação do veículo ao locatário, com prazo, valor semanal e caução.',
    categoriaSlug: 'locacao-de-veiculo',
  },
  {
    value: 'promessa-compra-financiado',
    label: 'Promessa de compra de veículo financiado',
    descricao: 'Promessa de compra de veículo financiado com assunção das parcelas pelo comprador, prazo para quitação e prévia do contrato em folhas A4.',
    categoriaSlug: 'venda-de-veiculo-financiado',
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

export interface ConjugeInput {
  nome: string
  rg: string
  cpf: string
  profissao: string
}

export interface VeiculoContratoInput {
  /** Veículo do estoque (opcional). Se informado, o PDF é guardado nos contratos dele. */
  veiculoId: string
  marcaModelo: string
  ano: string
  fipe: string
  placa: string
  renavam: string
}

export interface PrestacaoInput {
  banco: string
  qtdParcelas: string
  parcelasPagas: string
  parcelasAtraso: string
  valorParcela: string
  /** Prazo em meses. */
  prazo: string
  valorProposta: string
  seguroPrestamista: boolean
  limpaNome: boolean
}

export interface LocacaoInput {
  /** Prazo em meses. */
  prazo: string
  valorSemanal: string
  caucao: string
}

export const FORMAS_PAGAMENTO = [
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência bancária' },
  { value: 'dinheiro', label: 'Dinheiro' },
] as const

/**
 * Dados próprios da promessa de compra. Banco, parcelas e valor da parcela
 * vêm de `prestacao` (mesmos campos do contrato de prestação de serviço).
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
}

export interface GerarContratoInput {
  tipo: TipoContratoGerado
  contratante: ContratanteInput
  conjuge: ConjugeInput
  veiculo: VeiculoContratoInput
  prestacao: PrestacaoInput
  locacao: LocacaoInput
  compra: CompraInput
  salvarCliente: boolean
}

export const contratanteVazio = (): ContratanteInput => ({
  nome: '', nacionalidade: 'brasileiro(a)', rg: '', cpf: '', cep: '', endereco: '', estadoCivil: '', profissao: '', email: '', telefone: '',
})
export const conjugeVazio = (): ConjugeInput => ({ nome: '', rg: '', cpf: '', profissao: '' })
export const veiculoContratoVazio = (): VeiculoContratoInput => ({
  veiculoId: '', marcaModelo: '', ano: '', fipe: '', placa: '', renavam: '',
})
export const prestacaoVazia = (): PrestacaoInput => ({
  banco: '', qtdParcelas: '', parcelasPagas: '', parcelasAtraso: '', valorParcela: '',
  prazo: '', valorProposta: '', seguroPrestamista: false, limpaNome: false,
})
export const locacaoVazia = (): LocacaoInput => ({ prazo: '', valorSemanal: '', caucao: '' })
export const compraVazia = (): CompraInput => ({
  marca: '', modelo: '', cor: '', chassi: '', categoria: '', conservacao: '',
  tipoFinanciamento: '', valorFinanciado: '', saldoDevedor: '',
  prazoQuitacao: '12', valorTotal: '', formaPagamento: 'pix',
})

/** Formulário da promessa de compra ainda sem nada preenchido. */
export const inputPromessaVazio = (): GerarContratoInput => ({
  tipo: TIPO_PROMESSA,
  contratante: contratanteVazio(),
  conjuge: conjugeVazio(),
  veiculo: veiculoContratoVazio(),
  prestacao: prestacaoVazia(),
  locacao: locacaoVazia(),
  compra: compraVazia(),
  salvarCliente: false,
})

/** Veículo do estoque como os formulários de contrato o usam para pré-preencher. */
export interface VeiculoParaContrato {
  id: string
  rotulo: string
  marca: string
  modelo: string
  marcaModelo: string
  ano: string
  placa: string
  fipe: number | null
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
  conjuge: ConjugeInput | null
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

/** Promessa de compra: sem RG, sem FIPE e sem cônjuge. */
function validarCompra(i: GerarContratoInput): string | null {
  const c = i.contratante
  if (!c.nome.trim()) return 'Informe o nome completo.'
  if (!c.nacionalidade.trim()) return 'Informe a nacionalidade.'
  if (!ESTADOS_CIVIS.some((e) => e.value === c.estadoCivil)) return 'Informe o estado civil.'
  if (!c.profissao.trim()) return 'Informe a profissão.'
  if (!validarCPF(onlyDigits(c.cpf))) return 'CPF inválido.'
  if (!c.endereco.trim()) return 'Informe o endereço.'
  if (onlyDigits(c.telefone).length < 10) return 'Informe o telefone com DDD.'
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
  if (!FORMAS_PAGAMENTO.some((f) => f.value === k.formaPagamento)) return 'Informe a forma de pagamento.'
  return null
}

/** Retorna a mensagem do primeiro problema do formulário, ou null. */
export function validarGerarContrato(i: GerarContratoInput): string | null {
  if (i.tipo === 'promessa-compra-financiado') return validarCompra(i)
  const c = i.contratante
  if (!c.nome.trim()) return 'Informe o nome completo.'
  if (!c.rg.trim()) return 'Informe o RG.'
  if (!validarCPF(onlyDigits(c.cpf))) return 'CPF inválido.'
  if (!c.endereco.trim()) return 'Informe o endereço.'
  if (!ESTADOS_CIVIS.some((e) => e.value === c.estadoCivil)) return 'Informe o estado civil.'
  if (!c.profissao.trim()) return 'Informe a profissão.'
  if (!c.email.trim() || !/^\S+@\S+\.\S+$/.test(c.email.trim())) return 'Informe um e-mail válido.'
  if (precisaConjuge(c.estadoCivil)) {
    if (!i.conjuge.nome.trim()) return 'Informe o nome do cônjuge.'
    if (!validarCPF(onlyDigits(i.conjuge.cpf))) return 'CPF do cônjuge inválido.'
  }
  const v = i.veiculo
  if (!v.marcaModelo.trim()) return 'Informe marca/modelo do veículo.'
  if (!v.ano.trim()) return 'Informe o ano do veículo.'
  if (!v.placa.trim()) return 'Informe a placa.'
  if (!v.renavam.trim()) return 'Informe o RENAVAM.'
  if (!(numeroDe(v.fipe) > 0)) return 'Informe o valor da FIPE.'

  if (i.tipo === 'prestacao-de-servico') {
    const p = i.prestacao
    if (!p.banco.trim()) return 'Informe o banco financiado.'
    const qtd = inteiroDe(p.qtdParcelas)
    const pagas = inteiroDe(p.parcelasPagas)
    const atraso = inteiroDe(p.parcelasAtraso)
    if (!(qtd > 0)) return 'Informe a quantidade de parcelas.'
    if (!(pagas >= 0)) return 'Informe as parcelas pagas (0 se nenhuma).'
    if (pagas > qtd) return 'Parcelas pagas maior que o total de parcelas.'
    if (!(atraso >= 0)) return 'Informe as parcelas em atraso (0 se nenhuma).'
    if (!(numeroDe(p.valorParcela) > 0)) return 'Informe o valor da parcela.'
    if (!(inteiroDe(p.prazo) > 0)) return 'Informe o prazo (em meses).'
    if (!(numeroDe(p.valorProposta) > 0)) return 'Informe o valor da proposta.'
  } else {
    const l = i.locacao
    if (!(inteiroDe(l.prazo) > 0)) return 'Informe o prazo (em meses).'
    if (!(numeroDe(l.valorSemanal) > 0)) return 'Informe o valor semanal.'
    if (!(numeroDe(l.caucao) >= 0)) return 'Informe a caução (0 se não houver).'
  }
  return null
}

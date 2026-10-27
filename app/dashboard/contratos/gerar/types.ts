// Tipos e regras do gerador de contratos preenchidos. Ficam aqui (não em
// actions.ts) porque arquivos 'use server' só podem exportar funções async.

import { ESTADOS_CIVIS, precisaConjuge } from '@/utils/cobrancas/pessoa'
import { validarCPF } from '@/utils/validadorCpf'
import { onlyDigits } from '@/utils/masks'

export type TipoContratoGerado = 'prestacao-de-servico' | 'locacao-de-veiculo'

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
    descricao: 'Veículo financiado: repasse, parcelas, seguro prestamista e limpa nome opcionais.',
    categoriaSlug: 'prestacao-de-servico',
  },
  {
    value: 'locacao-de-veiculo',
    label: 'Locação de veículo',
    descricao: 'Prazo, valor semanal e caução.',
    categoriaSlug: 'locacao-de-veiculo',
  },
]

/** Quem contrata (cliente). Textos livres, cpf com ou sem máscara. */
export interface ContratanteInput {
  nome: string
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

export interface GerarContratoInput {
  tipo: TipoContratoGerado
  contratante: ContratanteInput
  conjuge: ConjugeInput
  veiculo: VeiculoContratoInput
  prestacao: PrestacaoInput
  locacao: LocacaoInput
  salvarCliente: boolean
}

export const contratanteVazio = (): ContratanteInput => ({
  nome: '', rg: '', cpf: '', cep: '', endereco: '', estadoCivil: '', profissao: '', email: '', telefone: '',
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

/** Retorna a mensagem do primeiro problema do formulário, ou null. */
export function validarGerarContrato(i: GerarContratoInput): string | null {
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

// Recibo de pagamento de veículo: tipos e regras. Ficam aqui (não em actions.ts)
// porque arquivos 'use server' só podem exportar funções async.

import { onlyDigits } from '@/utils/masks'
import { validarCPF } from '@/utils/validadorCpf'
import { INTERMEDIADOR_PADRAO, dataIsoValida, numeroDe } from '../types'

export const FORMAS_RECIBO = [
  { value: '', label: 'Não informar' },
  { value: 'PIX', label: 'PIX' },
  { value: 'transferência bancária', label: 'Transferência bancária' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartão', label: 'Cartão' },
  { value: 'boleto', label: 'Boleto' },
] as const

export const REFERENCIA_PADRAO = 'pagamento do preço da promessa de compra do veículo acima descrito'

export interface ReciboPagador {
  nome: string
  /** CPF (11) ou CNPJ (14), só dígitos. */
  documento: string
  endereco: string
  telefone: string
  email: string
}

export interface ReciboVeiculo {
  /** Veículo do estoque (guarda o recibo nos documentos dele); vazio = digitado à mão. */
  veiculoId: string
  marca: string
  modelo: string
  ano: string
  cor: string
  placa: string
  chassi: string
  renavam: string
}

export interface ReciboRecebedor {
  nome: string
  cnpj: string
  endereco: string
  responsavel: string
  responsavelCpf: string
}

export interface ReciboPagamento {
  /** "1.234,56" */
  valor: string
  /** AAAA-MM-DD */
  data: string
  forma: string
  /** Preço total do contrato (opcional): habilita "pagamento parcial" e o saldo. */
  valorTotal: string
  referencia: string
}

export interface ReciboInput {
  pagador: ReciboPagador
  veiculo: ReciboVeiculo
  recebedor: ReciboRecebedor
  pagamento: ReciboPagamento
  guardarNoVeiculo: boolean
}

export const reciboVazio = (): ReciboInput => ({
  pagador: { nome: '', documento: '', endereco: '', telefone: '', email: '' },
  veiculo: { veiculoId: '', marca: '', modelo: '', ano: '', cor: '', placa: '', chassi: '', renavam: '' },
  recebedor: {
    nome: INTERMEDIADOR_PADRAO.razaoSocial,
    cnpj: INTERMEDIADOR_PADRAO.cnpj,
    endereco: INTERMEDIADOR_PADRAO.endereco,
    responsavel: INTERMEDIADOR_PADRAO.nome,
    responsavelCpf: INTERMEDIADOR_PADRAO.cpf,
  },
  pagamento: { valor: '', data: '', forma: '', valorTotal: '', referencia: REFERENCIA_PADRAO },
  guardarNoVeiculo: true,
})

export type GerarReciboResponse =
  | { error: string }
  | { success: string; fileName: string; pdfBase64: string; guardadoNoVeiculo: boolean; avisos: string[] }

/** Mensagem do primeiro problema do formulário, ou null. */
export function validarRecibo(i: ReciboInput): string | null {
  const p = i.pagador
  if (!p.nome.trim()) return 'Informe o nome do pagador.'
  const doc = onlyDigits(p.documento)
  if (doc.length === 11) {
    if (!validarCPF(doc)) return 'CPF do pagador inválido.'
  } else if (doc.length !== 14) {
    return 'Informe o CPF (11 dígitos) ou CNPJ (14 dígitos) do pagador.'
  }

  const v = i.veiculo
  if (!v.marca.trim()) return 'Informe a marca do veículo.'
  if (!v.modelo.trim()) return 'Informe o modelo do veículo.'
  if (!v.placa.trim()) return 'Informe a placa.'

  const r = i.recebedor
  if (!r.nome.trim()) return 'Informe o nome ou a razão social de quem recebeu.'
  if (r.cnpj && onlyDigits(r.cnpj).length !== 14) return 'O CNPJ de quem recebeu precisa ter 14 dígitos.'

  const g = i.pagamento
  const valor = numeroDe(g.valor)
  if (!(valor > 0)) return 'Informe o valor recebido.'
  if (!dataIsoValida(g.data)) return 'Informe a data do pagamento.'
  if (g.valorTotal.trim()) {
    const total = numeroDe(g.valorTotal)
    if (!(total > 0)) return 'Valor total do contrato inválido.'
    if (valor > total + 0.001) return 'O valor recebido é maior que o valor total do contrato.'
  }
  if (!g.referencia.trim()) return 'Informe a que se refere o pagamento.'
  return null
}

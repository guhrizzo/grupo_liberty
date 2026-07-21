export type ContratoStatus = 'ativo' | 'cancelado'

export interface Contrato {
  id: string
  veiculoId: string
  veiculoResumo: string
  veiculoMarca: string
  veiculoModelo: string
  veiculoAno: number | null
  veiculoPlaca: string | null
  veiculoChassi: string | null
  veiculoCor: string | null
  veiculoQuilometragem: number | null
  veiculoLocalizacao: 'jau' | 'bauru' | null
  clienteNome: string
  clienteCpfCnpj: string
  clienteEndereco: string
  clienteEmail: string | null
  clienteTelefone: string | null
  valor: number
  formaPagamento: string
  dataEmissao: string
  clausulasExtras: string
  observacoesInternas: string
  status: ContratoStatus
  storagePath: string
  criadoPorUid: string
  criadoPorEmail: string | null
  criadoEm: string
  atualizadoEm: string
}

export interface ContratoInput {
  veiculoId: string
  clienteNome: string
  clienteCpfCnpj: string
  clienteEndereco: string
  clienteEmail?: string | null
  clienteTelefone?: string | null
  valor: number
  formaPagamento: string
  clausulasExtras?: string
  observacoesInternas?: string
}

export type ContratoResponse = {
  success?: string
  error?: string
  contrato?: Contrato
}

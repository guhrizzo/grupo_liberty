export type SeguroStatus = 'pendente' | 'cancelado' | 'inexistente'

export const SEGURO_STATUS: { value: SeguroStatus; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'inexistente', label: 'Não existe' },
]

/** Controle do cancelamento do seguro de um veículo (coleção `seguros`, um doc por veículo). */
export interface Seguro {
  veiculoId: string
  status: SeguroStatus
  /** Valor previsto de reembolso, em reais. */
  valorPrevisto: number
  /** Valor realmente reembolsado após o cancelamento, em reais. */
  valorCancelado: number
  observacao: string
}

/** Veículo com o seguro (padrão: pendente, sem valores) para a lista. */
export interface VeiculoSeguro extends Seguro {
  marca: string
  modelo: string
  ano: number
  placa: string | null
  foto: string | null
}

export interface SeguroInput {
  veiculoId: string
  status: SeguroStatus
  valorPrevisto: number
  valorCancelado: number
  observacao?: string
}

export interface ResumoSeguro {
  status: SeguroStatus
  valorPrevisto: number
  valorCancelado: number
}

export const SEGURO_OBS_MAX = 300

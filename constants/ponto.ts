// Registro de ponto — constantes compartilhadas (servidor e cliente).

/**
 * Quem bate ponto (Gustavo, Jessica e Álesis). Só essas contas veem "Bater
 * ponto", conseguem registrar batida e aparecem na folha de ponto.
 */
export const PONTO_FUNCIONARIOS_EMAILS: readonly string[] = [
  'gurizzo943@gmail.com',
  'jhessycamalaquias1@gmail.com',
  'alesisquiojau@gmail.com',
]

export function podeBaterPonto(email: string | null | undefined): boolean {
  const e = email?.toLowerCase().trim()
  return !!e && PONTO_FUNCIONARIOS_EMAILS.includes(e)
}

/** Ordem fixa das batidas do dia. */
export const BATIDAS = ['entrada', 'saida_almoco', 'volta_almoco', 'saida'] as const
export type Batida = (typeof BATIDAS)[number]
export type Batidas = Partial<Record<Batida, string>> // ISO 8601 (UTC)

export const BATIDA_LABEL: Record<Batida, string> = {
  entrada: 'Entrada',
  saida_almoco: 'Saída para o almoço',
  volta_almoco: 'Volta do almoço',
  saida: 'Saída',
}

/** Jornada diária padrão, em minutos (8h). */
export const JORNADA_PADRAO_MIN = 480
export const JORNADA_MIN_MAXIMA = 16 * 60

/** Intervalo mínimo entre duas batidas seguidas (evita toque/escaneio duplo). */
export const INTERVALO_MIN_ENTRE_BATIDAS_MS = 2 * 60 * 1000

/** Cada janela do QR dura 30 s; o token vale a janela atual e a anterior (~60 s). */
export const QR_JANELA_MS = 30 * 1000

/** Ponto digital: raio padrão ao redor da empresa e pior precisão de GPS aceita. */
export const RAIO_PONTO_M_PADRAO = 200
export const PRECISAO_MAX_M = 100

/** Como a batida foi registrada. */
export type OrigemBatida = 'qr' | 'digital' | 'manual'

/** Fuso do ponto. O Brasil não tem horário de verão desde 2019, então o offset é fixo. */
export const FUSO_PONTO = 'America/Sao_Paulo'
export const OFFSET_PONTO = '-03:00'

export const COLECAO_PONTO = 'ponto_registros'
export const COLECAO_PONTO_CONFIG = 'ponto_config'

export interface EdicaoPonto {
  porUid: string
  porEmail: string
  em: string // ISO
  campo: Batida
  de: string | null // ISO
  para: string | null // ISO
  motivo: string
}

export interface RegistroPonto {
  id: string
  uid: string
  email: string
  nome: string
  data: string // YYYY-MM-DD (America/Sao_Paulo)
  batidas: Batidas
  /** Origem de cada batida (registros antigos não têm: tratar como QR). */
  origens: Partial<Record<Batida, OrigemBatida>>
  /** Distância até a empresa (m) das batidas digitais. */
  distancias: Partial<Record<Batida, number>>
  jornadaMin: number
  edicoes: EdicaoPonto[]
}

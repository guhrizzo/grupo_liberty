// Fonte única das opções de câmbio e combustível de um veículo. Usado pelo
// formulário do dashboard (VeiculosClient), pelo formulário público de anúncio
// e pela validação do endpoint /api/anuncios — para os três lados aceitarem
// exatamente os mesmos `value`s.

export interface OpcaoVeiculo {
  value: string
  label: string
}

export const CAMBIO_OPCOES: readonly OpcaoVeiculo[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'automatico', label: 'Automático' },
  { value: 'cvt', label: 'CVT' },
  { value: 'automatizado', label: 'Automatizado' },
] as const

export const COMBUSTIVEL_OPCOES: readonly OpcaoVeiculo[] = [
  { value: 'flex', label: 'Flex' },
  { value: 'gasolina', label: 'Gasolina' },
  { value: 'etanol', label: 'Etanol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'eletrico', label: 'Elétrico' },
  { value: 'hibrido', label: 'Híbrido' },
] as const

export const CAMBIO_VALUES = CAMBIO_OPCOES.map((o) => o.value)
export const COMBUSTIVEL_VALUES = COMBUSTIVEL_OPCOES.map((o) => o.value)

export function isCambioValido(value: string): boolean {
  return CAMBIO_VALUES.includes(value)
}

export function isCombustivelValido(value: string): boolean {
  return COMBUSTIVEL_VALUES.includes(value)
}

/** Por onde o veículo veio — campo interno da aba Veículos. */
export const CANAIS_AQUISICAO = [
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'terceiros', label: 'Terceiros' },
  { value: 'outro', label: 'Outro' },
] as const

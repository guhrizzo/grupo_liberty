/** Motivos de recusa de uma proposta registrada (valor gravado → rótulo exibido). */
export const MOTIVOS_RECUSA = [
  { valor: 'preco', label: 'Preço / valor baixo' },
  { valor: 'desistiu', label: 'Cliente desistiu' },
  { valor: 'outro_comprador', label: 'Fechou com outro comprador' },
  { valor: 'documentacao', label: 'Documentação / restrição no veículo' },
  { valor: 'sem_retorno', label: 'Sem retorno do cliente' },
  { valor: 'outro', label: 'Outro' },
] as const

export type MotivoRecusa = (typeof MOTIVOS_RECUSA)[number]['valor']

export const MOTIVO_DETALHE_MAX = 300

/** Texto para exibir; propostas recusadas antes do campo existir ficam "Não informado". */
export function textoMotivoRecusa(motivo: string | null, detalhe: string | null): string {
  if (!motivo) return 'Não informado'
  const label = MOTIVOS_RECUSA.find((m) => m.valor === motivo)?.label ?? 'Não informado'
  return motivo === 'outro' && detalhe ? `Outro: ${detalhe}` : label
}

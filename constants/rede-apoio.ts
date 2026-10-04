// Rede de apoio: amigos, parceiros, conhecidos e mentorados espalhados pelo
// Brasil que podem receber ou ver um veículo numa cidade onde a Liberty não
// tem escritório. Fonte única usada pelo formulário e pela validação.

export const REDE_RELACOES = ['amigo', 'parceiro', 'conhecido', 'mentorado', 'outro'] as const
export type RedeRelacao = (typeof REDE_RELACOES)[number]

export const REDE_RELACAO_LABEL: Record<RedeRelacao, string> = {
  amigo: 'Amigo',
  parceiro: 'Parceiro',
  conhecido: 'Conhecido',
  mentorado: 'Mentorado',
  outro: 'Outro',
}

export function ehRedeRelacao(v: unknown): v is RedeRelacao {
  return typeof v === 'string' && (REDE_RELACOES as readonly string[]).includes(v)
}

export const REDE_NOME_MAX = 120
export const REDE_CIDADE_MAX = 80
export const REDE_TELEFONE_MAX = 20
export const REDE_OBS_MAX = 1000

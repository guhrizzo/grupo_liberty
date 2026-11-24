import type { Periodicidade } from './catalogo-modelo'

export const SERVICOS_POS_VENDA = [
  { id: 'juridico', nome: 'Acompanhamento jurídico', descricao: 'Acompanhe processos e alertas. A defesa em caso de apreensão segue as condições acordadas com o advogado.' },
  { id: 'quitacao', nome: 'Negociação de quitação', descricao: 'Acompanhe as tentativas de negociação da Liberty com o banco.' },
  { id: 'rastreamento', nome: 'Rastreamento veicular', descricao: 'Consulte a última posição do veículo e as posições disponíveis no histórico.' },
  { id: 'pacote', nome: 'Pacote completo', descricao: 'Inclui acompanhamento jurídico, negociação de quitação e rastreamento.' },
] as const

export type ServicoPosVenda = (typeof SERVICOS_POS_VENDA)[number]['id']
export type ServicoIndividual = Exclude<ServicoPosVenda, 'pacote'>
export type SituacaoPosVenda = 'solicitado' | 'proposta' | 'aceito' | 'ativando' | 'ativo' | 'cancelando' | 'cancelado'
export type TipoAndamentoPosVenda = 'processo' | 'restricao' | 'busca_apreensao' | 'encaminhamento' | 'tentativa_quitacao' | 'retorno_banco'

export const SITUACOES_POS_VENDA: Record<SituacaoPosVenda, string> = {
  solicitado: 'Solicitado', proposta: 'Proposta disponível', aceito: 'Aceito',
  ativando: 'Ativação em conferência', ativo: 'Ativo', cancelando: 'Cancelamento em conferência', cancelado: 'Cancelado',
}

export const ANDAMENTOS_POS_VENDA = [
  { id: 'processo', nome: 'Andamento processual', servico: 'juridico' },
  { id: 'restricao', nome: 'Restrição judicial', servico: 'juridico' },
  { id: 'busca_apreensao', nome: 'Busca e apreensão', servico: 'juridico' },
  { id: 'encaminhamento', nome: 'Encaminhamento ao advogado', servico: 'juridico' },
  { id: 'tentativa_quitacao', nome: 'Tentativa de negociação', servico: 'quitacao' },
  { id: 'retorno_banco', nome: 'Retorno do banco', servico: 'quitacao' },
] as const

export function servicosInclusos(servico: ServicoPosVenda): readonly ServicoIndividual[] {
  return servico === 'pacote' ? ['juridico', 'quitacao', 'rastreamento'] : [servico]
}

export const nomeServico = (id: ServicoPosVenda) => SERVICOS_POS_VENDA.find((s) => s.id === id)!.nome
export const idPosVendaValido = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id)
export const servicoValido = (id: unknown): id is ServicoPosVenda => SERVICOS_POS_VENDA.some((s) => s.id === id)
export const pagoPosVenda = (status: string) => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status)
export const pendentePosVenda = (status: string) => ['PENDING', 'OVERDUE', 'AWAITING_RISK_ANALYSIS'].includes(status)

export interface PropostaPosVenda {
  id: string
  valorCentavos: number
  vencimento: string
  termos: string
  honorarios20: boolean
  rastreador: string | null
  /** Propostas antigas não têm este campo e são mensais. */
  periodicidade?: Periodicidade
}

export interface ContratoPosVenda {
  documento: string
  veiculoId: string
  vinculo: string
  servico: ServicoPosVenda
  situacao: SituacaoPosVenda
  criadoEm: string
  proposta?: PropostaPosVenda
  aceite?: { propostaId: string; em: string; rastreamento?: boolean }
  asaasId?: string
  asaasCliente?: string
}

export interface MensalidadePosVenda {
  id: string
  vencimento: string
  valor: number
  status: string
  url: string | null
}

export function hojePosVenda() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

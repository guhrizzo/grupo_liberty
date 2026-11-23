export const ETAPAS_QUITACAO = [
  { id: 'recebido', nome: 'Veículo recebido' },
  { id: 'documentacao', nome: 'Documentação em análise' },
  { id: 'negociacao', nome: 'Negociação com o banco' },
  { id: 'negociacao_concluida', nome: 'Negociação concluída' },
  { id: 'em_quitacao', nome: 'Quitação em andamento' },
  { id: 'quitado', nome: 'Quitação realizada' },
  { id: 'finalizado', nome: 'Processo finalizado' },
] as const

export type EtapaQuitacao = (typeof ETAPAS_QUITACAO)[number]['id']
export type EventoQuitacao = { etapa: EtapaQuitacao; em: string }

export const etapaValida = (valor: unknown): valor is EtapaQuitacao =>
  ETAPAS_QUITACAO.some(({ id }) => id === valor)

export const etapaTemQuitacao = (etapa: EtapaQuitacao) => etapa === 'quitado' || etapa === 'finalizado'
export const etapaNotificavel = (etapa: EtapaQuitacao) =>
  etapa === 'negociacao_concluida' || etapa === 'em_quitacao' || etapaTemQuitacao(etapa)

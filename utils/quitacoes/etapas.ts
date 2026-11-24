/** Etapa da linha do tempo de quitação. A lista é global e editável pelo administrador. */
export type EtapaConfig = {
  id: string
  nome: string
  /** Texto curto exibido ao cliente sob o nome da etapa. */
  descricao: string
  /** Etapas inativas somem das escolhas novas, mas continuam válidas no histórico. */
  ativa: boolean
  /** Envia e-mail ao cliente quando a operação chega nesta etapa. */
  avisar: boolean
  /** A partir desta etapa o financiamento conta como quitado. */
  quitacao: boolean
}

export type EtapaQuitacao = string
export type EventoQuitacao = { etapa: EtapaQuitacao; em: string }

/** Etapa inicial de toda operação: não pode ser desativada. */
export const ETAPA_INICIAL = 'recebido'
export const MAX_ETAPAS = 30

export const ETAPAS_PADRAO: readonly EtapaConfig[] = [
  { id: 'recebido', nome: 'Operação realizada', descricao: 'Veículo recebido pela Liberty e operação formalizada.', ativa: true, avisar: false, quitacao: false },
  { id: 'documentacao_recebida', nome: 'Documentação recebida', descricao: 'Documentos necessários recebidos.', ativa: true, avisar: false, quitacao: false },
  { id: 'documentacao', nome: 'Análise documental', descricao: 'Conferência dos documentos e informações.', ativa: true, avisar: false, quitacao: false },
  { id: 'negociacao', nome: 'Em negociação com a instituição financeira', descricao: 'Liberty realizando tratativas para a futura quitação.', ativa: true, avisar: false, quitacao: false },
  { id: 'negociacao_concluida', nome: 'Negociação concluída', descricao: 'Condições de quitação definidas.', ativa: true, avisar: true, quitacao: false },
  { id: 'em_quitacao', nome: 'Quitação em andamento', descricao: 'Pagamento da quitação sendo providenciado.', ativa: true, avisar: true, quitacao: false },
  { id: 'quitado', nome: 'Quitação concluída', descricao: 'Financiamento quitado junto à instituição financeira.', ativa: true, avisar: true, quitacao: true },
  { id: 'finalizacao_documental', nome: 'Finalização documental', descricao: 'Providências documentais finais da operação.', ativa: true, avisar: false, quitacao: true },
  { id: 'finalizado', nome: 'Operação encerrada', descricao: 'Todas as etapas aplicáveis foram concluídas.', ativa: true, avisar: true, quitacao: true },
]

const ID_ETAPA = /^[a-z0-9_]{1,40}$/

/** Valida e limpa uma lista vinda do banco ou do formulário. Devolve null se for inutilizável. */
export function normalizarEtapas(valor: unknown): EtapaConfig[] | null {
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > MAX_ETAPAS) return null
  const vistos = new Set<string>()
  const etapas: EtapaConfig[] = []
  for (const bruto of valor) {
    if (!bruto || typeof bruto !== 'object') return null
    const e = bruto as Record<string, unknown>
    const id = typeof e.id === 'string' ? e.id : ''
    const nome = typeof e.nome === 'string' ? e.nome.trim() : ''
    const descricao = typeof e.descricao === 'string' ? e.descricao.trim() : ''
    if (!ID_ETAPA.test(id) || vistos.has(id) || !nome || nome.length > 80 || descricao.length > 200) return null
    vistos.add(id)
    etapas.push({
      id, nome, descricao,
      ativa: id === ETAPA_INICIAL ? true : e.ativa !== false,
      avisar: e.avisar === true,
      quitacao: e.quitacao === true,
    })
  }
  if (!vistos.has(ETAPA_INICIAL) || !etapas.some((e) => e.ativa && e.id !== ETAPA_INICIAL)) return null
  return etapas
}

export const etapaValida = (etapas: readonly EtapaConfig[], id: unknown): id is EtapaQuitacao =>
  typeof id === 'string' && etapas.some((e) => e.id === id)
export const etapaTemQuitacao = (etapas: readonly EtapaConfig[], id: EtapaQuitacao) =>
  etapas.find((e) => e.id === id)?.quitacao === true
export const etapaNotificavel = (etapas: readonly EtapaConfig[], id: EtapaQuitacao) =>
  etapas.find((e) => e.id === id)?.avisar === true
export const nomeEtapa = (etapas: readonly EtapaConfig[], id: EtapaQuitacao) =>
  etapas.find((e) => e.id === id)?.nome ?? ''

/** Etapas que aparecem na linha do tempo de uma operação: ativas ou já usadas, menos as que não se aplicam. */
export function etapasDaOperacao(
  etapas: readonly EtapaConfig[],
  atual: EtapaQuitacao,
  historico: readonly EventoQuitacao[],
  naoAplicaveis: readonly string[],
) {
  const usadas = new Set([atual, ...historico.map((h) => h.etapa)])
  return etapas.filter((e) => !naoAplicaveis.includes(e.id) && (e.ativa || usadas.has(e.id)))
}

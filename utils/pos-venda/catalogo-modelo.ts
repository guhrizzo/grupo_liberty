import { SERVICOS_POS_VENDA, type ServicoPosVenda } from './modelo'

export type Periodicidade = 'mensal' | 'trimestral' | 'semestral' | 'anual'

/** `ciclo` é o valor que o Asaas espera na assinatura. */
export const PERIODICIDADES: Record<Periodicidade, { rotulo: string; por: string; ciclo: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY' }> = {
  mensal: { rotulo: 'Mensal', por: 'por mês', ciclo: 'MONTHLY' },
  trimestral: { rotulo: 'Trimestral', por: 'por trimestre', ciclo: 'QUARTERLY' },
  semestral: { rotulo: 'Semestral', por: 'por semestre', ciclo: 'SEMIANNUALLY' },
  anual: { rotulo: 'Anual', por: 'por ano', ciclo: 'YEARLY' },
}

export const periodicidadeValida = (valor: unknown): valor is Periodicidade =>
  typeof valor === 'string' && Object.hasOwn(PERIODICIDADES, valor)

/** Um plano por serviço (os três serviços e o pacote). Sem valor definido, o preço fica "sob consulta" e sai na proposta. */
export type PlanoCatalogo = {
  servico: ServicoPosVenda
  nome: string
  descricao: string
  /** Se falso, o cliente não consegue solicitar este serviço. */
  disponivel: boolean
  valorCentavos: number | null
  periodicidade: Periodicidade
  /** Regra de cobrança: o primeiro vencimento sugerido é hoje + N dias. */
  diasAteVencimento: number
  /** Condições padrão que pré-preenchem a proposta. */
  termos: string
  /** Honorários de 20% previstos nas condições (só faz sentido com o jurídico). */
  honorarios20: boolean
}

export const CATALOGO_PADRAO: readonly PlanoCatalogo[] = SERVICOS_POS_VENDA.map(({ id, nome, descricao }) => ({
  servico: id, nome, descricao, disponivel: true, valorCentavos: null,
  periodicidade: 'mensal' as const, diasAteVencimento: 5, termos: '', honorarios20: false,
}))

const MAX_VALOR_CENTAVOS = 1_000_000_00

/**
 * Valida o catálogo vindo do banco ou do formulário e completa com o padrão o que faltar.
 * Devolve null se algum dado enviado for inválido.
 */
export function normalizarCatalogo(valor: unknown): PlanoCatalogo[] | null {
  if (!Array.isArray(valor)) return null
  const recebidos = new Map<string, Record<string, unknown>>()
  for (const bruto of valor) {
    if (!bruto || typeof bruto !== 'object') return null
    const item = bruto as Record<string, unknown>
    if (typeof item.servico !== 'string' || recebidos.has(item.servico)) return null
    recebidos.set(item.servico, item)
  }
  if ([...recebidos.keys()].some((id) => !SERVICOS_POS_VENDA.some((s) => s.id === id))) return null

  const plano: PlanoCatalogo[] = []
  for (const padrao of CATALOGO_PADRAO) {
    const e = recebidos.get(padrao.servico)
    if (!e) {
      plano.push({ ...padrao })
      continue
    }
    const nome = typeof e.nome === 'string' ? e.nome.trim() : ''
    const descricao = typeof e.descricao === 'string' ? e.descricao.trim() : ''
    const termos = typeof e.termos === 'string' ? e.termos.trim() : ''
    const centavos = e.valorCentavos === null || e.valorCentavos === undefined || e.valorCentavos === '' ? null : Number(e.valorCentavos)
    const dias = Number(e.diasAteVencimento)
    if (!nome || nome.length > 80 || descricao.length > 400 || termos.length > 8000) return null
    if (centavos !== null && (!Number.isSafeInteger(centavos) || centavos <= 0 || centavos > MAX_VALOR_CENTAVOS)) return null
    if (!periodicidadeValida(e.periodicidade)) return null
    if (!Number.isInteger(dias) || dias < 1 || dias > 60) return null
    plano.push({
      servico: padrao.servico, nome, descricao, disponivel: e.disponivel !== false, valorCentavos: centavos,
      periodicidade: e.periodicidade, diasAteVencimento: dias, termos,
      honorarios20: padrao.servico !== 'quitacao' && padrao.servico !== 'rastreamento' && e.honorarios20 === true,
    })
  }
  return plano
}

export const planoDoServico = (catalogo: readonly PlanoCatalogo[], servico: ServicoPosVenda) =>
  catalogo.find((p) => p.servico === servico)

/** Primeiro vencimento sugerido: `hoje` (AAAA-MM-DD) mais N dias. */
export function vencimentoSugerido(hoje: string, dias: number) {
  const data = new Date(`${hoje}T12:00:00Z`)
  data.setUTCDate(data.getUTCDate() + dias)
  return data.toISOString().slice(0, 10)
}

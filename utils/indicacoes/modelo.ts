/** Faixa de recompensa: vale da `de`-ésima indicação convertida até a `ate`-ésima (null = sem limite). */
export type FaixaRecompensa = { de: number; ate: number | null; valor: number }

export type ConfigIndicacoes = {
  faixas: FaixaRecompensa[]
  /** Dias, a partir do cadastro do indicado, para ele entrar na Área do Cliente e converter. 0 = sem prazo. */
  validadeIndicacaoDias: number
  /** O que fazer quando o indicado já tem cadastro no portal. */
  indicadoJaCadastrado: 'recusar' | 'revisao'
  /** Libera a recompensa para pagamento assim que a indicação converte. Do contrário, a equipe libera. */
  liberacaoAutomatica: boolean
}

export const CONFIG_PADRAO: ConfigIndicacoes = {
  faixas: [
    { de: 1, ate: 2, valor: 150 },
    { de: 3, ate: 5, valor: 200 },
    { de: 6, ate: null, valor: 250 },
  ],
  validadeIndicacaoDias: 90,
  indicadoJaCadastrado: 'revisao',
  liberacaoAutomatica: false,
}

export type StatusIndicacao = 'cadastrado' | 'convertida' | 'em_revisao' | 'recusada' | 'expirada'
export type StatusRecompensa = 'pendente' | 'liberada' | 'paga' | 'cancelada'

export const ROTULO_STATUS_INDICACAO: Record<StatusIndicacao, string> = {
  cadastrado: 'Aguardando o primeiro acesso',
  convertida: 'Convertida',
  em_revisao: 'Em revisão pela Liberty',
  recusada: 'Não aprovada',
  expirada: 'Prazo encerrado',
}

export const ROTULO_STATUS_RECOMPENSA: Record<StatusRecompensa, string> = {
  pendente: 'Aguardando liberação',
  liberada: 'Liberada para pagamento',
  paga: 'Paga',
  cancelada: 'Cancelada',
}

export type EventoAuditoria = { em: string; por: string; acao: string; detalhe?: string }

/** Valida a configuração vinda do banco ou do formulário. Devolve null se não for utilizável. */
export function normalizarConfig(valor: unknown): ConfigIndicacoes | null {
  if (!valor || typeof valor !== 'object') return null
  const c = valor as Record<string, unknown>
  if (!Array.isArray(c.faixas) || c.faixas.length === 0 || c.faixas.length > 10) return null

  const faixas: FaixaRecompensa[] = []
  let esperado = 1
  for (const [i, bruta] of c.faixas.entries()) {
    const f = (bruta ?? {}) as Record<string, unknown>
    const de = Number(f.de)
    const ate = f.ate === null || f.ate === '' || f.ate === undefined ? null : Number(f.ate)
    const valorFaixa = Number(f.valor)
    const ultima = i === c.faixas.length - 1
    // Faixas contíguas a partir da 1ª indicação; só a última fica sem limite (e ela precisa ficar).
    if (!Number.isInteger(de) || de !== esperado) return null
    if (ultima ? ate !== null : ate === null || !Number.isInteger(ate) || ate < de) return null
    if (!Number.isFinite(valorFaixa) || valorFaixa < 0 || valorFaixa > 100_000) return null
    faixas.push({ de, ate, valor: Math.round(valorFaixa * 100) / 100 })
    if (ate !== null) esperado = ate + 1
  }

  const validade = Number(c.validadeIndicacaoDias)
  if (!Number.isInteger(validade) || validade < 0 || validade > 3650) return null
  if (c.indicadoJaCadastrado !== 'recusar' && c.indicadoJaCadastrado !== 'revisao') return null

  return {
    faixas,
    validadeIndicacaoDias: validade,
    indicadoJaCadastrado: c.indicadoJaCadastrado,
    liberacaoAutomatica: c.liberacaoAutomatica === true,
  }
}

/** Valor da recompensa para a `ordem`-ésima indicação convertida do indicador (1, 2, 3...). */
export function valorRecompensa(faixas: readonly FaixaRecompensa[], ordem: number) {
  const faixa = faixas.find((f) => ordem >= f.de && (f.ate === null || ordem <= f.ate))
  return faixa ? { valor: faixa.valor, faixa } : null
}

export const gerarCodigoIndicacao = (aleatorio: (n: number) => number = (n) => Math.floor(Math.random() * n)) => {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => alfabeto[aleatorio(alfabeto.length)]).join('')
}

export const codigoIndicacaoValido = (codigo: unknown): codigo is string =>
  typeof codigo === 'string' && /^[A-HJ-NP-Z2-9]{8}$/.test(codigo)

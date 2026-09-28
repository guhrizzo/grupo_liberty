// ─── Contas fixas: regras de vencimento e status ─────────────────────────────
// Funções puras, usadas no servidor (leitura dos pagamentos) e no cliente
// (montagem da lista do mês).

import { deslocarMes, intervaloDoMes, type Mes } from '../periodo'
import type { ContaFixa, ContaFixaPendente, ContaFixaStatus, PagamentoContaFixa } from './types'

/**
 * ID do lançamento em `transacoes` que representa o pagamento de uma conta num
 * mês. Determinístico de propósito: gravado com `create()`, impede pagar a
 * mesma conta duas vezes no mesmo mês (clique duplo, duas abas abertas).
 */
export function idLancamentoContaFixa(contaId: string, mes: Mes): string {
  return `contafixa_${contaId}_${mes}`
}

/** `YYYY-MM-DD` do vencimento em `mes`, com o dia limitado ao último dia do mês. */
export function vencimentoNoMes(conta: Pick<ContaFixa, 'diaVencimento'>, mes: Mes): string {
  const ultimoDia = Number(intervaloDoMes(mes).fim.slice(8))
  const dia = Math.min(Math.max(conta.diaVencimento, 1), ultimoDia)
  return `${mes}-${String(dia).padStart(2, '0')}`
}

/**
 * A conta vence em `mes`? (sem olhar pagamento) — ativa, já cadastrada naquele
 * mês e, se anual, no mês do vencimento.
 */
export function contaVenceNoMes(conta: ContaFixa, mes: Mes): boolean {
  if (!conta.ativa || conta.mesInicio > mes) return false
  if (conta.periodicidade === 'mensal') return true
  return conta.mesVencimento === Number(mes.slice(5))
}

export function statusDaConta(vencimento: string, paga: boolean, hoje: string): ContaFixaStatus {
  if (paga) return 'paga'
  if (vencimento > hoje) return 'a_vencer'
  if (vencimento === hoje) return 'vence_hoje'
  return 'vencida'
}

export interface ItemContaDoMes {
  conta: ContaFixa
  vencimento: string
  status: ContaFixaStatus
  pagamento: PagamentoContaFixa | null
}

/**
 * Contas que entram na lista de `mes`: as que vencem nele e as que já foram
 * pagas nele (mesmo que depois tenham sido desativadas). Não pagas primeiro,
 * por vencimento; pagas por último.
 */
export function contasDoMes(
  contas: ContaFixa[],
  pagamentos: PagamentoContaFixa[],
  mes: Mes,
  hoje: string,
): ItemContaDoMes[] {
  const pagamentoPorConta = new Map(pagamentos.map((p) => [p.contaId, p]))

  return contas
    .filter((c) => pagamentoPorConta.has(c.id) || contaVenceNoMes(c, mes))
    .map((conta) => {
      const pagamento = pagamentoPorConta.get(conta.id) ?? null
      const vencimento = vencimentoNoMes(conta, mes)
      return { conta, vencimento, pagamento, status: statusDaConta(vencimento, !!pagamento, hoje) }
    })
    .sort((a, b) => {
      const pa = a.status === 'paga' ? 1 : 0
      const pb = b.status === 'paga' ? 1 : 0
      if (pa !== pb) return pa - pb
      return a.vencimento.localeCompare(b.vencimento) || a.conta.nome.localeCompare(b.conta.nome)
    })
}

/** Quantos meses para trás procurar contas não pagas. */
export const MESES_PENDENCIA = 24

/**
 * Competências em que a conta já venceu (vencimento antes de `hoje`) — candidatas
 * a pendência, sem olhar pagamento. Vai do mês de cadastro (limitado a
 * `MESES_PENDENCIA` meses atrás) até o mês de `hoje`.
 */
export function competenciasVencidas(conta: ContaFixa, hoje: string): Mes[] {
  const mesHoje = hoje.slice(0, 7)
  const limite = deslocarMes(mesHoje, -(MESES_PENDENCIA - 1))
  let mes = conta.mesInicio > limite ? conta.mesInicio : limite
  const meses: Mes[] = []
  while (mes <= mesHoje) {
    if (contaVenceNoMes(conta, mes) && vencimentoNoMes(conta, mes) < hoje) meses.push(mes)
    mes = deslocarMes(mes, 1)
  }
  return meses
}

/** Pendências por vencimento (mais antiga primeiro). */
export function ordenarPendencias(pendencias: ContaFixaPendente[]): ContaFixaPendente[] {
  return [...pendencias].sort(
    (a, b) => a.vencimento.localeCompare(b.vencimento) || a.conta.nome.localeCompare(b.conta.nome),
  )
}

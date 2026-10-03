import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess, isAdmSupremo } from '@/utils/permissions'
import { getTransacoes, getIntervaloDeMeses } from './actions'
import { ehMesValido, mesAtual } from './periodo'
import {
  getContasFixas,
  getContasFixasPendentes,
  getPagamentosContasFixas,
} from './contasFixas/actions'
import FinanceiroClient, { type AbaFinanceiro } from './FinanceiroClient'

export const metadata = {
  title: 'Financeiro | Liberty Car',
  description: 'Gestão financeira, faturamento e fluxo de caixa da Liberty Car.',
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[]; aba?: string | string[] }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'financeiro')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const { mes: mesParam, aba: abaParam } = await searchParams
  const mesBruto = Array.isArray(mesParam) ? mesParam[0] : mesParam
  const abaBruta = Array.isArray(abaParam) ? abaParam[0] : abaParam
  // Métricas mudaram para a Visão Geral; link antigo ?aba=metricas vai pra lá.
  if (abaBruta === 'metricas') redirect('/dashboard')
  const admSupremo = isAdmSupremo(user)
  const aba: AbaFinanceiro = abaBruta === 'contas-fixas' ? 'contas-fixas' : 'lancamentos'

  // Sem `?mes=` na URL o painel segue o mês corrente — é isso que faz a virada
  // automática da meia-noite do dia 1 funcionar, já que `mesAtual()` é
  // recalculado a cada render. Com `?mes=` o período fica fixo, e o cliente
  // não força a virada para não arrastar quem está revisando um mês fechado.
  const mesFixadoNaUrl = ehMesValido(mesBruto)
  const mes = mesFixadoNaUrl ? mesBruto : mesAtual()

  // Transações e intervalo sempre: o seletor de mês depende deles nas duas abas.
  const [transacoes, intervalo, contasFixas, pendenciasContasFixas] = await Promise.all([
    getTransacoes(mes),
    getIntervaloDeMeses(),
    aba === 'contas-fixas' ? getContasFixas() : Promise.resolve([]),
    getContasFixasPendentes(),
  ])
  const pagamentosContasFixas =
    aba === 'contas-fixas'
      ? await getPagamentosContasFixas(
          mes,
          contasFixas.map((c) => c.id),
        )
      : []

  return (
    <FinanceiroClient
      initialTransacoes={transacoes}
      mes={mes}
      mesFixadoNaUrl={mesFixadoNaUrl}
      primeiroMes={intervalo.primeiro}
      ultimoMes={intervalo.ultimo}
      aba={aba}
      contasFixas={contasFixas}
      pagamentosContasFixas={pagamentosContasFixas}
      pendenciasContasFixas={pendenciasContasFixas}
      podeVerResumo={admSupremo}
    />
  )
}

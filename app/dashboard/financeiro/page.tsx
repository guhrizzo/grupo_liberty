import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getTransacoes, getIntervaloDeMeses } from './actions'
import { ehMesValido, mesAtual } from './periodo'
import FinanceiroClient from './FinanceiroClient'

export const metadata = {
  title: 'Financeiro | Liberty Car',
  description: 'Gestão financeira, faturamento e fluxo de caixa da Liberty Car.',
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'financeiro', ['admin', 'vendedor', 'advogado'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  const { mes: mesParam } = await searchParams
  const mesBruto = Array.isArray(mesParam) ? mesParam[0] : mesParam

  // Sem `?mes=` na URL o painel segue o mês corrente — é isso que faz a virada
  // automática da meia-noite do dia 1 funcionar, já que `mesAtual()` é
  // recalculado a cada render. Com `?mes=` o período fica fixo, e o cliente
  // não força a virada para não arrastar quem está revisando um mês fechado.
  const mesFixadoNaUrl = ehMesValido(mesBruto)
  const mes = mesFixadoNaUrl ? mesBruto : mesAtual()

  const [transacoes, intervalo] = await Promise.all([
    getTransacoes(mes),
    getIntervaloDeMeses(),
  ])

  return (
    <FinanceiroClient
      initialTransacoes={transacoes}
      mes={mes}
      mesFixadoNaUrl={mesFixadoNaUrl}
      primeiroMes={intervalo.primeiro}
      ultimoMes={intervalo.ultimo}
    />
  )
}

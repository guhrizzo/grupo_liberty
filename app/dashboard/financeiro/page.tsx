import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import FinanceiroClient from './FinanceiroClient'

export const metadata = {
  title: 'Financeiro | Liberty Car',
  description: 'Gestão financeira, faturamento e fluxo de caixa da Liberty Car.',
}

export default async function FinanceiroPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'financeiro', ['admin', 'vendedor', 'advogado'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  return <FinanceiroClient />
}

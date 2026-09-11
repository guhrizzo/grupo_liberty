import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getAnalyticsOverview } from './data'
import AnalyticsView from './AnalyticsView'

export const metadata = {
  title: 'Visitantes | Liberty Car',
  description: 'Quantas pessoas acessam o site público e quais veículos são mais vistos.',
}

export default async function AnalyticsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'analytics', ['admin'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  const dados = await getAnalyticsOverview()

  return <AnalyticsView dados={dados} />
}

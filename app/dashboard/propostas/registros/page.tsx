import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getPropostasRegistradas } from './actions'
import PropostasRegistradasClient from './PropostasRegistradasClient'

export const metadata = {
  title: 'Propostas Registradas | Liberty Car',
  description: 'Propostas cadastradas manualmente pela equipe, com comissão do vendedor em destaque.',
}

export default async function PropostasRegistradasPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'propostas', ['admin', 'vendedor'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  const propostas = await getPropostasRegistradas()

  return <PropostasRegistradasClient propostas={propostas} />
}

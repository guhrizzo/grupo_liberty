import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getAnuncios } from './actions'
import AnunciosClient from './AnunciosClient'

export const metadata = {
  title: 'Anúncios de terceiros | Liberty Car',
  description: 'Triagem dos veículos anunciados por terceiros no site público.',
}

export default async function AnunciosDashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'anuncios', ['admin', 'vendedor'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  const anuncios = await getAnuncios()

  return <AnunciosClient anuncios={anuncios} />
}

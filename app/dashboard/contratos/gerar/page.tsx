import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import EscolherModeloClient from './EscolherModeloClient'

export const metadata = {
  title: 'Modelos de contrato | Liberty Car',
  description: 'Escolha o modelo de contrato, preencha os campos e gere o PDF.',
}

export default async function EscolherModeloPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'contratos')) {
    redirect('/dashboard?error=acesso_negado')
  }

  return <EscolherModeloClient />
}

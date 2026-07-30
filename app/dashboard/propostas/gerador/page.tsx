import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getPropostas } from '../actions'
import GeradorPropostaClient from './GeradorPropostaClient'

export const metadata = {
  title: 'Gerador de Proposta | Liberty Car',
  description:
    'Selecione uma proposta, ajuste o valor e as condições, e gere o PDF de autorização.',
}

export default async function GeradorPropostaPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'propostas', ['admin', 'vendedor'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  const propostas = await getPropostas()

  return <GeradorPropostaClient propostas={propostas} />
}

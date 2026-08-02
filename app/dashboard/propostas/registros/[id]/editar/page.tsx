import { notFound, redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getPropostaRegistradaById } from '../../actions'
import EditarPropostaClient from './EditarPropostaClient'

export const metadata = {
  title: 'Editar Proposta | Liberty Car',
  description: 'Altere os dados de uma proposta registrada pela equipe.',
}

export default async function EditarPropostaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'propostas', ['admin', 'vendedor'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  const { id } = await params
  const proposta = await getPropostaRegistradaById(id)
  if (!proposta) notFound()

  return <EditarPropostaClient proposta={proposta} />
}

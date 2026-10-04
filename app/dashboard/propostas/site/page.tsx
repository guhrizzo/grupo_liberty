import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getPropostas } from '../actions'
import { getManutencoesPorVeiculos } from '../../manutencao/actions'
import PropostasClient from '../PropostasClient'

export const metadata = {
  title: 'Propostas de veículos | Liberty Car',
  description: 'Propostas enviadas pelo site público para os veículos do estoque.',
}

export default async function PropostasSitePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'propostas')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const propostas = await getPropostas()
  const veiculoIds = Array.from(
    new Set(
      propostas
        .map((p) => p.veiculo_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  )
  const manutencoes = await getManutencoesPorVeiculos(veiculoIds)

  return <PropostasClient propostas={propostas} manutencoes={manutencoes} />
}

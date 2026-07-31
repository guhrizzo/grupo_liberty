import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getPropostas } from './actions'
import { getManutencoesPorVeiculos } from '../manutencao/actions'
import PropostasClient from './PropostasClient'

export const metadata = {
  title: 'Gerenciar Propostas | Liberty Car',
  description: 'Controle e responda propostas recebidas de clientes logados.',
}

export default async function PropostasDashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'propostas', ['admin', 'vendedor'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  const propostas = await getPropostas()
  const veiculoIds = Array.from(new Set(propostas.map((p) => p.veiculo_id).filter(Boolean)))
  const manutencoes = await getManutencoesPorVeiculos(veiculoIds)

  return <PropostasClient propostas={propostas} manutencoes={manutencoes} />
}

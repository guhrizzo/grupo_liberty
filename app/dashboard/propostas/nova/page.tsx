import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { listVeiculosForProposta } from '../actions'
import CadastrarPropostaClient from './CadastrarPropostaClient'

export const metadata = {
  title: 'Cadastrar Nova Proposta | Liberty Car',
  description: 'Cadastre manualmente uma nova proposta para um cliente e veículo.',
}

export default async function CadastrarPropostaPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'propostas', ['admin', 'vendedor'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  const veiculos = await listVeiculosForProposta()

  return <CadastrarPropostaClient veiculos={veiculos} />
}

import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getProcessos, getClientesPorVeiculo } from './actions'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import JuridicoClient from './JuridicoClient'

export const metadata = {
  title: 'Jurídico | Liberty Car',
  description: 'Gestão de processos e documentos jurídicos.',
}

export default async function JuridicoPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'juridico', ['admin', 'advogado'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  const [initialProcessos, veiculos, clientesPorVeiculo] = await Promise.all([
    getProcessos(),
    getVehicles(),
    getClientesPorVeiculo(),
  ])

  return (
    <JuridicoClient
      currentRole={user.role ?? ''}
      initialProcessos={initialProcessos}
      veiculos={veiculos}
      clientesPorVeiculo={clientesPorVeiculo}
    />
  )
}

import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getProcessos, getClientesPorVeiculo, getAnotacoesContagem } from './actions'
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

  const [initialProcessos, veiculos, clientesPorVeiculo, initialContagem] =
    await Promise.all([
      getProcessos(),
      getVehicles(),
      getClientesPorVeiculo(),
      getAnotacoesContagem(),
    ])

  return (
    <JuridicoClient
      currentRole={user.role ?? ''}
      currentUid={user.uid}
      initialProcessos={initialProcessos}
      veiculos={veiculos}
      clientesPorVeiculo={clientesPorVeiculo}
      initialContagem={initialContagem}
    />
  )
}

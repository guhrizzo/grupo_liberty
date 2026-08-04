import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getVehicles } from './actions'
import VeiculosClient from './VeiculosClient'

export const metadata = {
  title: 'Gerenciar Veículos | Liberty Car',
  description: 'Cadastre e gerencie veículos com fotos no painel administrativo.',
}

export default async function VeiculosPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'veiculos', ['admin', 'vendedor', 'advogado', 'suporte'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  const veiculos = await getVehicles()

  const clientUser = {
    id: user.uid,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
  }

  return <VeiculosClient currentUser={clientUser} veiculos={veiculos} />
}

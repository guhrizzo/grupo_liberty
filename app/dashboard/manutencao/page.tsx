import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import ManutencaoClient from './ManutencaoClient'

export const metadata = {
  title: 'Manutenção | Liberty Car',
  description: 'Controle de manutenções e serviços da frota.',
}

export default async function ManutencaoPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'manutencao', ['admin', 'vendedor', 'suporte'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  const veiculos = await getVehicles()

  return <ManutencaoClient veiculos={veiculos} />
}

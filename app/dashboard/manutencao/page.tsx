import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { listarVeiculos } from '@/utils/veiculos/listar'
import { getManutencoes } from './actions'
import ManutencaoClient from './ManutencaoClient'

export const metadata = {
  title: 'Manutenção | Liberty Car',
  description: 'Controle de manutenções e serviços da frota.',
}

export default async function ManutencaoPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'manutencao')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const [veiculos, initialManutencoes] = await Promise.all([
    listarVeiculos(),
    getManutencoes(),
  ])

  return (
    <ManutencaoClient
      veiculos={veiculos}
      initialManutencoes={initialManutencoes}
    />
  )
}

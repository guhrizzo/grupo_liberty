import { getCobrancas } from './actions'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import CobrancasClient from './CobrancasClient'
import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'

export const dynamic = 'force-dynamic'

export default async function CobrancasPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'cobrancas', ['admin', 'vendedor'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  const [cobrancas, veiculos] = await Promise.all([
    getCobrancas(),
    getVehicles(),
  ])

  return <CobrancasClient cobrancas={cobrancas} veiculos={veiculos} currentRole={user.role} />
}

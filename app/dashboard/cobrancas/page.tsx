import { getCobrancas, getCobrancasExcluidas } from './actions'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import CobrancasClient from './CobrancasClient'
import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'

export const dynamic = 'force-dynamic'

export default async function CobrancasPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string | string[] }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'cobrancas')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const { aba: abaParam } = await searchParams
  const abaBruta = Array.isArray(abaParam) ? abaParam[0] : abaParam
  const aba = abaBruta === 'clientes' ? 'clientes' : 'cobrancas'

  const [cobrancas, excluidas, veiculos] = await Promise.all([
    getCobrancas(),
    getCobrancasExcluidas(),
    getVehicles(),
  ])

  const currentUserName = user.name || user.email || 'Usuário'

  return (
    <CobrancasClient
      cobrancas={cobrancas}
      aba={aba}
      excluidas={excluidas}
      veiculos={veiculos}
      currentRole={user.role}
      canEdit={hasPageAccess(user, 'cobrancas')}
      currentUserName={currentUserName}
    />
  )
}

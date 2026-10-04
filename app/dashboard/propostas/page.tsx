import { redirect } from 'next/navigation'
import { adminDb } from '@/utils/firebase/admin'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getPropostasRegistradas } from './registros/actions'
import { getVendedoresMetas } from '@/app/dashboard/metas/actions'
import PropostasRegistradasClient from './registros/PropostasRegistradasClient'

export const metadata = {
  title: 'Propostas | Liberty Car',
  description: 'Propostas registradas pela equipe, com a comissão do vendedor em destaque.',
}

// A aba Propostas abre nos registros e comissões; as propostas enviadas pelo
// site público ficam em /dashboard/propostas/site ("Propostas de veículos").
export default async function PropostasPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'propostas')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const [propostas, vendedores, pendentesSite] = await Promise.all([
    getPropostasRegistradas(),
    getVendedoresMetas(),
    adminDb
      .collection('propostas')
      .where('status', '==', 'pendente')
      .get()
      .then((s) => s.size)
      .catch(() => 0),
  ])

  return (
    <PropostasRegistradasClient
      propostas={propostas}
      vendedores={vendedores}
      propostasSitePendentes={pendentesSite}
    />
  )
}

import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { listarSeguros } from './actions'
import SegurosClient from './SegurosClient'

export const metadata = {
  title: 'Seguro | Liberty Car',
  description: 'Controle do cancelamento do seguro e do reembolso, por veículo.',
}

export default async function SeguroPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // Mesmo acesso da aba Veículos.
  if (!hasPageAccess(user, 'veiculos')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const seguros = await listarSeguros()

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Seguro' }]} />

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Seguro</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Acompanhe o cancelamento do seguro de cada veículo: valor previsto de reembolso, situação e o valor
          realmente cancelado. O resumo também aparece na aba Veículos.
        </p>
      </div>

      <SegurosClient seguros={seguros} />
    </div>
  )
}

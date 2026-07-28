import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import PlacaFipeLookup from '@/app/components/PlacaFipeLookup'
import { Breadcrumb } from '@/app/components/ui'

export const dynamic = 'force-dynamic'

export default async function ConsultaFipePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'consulta_fipe', ['admin', 'vendedor', 'advogado', 'suporte'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Consulta FIPE' },
          ]}
        />
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950">
          Consulta de Veículo por Placa
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Consulte dados do veículo e a avaliação da Tabela FIPE utilizando a placa. Via{' '}
          <span className="font-semibold text-neutral-700">Sistema Puxa Placa</span>.
        </p>
      </div>

      <div className="py-4">
        <PlacaFipeLookup />
      </div>
    </div>
  )
}

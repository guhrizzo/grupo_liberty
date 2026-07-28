import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth } from '@/utils/firebase/admin'
import PlacaFipeLookup from '@/app/components/PlacaFipeLookup'
import { Breadcrumb } from '@/app/components/ui'

export const dynamic = 'force-dynamic'

const ROLES_PERMITIDOS = ['admin', 'vendedor']

export default async function ConsultaFipePage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) redirect('/login')

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true)
    const userRecord = await adminAuth.getUser(decoded.uid)
    const role = (userRecord.customClaims as any)?.role ?? ''

    if (!ROLES_PERMITIDOS.includes(role)) {
      redirect('/dashboard?error=acesso_negado')
    }
  } catch {
    redirect('/login')
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

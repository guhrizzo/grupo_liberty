import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import QrClient from './QrClient'

export const metadata = {
  title: 'QR do ponto | Liberty Car',
  description: 'Tela com o QR code rotativo para os funcionários baterem o ponto.',
}

export default async function QrPontoPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!hasPageAccess(user, 'ponto')) redirect('/dashboard?error=acesso_negado')

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Folha de ponto', href: '/dashboard/ponto' },
          { label: 'QR code' },
        ]}
      />

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">QR code do ponto</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Deixe esta tela aberta num tablet ou TV na empresa. O QR muda a cada 30 segundos.
        </p>
      </div>

      <QrClient />
    </div>
  )
}

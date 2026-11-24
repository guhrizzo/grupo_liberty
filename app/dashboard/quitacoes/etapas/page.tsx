import { redirect } from 'next/navigation'
import { getSessionUser } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { carregarEtapas } from '@/utils/quitacoes/etapas-config'
import EtapasClient from './EtapasClient'

export const metadata = {
  title: 'Etapas da quitação | Liberty Car',
  description: 'Configure as etapas exibidas no Acompanhe sua Quitação.',
}

export default async function EtapasQuitacaoPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/dashboard?error=acesso_negado')

  const etapas = await carregarEtapas()

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Quitações', href: '/dashboard/quitacoes' },
          { label: 'Etapas' },
        ]}
      />
      <EtapasClient etapasIniciais={etapas} />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import { getMetricasDoMes } from './actions'
import MetricasDiariasClient from './MetricasDiariasClient'

export const metadata = {
  title: 'Métricas diárias | Liberty Car',
  description: 'Números do dia de cada vendedor: leads, atendimentos, propostas e fechamentos.',
}

export default async function MetricasDiariasPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'metricas_diarias')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const hoje = hojeSaoPaulo()
  const inicial = await getMetricasDoMes(hoje.slice(0, 7))
  const veTodos = user.role === 'admin'

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Métricas diárias' }]} />

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Métricas diárias</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {veTodos
            ? 'Números do dia de cada vendedor e a média por dia no mês.'
            : 'Preencha seus números do dia. A média por dia do mês aparece logo abaixo.'}
        </p>
      </div>

      <MetricasDiariasClient
        hoje={hoje}
        inicial={inicial}
        usuarioUid={user.uid}
        veTodos={veTodos}
      />
    </div>
  )
}

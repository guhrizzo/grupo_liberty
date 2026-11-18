import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import { getFolhaMes } from './actions'
import FolhaClient from './FolhaClient'

export const metadata = {
  title: 'Folha de ponto | Liberty Car',
  description: 'Horas trabalhadas, batidas e saldo de cada funcionário no mês.',
}

export default async function FolhaPontoPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!hasPageAccess(user, 'ponto')) redirect('/dashboard?error=acesso_negado')

  const hoje = hojeSaoPaulo()
  const folha = await getFolhaMes(hoje.slice(0, 7), null)

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Folha de ponto' }]} />

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Folha de ponto</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Horas trabalhadas de cada funcionário no mês, com correção de batidas e jornada.
        </p>
      </div>

      <FolhaClient hoje={hoje} inicial={folha} />
    </div>
  )
}

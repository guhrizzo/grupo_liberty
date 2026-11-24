import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { carregarConfigIndicacoes, listarRecompensasAdmin, listarTodasIndicacoes } from '@/utils/indicacoes/servidor'
import IndicacoesClient from './IndicacoesClient'

export const metadata = {
  title: 'Indicações | Liberty Car',
  description: 'Regras de recompensa e revisão das indicações da Área do Cliente.',
}

export default async function IndicacoesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!hasPageAccess(user, 'indicacoes')) redirect('/dashboard?error=acesso_negado')

  const [config, indicacoes, recompensas] = await Promise.all([carregarConfigIndicacoes(), listarTodasIndicacoes(), listarRecompensasAdmin()])

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Indicações' }]} />
      <IndicacoesClient config={config} indicacoes={indicacoes} recompensas={recompensas} podeEditarRegras={user.role === 'admin'} />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { listarQuitacoes, listarVeiculosParaQuitacao } from './actions'
import QuitacoesClient from './QuitacoesClient'

export const metadata = {
  title: 'Quitações | Liberty Car',
  description: 'Histórico dos valores de quitação negociados com o banco, por veículo.',
}

export default async function QuitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ veiculo?: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // Mesmo acesso da aba Veículos.
  if (!hasPageAccess(user, 'veiculos')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const { veiculo } = await searchParams
  const [quitacoes, veiculos] = await Promise.all([listarQuitacoes(), listarVeiculosParaQuitacao()])

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Quitações' }]} />

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Quitações</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Valor de quitação negociado com o banco e a data, por veículo. Aqui fica todo o histórico; na aba Veículos
          aparece só a última.
        </p>
      </div>

      <QuitacoesClient quitacoes={quitacoes} veiculos={veiculos} veiculoInicial={veiculo ?? ''} />
    </div>
  )
}

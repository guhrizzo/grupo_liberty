import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { listarFichas, listarQuitacoes, listarVeiculosParaQuitacao } from './actions'
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
  const [quitacoes, veiculos, fichas] = await Promise.all([
    listarQuitacoes(),
    listarVeiculosParaQuitacao(),
    listarFichas(),
  ])

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Quitações' }]} />

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Quitações</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Uma linha por veículo: situação, último valor negociado e os dados do cliente para ligar ao banco. Clique no
          veículo para ver o histórico; na aba Veículos aparece só a última quitação.
        </p>
      </div>

      <QuitacoesClient quitacoes={quitacoes} veiculos={veiculos} fichas={fichas} veiculoInicial={veiculo ?? ''} />
    </div>
  )
}

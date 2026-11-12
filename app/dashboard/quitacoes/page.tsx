import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { listarAnexos, listarFichas, listarQuitacoes, listarVeiculosParaQuitacao } from './actions'
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
  const [quitacoes, veiculos, fichas, anexos] = await Promise.all([
    listarQuitacoes(),
    listarVeiculosParaQuitacao(),
    listarFichas(),
    listarAnexos(),
  ])

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Quitações' }]} />

      <QuitacoesClient quitacoes={quitacoes} veiculos={veiculos} fichas={fichas} anexos={anexos} veiculoInicial={veiculo ?? ''} />
    </div>
  )
}

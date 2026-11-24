import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { listarAnexos, listarFichas, listarQuitacoes, listarVeiculosParaQuitacao } from './actions'
import { carregarEtapas } from '@/utils/quitacoes/etapas-config'
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
  const [quitacoes, veiculos, fichas, anexos, etapas] = await Promise.all([
    listarQuitacoes(),
    listarVeiculosParaQuitacao(),
    listarFichas(),
    listarAnexos(),
    carregarEtapas(),
  ])

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Quitações' }]} />

      {user.role === 'admin' && (
        <Link href="/dashboard/quitacoes/etapas" className="inline-flex text-sm font-semibold text-liberty-deep hover:underline">
          Configurar etapas do Acompanhe sua Quitação
        </Link>
      )}

      <QuitacoesClient quitacoes={quitacoes} veiculos={veiculos} fichas={fichas} anexos={anexos} etapas={etapas} veiculoInicial={veiculo ?? ''} />
    </div>
  )
}

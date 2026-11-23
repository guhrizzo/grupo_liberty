import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { carregarInvestimentosInternos } from '@/utils/investimentos/repositorio'
import PainelInvestimentosInterno from './PainelInvestimentosInterno'

export default async function InvestimentosInternosPage() {
  const usuario = await getSessionUser()
  if (!usuario) redirect('/login')
  if (!hasPageAccess(usuario, 'investimentos')) redirect('/dashboard/demandas?error=acesso_negado')
  const dados = await carregarInvestimentosInternos()

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Investimentos Liberty</h1>
        <p className="mt-1 text-sm text-neutral-600">Gerencie as opções do catálogo e as posições dos clientes.</p>
      </header>
      <PainelInvestimentosInterno {...dados} />
    </main>
  )
}

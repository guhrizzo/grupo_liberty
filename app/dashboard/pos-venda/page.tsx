import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { carregarPosVendaInterno } from '@/utils/pos-venda/repositorio'
import { cobrancaPosVendaHabilitada } from '@/utils/pos-venda/cobranca'
import Link from 'next/link'
import { carregarCatalogo } from '@/utils/pos-venda/catalogo'
import PainelPosVendaInterno from './PainelPosVendaInterno'

export default async function PosVendaInternoPage() {
  const usuario = await getSessionUser()
  if (!usuario) redirect('/login')
  if (!hasPageAccess(usuario, 'pos_venda')) redirect('/dashboard/demandas?error=acesso_negado')
  const [dados, catalogo] = await Promise.all([carregarPosVendaInterno(), carregarCatalogo()])

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Pós-venda</h1>
        <p className="mt-1 text-sm text-neutral-600">Gerencie propostas, serviços contratados, mensalidades e atualizações para os clientes.</p>
        {usuario.role === 'admin' && (
          <Link href="/dashboard/pos-venda/catalogo" className="mt-2 inline-flex text-sm font-semibold text-liberty-deep hover:underline">Configurar preços e planos</Link>
        )}
      </header>
      <PainelPosVendaInterno dados={dados} catalogo={catalogo} habilitado={cobrancaPosVendaHabilitada()}
        podeFinanceiro={hasPageAccess(usuario, 'financeiro')} podeJuridico={hasPageAccess(usuario, 'juridico')}
        podeNegociar={hasPageAccess(usuario, 'veiculos')} podeRastrear={hasPageAccess(usuario, 'rastreamento')} />
    </main>
  )
}

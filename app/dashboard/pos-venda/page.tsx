import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { carregarPosVendaInterno } from '@/utils/pos-venda/repositorio'
import { cobrancaPosVendaHabilitada } from '@/utils/pos-venda/cobranca'
import PainelPosVendaInterno from './PainelPosVendaInterno'

export default async function PosVendaInternoPage() {
  const usuario = await getSessionUser()
  if (!usuario) redirect('/login')
  if (!hasPageAccess(usuario, 'pos_venda')) redirect('/dashboard/demandas?error=acesso_negado')
  const dados = await carregarPosVendaInterno()

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Pós-venda</h1>
        <p className="mt-1 text-sm text-neutral-600">Gerencie propostas, serviços contratados, mensalidades e atualizações para os clientes.</p>
      </header>
      <PainelPosVendaInterno dados={dados} habilitado={cobrancaPosVendaHabilitada()}
        podeFinanceiro={hasPageAccess(usuario, 'financeiro')} podeJuridico={hasPageAccess(usuario, 'juridico')}
        podeNegociar={hasPageAccess(usuario, 'veiculos')} podeRastrear={hasPageAccess(usuario, 'rastreamento')} />
    </main>
  )
}

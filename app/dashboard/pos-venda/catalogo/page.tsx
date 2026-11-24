import { redirect } from 'next/navigation'
import { getSessionUser } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { carregarCatalogo } from '@/utils/pos-venda/catalogo'
import CatalogoClient from './CatalogoClient'

export const metadata = {
  title: 'Preços e planos do Pós-venda | Liberty Car',
  description: 'Configure preços, periodicidade, disponibilidade e regras de cobrança dos serviços de pós-venda.',
}

export default async function CatalogoPosVendaPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/dashboard?error=acesso_negado')

  const catalogo = await carregarCatalogo()

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Pós-venda', href: '/dashboard/pos-venda' },
          { label: 'Preços e planos' },
        ]}
      />
      <CatalogoClient planosIniciais={catalogo} />
    </div>
  )
}

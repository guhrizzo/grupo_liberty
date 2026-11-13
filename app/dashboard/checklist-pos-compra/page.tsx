import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { listarFichas, listarVeiculosParaQuitacao } from '../quitacoes/actions'
import ChecklistPosCompraClient from './ChecklistPosCompraClient'

export const metadata = {
  title: 'Checklist pós-compra | Liberty Car',
  description: 'O que falta fazer em cada veículo depois da compra.',
}

export default async function ChecklistPosCompraPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // Mesmo acesso da aba Veículos / Quitações.
  if (!hasPageAccess(user, 'veiculos')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const [veiculos, fichas] = await Promise.all([listarVeiculosParaQuitacao(), listarFichas()])

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Checklist pós-compra' }]} />
      <ChecklistPosCompraClient veiculos={veiculos} fichas={fichas} />
    </div>
  )
}

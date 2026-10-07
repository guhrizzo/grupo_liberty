import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { listarEstoqueParaInteresses, listarInteresses } from './actions'
import InteressesClient from './InteressesClient'

export const metadata = {
  title: 'Interesses | Liberty Car',
  description: 'O que cada cliente procura, como uma encomenda, para oferecer quando o carro entrar.',
}

export default async function InteressesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'interesses')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const [interesses, estoque] = await Promise.all([listarInteresses(), listarEstoqueParaInteresses()])

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Interesses' }]} />

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Interesses</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Registre o carro que o cliente quer, como uma encomenda. Quando um veículo que combina entra no estoque,
          o painel avisa quem oferecer.
        </p>
      </div>

      <InteressesClient interesses={interesses} estoque={estoque} />
    </div>
  )
}

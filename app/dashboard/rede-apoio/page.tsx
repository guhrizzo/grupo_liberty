import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { getContatosApoio } from './actions'
import RedeApoioClient from './RedeApoioClient'

export const metadata = {
  title: 'Rede de apoio | Liberty Car',
  description: 'Pessoas de confiança por cidade para receber ou ver veículos fora da sede.',
}

export default async function RedeApoioPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'rede_apoio')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const contatos = await getContatosApoio()

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Rede de apoio' }]} />

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Rede de apoio</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Amigos, parceiros, conhecidos e mentorados por cidade, para receber ou ir ver um veículo onde não temos
          escritório.
        </p>
      </div>

      <RedeApoioClient initialContatos={contatos} />
    </div>
  )
}

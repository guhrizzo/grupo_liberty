import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess, isAdmSupremo } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { getProspeccoes } from '@/app/dashboard/juridico/prospeccao-actions'
import ProspeccaoSection from '@/app/dashboard/juridico/ProspeccaoSection'

export const metadata = {
  title: 'Leads | Liberty Car',
  description: 'Leads de clientes para contato e oferta pelo veículo.',
}

// Mesmos registros da sub-aba Prospecção do Jurídico (coleção
// juridico_prospeccao), para quem trabalha os contatos sem acesso ao Jurídico
// — por padrão, o cargo "vendedor externo".
export default async function LeadsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'leads')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const prospeccoes = await getProspeccoes()

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Leads' }]} />

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Leads</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Clientes com veículo financiado para contato por WhatsApp, e-mail e oferta.
        </p>
      </div>

      <ProspeccaoSection
        initialProspeccoes={prospeccoes}
        podeGerarProposta={hasPageAccess(user, 'propostas')}
        titulo="Lista de leads"
        usuarioUid={user.uid}
        podeExcluirVisitas={isAdmSupremo(user)}
      />
    </div>
  )
}

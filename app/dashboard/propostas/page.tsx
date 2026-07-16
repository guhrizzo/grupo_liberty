import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getPropostas } from './actions'
import PropostasClient from './PropostasClient'

export const metadata = {
  title: 'Gerenciar Propostas | Liberty Car',
  description: 'Controle e responda propostas recebidas de clientes logados.',
}

export default async function PropostasDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verificar se possui perfil autorizado (admin ou vendedor)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'vendedor'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const propostas = await getPropostas()

  return <PropostasClient propostas={propostas} />
}

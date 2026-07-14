import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getVehicles } from './actions'
import VeiculosClient from './VeiculosClient'

export const metadata = {
  title: 'Gerenciar Veículos | Liberty Car',
  description: 'Cadastre e gerencie veículos com fotos no painel administrativo.',
}

export default async function VeiculosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const veiculos = await getVehicles()

  return <VeiculosClient currentUser={user} veiculos={veiculos} />
}

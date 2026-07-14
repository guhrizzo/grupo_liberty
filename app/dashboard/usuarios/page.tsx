import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import UserManagementClient from './UserManagementClient'

export const metadata = {
  title: 'Gerenciar Usuários | Liberty Car',
  description: 'Área administrativa para cadastro de colaboradores.',
}

export default async function UsuariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <UserManagementClient currentUser={user} />
}

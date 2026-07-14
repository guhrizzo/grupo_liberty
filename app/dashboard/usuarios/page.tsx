import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import UserManagementClient from './UserManagementClient'

export default async function UsuariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (
    <UserManagementClient
      currentUser={user}
      currentUserRole={profile?.role ?? null}
    />
  )
}
import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import UserManagementClient from './UserManagementClient'

export default async function UsuariosPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'usuarios', ['admin'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  return (
    <UserManagementClient
      currentUser={{ id: user.uid, email: user.email }}
      currentUserRole={user.role}
    />
  )
}
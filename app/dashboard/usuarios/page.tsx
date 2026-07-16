import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import UserManagementClient from './UserManagementClient'

export default async function UsuariosPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) redirect('/login')

  let user: any = null
  let role = null

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true)
    user = {
      id: decoded.uid,
      email: decoded.email,
    }
    const profileDoc = await adminDb.collection('profiles').doc(user.id).get()
    role = profileDoc.data()?.role || null
  } catch (error) {
    redirect('/login')
  }

  return (
    <UserManagementClient
      currentUser={user}
      currentUserRole={role}
    />
  )
}
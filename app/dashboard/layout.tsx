import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { logout } from '@/app/login/actions'
import DashboardShell from '@/app/components/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) redirect('/login')

  let user: { uid: string; email: string | null | undefined } | null = null
  let role: string | null = null
  let displayName: string | null = null

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true)
    const profileDoc = await adminDb.collection('profiles').doc(decoded.uid).get()
    role = profileDoc.data()?.role || null
    displayName = ((decoded as unknown) as { name?: string; displayName?: string }).name
      || ((decoded as unknown) as { name?: string; displayName?: string }).displayName
      || null
    user = { uid: decoded.uid, email: decoded.email }
  } catch {
    redirect('/login')
  }

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      <DashboardShell
        email={user.email ?? ''}
        role={role}
        displayName={displayName}
        logoutAction={logout}
      />
      <main className="flex-1 min-w-0 px-4 py-8 md:px-8 md:pl-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  )
}

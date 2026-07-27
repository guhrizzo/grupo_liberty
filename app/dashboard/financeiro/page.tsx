import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import FinanceiroClient from './FinanceiroClient'

export const metadata = {
  title: 'Financeiro | Liberty Car',
  description: 'Gestão financeira, faturamento e fluxo de caixa da Liberty Car.',
}

export default async function FinanceiroPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) redirect('/login')

  let role: string | null = null
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true)
    const profileDoc = await adminDb.collection('profiles').doc(decoded.uid).get()
    role = profileDoc.data()?.role || null
  } catch {
    redirect('/login')
  }

  if (!role || !['admin', 'vendedor', 'advogado'].includes(role)) {
    redirect('/dashboard')
  }

  return <FinanceiroClient />
}

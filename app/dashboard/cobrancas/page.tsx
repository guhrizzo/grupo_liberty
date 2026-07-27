import { getCobrancas } from './actions'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import CobrancasClient from './CobrancasClient'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function CobrancasPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) redirect('/login')

  let role: string | null = null
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true)
    const profileDoc = await adminDb.collection('profiles').doc(decoded.uid).get()
    role = profileDoc.data()?.role ?? null
  } catch {
    redirect('/login')
  }

  const [cobrancas, veiculos] = await Promise.all([
    getCobrancas(),
    getVehicles(),
  ])

  return <CobrancasClient cobrancas={cobrancas} veiculos={veiculos} currentRole={role} />
}

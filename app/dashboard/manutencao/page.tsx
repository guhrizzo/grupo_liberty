import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import ManutencaoClient from './ManutencaoClient'

export const metadata = {
  title: 'Manutenção | Liberty Car',
  description: 'Controle de manutenções e serviços da frota.',
}

export default async function ManutencaoPage() {
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

  if (!role || !['admin', 'vendedor', 'suporte'].includes(role)) {
    redirect('/dashboard')
  }

  const veiculos = await getVehicles()

  return <ManutencaoClient veiculos={veiculos} />
}

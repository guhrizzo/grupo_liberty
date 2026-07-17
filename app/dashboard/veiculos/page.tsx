import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth } from '@/utils/firebase/admin'
import { getVehicles } from './actions'
import VeiculosClient from './VeiculosClient'

export const metadata = {
  title: 'Gerenciar Veículos | Liberty Car',
  description: 'Cadastre e gerencie veículos com fotos no painel administrativo.',
}

export default async function VeiculosPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) {
    redirect('/login')
  }

  let user: any = null

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true)
    user = {
      id: decoded.uid,
      email: decoded.email,
      role: (decoded as any).role ?? (decoded as any).admin ? 'admin' : undefined,
    }
  } catch (error) {
    redirect('/login')
  }

  const veiculos = await getVehicles()

  return <VeiculosClient currentUser={user} veiculos={veiculos} />
}

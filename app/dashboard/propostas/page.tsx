import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { getPropostas } from './actions'
import PropostasClient from './PropostasClient'

export const metadata = {
  title: 'Gerenciar Propostas | Liberty Car',
  description: 'Controle e responda propostas recebidas de clientes logados.',
}

export default async function PropostasDashboardPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) {
    redirect('/login')
  }

  let user: any = null
  let role = null

  try {
    user = await adminAuth.verifySessionCookie(session, true)
    const profileDoc = await adminDb.collection('profiles').doc(user.uid).get()
    role = profileDoc.data()?.role || null
  } catch (error) {
    redirect('/login')
  }

  if (!role || !['admin', 'vendedor'].includes(role)) {
    redirect('/dashboard')
  }

  const propostas = await getPropostas()

  return <PropostasClient propostas={propostas} />
}

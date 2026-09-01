import { redirect } from 'next/navigation'
import { getSessionUser, isOwner } from '@/utils/permissions'
import { getFeedback } from './actions'
import FeedbackClient from './FeedbackClient'

export const metadata = {
  title: 'Bugs & Melhorias | Liberty Car',
  description: 'Reporte bugs do sistema e sugira melhorias.',
}

export default async function FeedbackPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const itens = await getFeedback()

  return <FeedbackClient itens={itens} isOwner={isOwner(user)} />
}

import { redirect } from 'next/navigation'
import { getSessionUser, isAdmSupremo } from '@/utils/permissions'
import { hojeNoFuso } from '@/app/dashboard/financeiro/periodo'
import { getUsuariosAtribuiveis } from '@/app/dashboard/demandas/actions'
import { getCompromissos, getConexaoGoogle, getEventosGoogle } from './actions'
import AgendaClient from './AgendaClient'

export const metadata = {
  title: 'Agenda | Liberty Car',
  description: 'Compromissos da equipe, sincronizados com o Google Agenda.',
}

export default async function AgendaPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const admSupremo = isAdmSupremo(user)
  const [compromissos, eventosGoogle, conexao, usuarios] = await Promise.all([
    getCompromissos(),
    getEventosGoogle(),
    getConexaoGoogle(),
    admSupremo ? getUsuariosAtribuiveis() : Promise.resolve([]),
  ])

  return (
    <AgendaClient
      compromissos={compromissos}
      eventosGoogle={eventosGoogle}
      conexao={conexao}
      usuarios={usuarios}
      admSupremo={admSupremo}
      meuUid={user.uid}
      hoje={hojeNoFuso()}
    />
  )
}

import { redirect } from 'next/navigation'
import { getSessionUser, isAdmSupremo } from '@/utils/permissions'
import { hojeNoFuso } from '@/app/dashboard/financeiro/periodo'
import { getMinhasAnotacoes, getTarefas, getUsuariosAtribuiveis } from './actions'
import TarefasClient from './TarefasClient'

export const metadata = {
  title: 'Tarefas | Liberty Car',
  description: 'Tarefas atribuídas pela administração, com prazo e resposta.',
}

export default async function TarefasPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const admSupremo = isAdmSupremo(user)
  const [tarefas, usuarios, anotacoes] = await Promise.all([
    getTarefas(),
    admSupremo ? getUsuariosAtribuiveis() : Promise.resolve([]),
    getMinhasAnotacoes(),
  ])

  return (
    <TarefasClient
      tarefas={tarefas}
      usuarios={usuarios}
      admSupremo={admSupremo}
      meuUid={user.uid}
      hoje={hojeNoFuso()}
      anotacoes={anotacoes}
    />
  )
}

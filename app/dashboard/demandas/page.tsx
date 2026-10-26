import { redirect } from 'next/navigation'
import { getSessionUser, isAdmSupremo } from '@/utils/permissions'
import { ehCeo } from '@/constants/permissoes'
import { hojeNoFuso } from '@/app/dashboard/financeiro/periodo'
import { getMeusAfazeres, getTarefas, getUsuariosAtribuiveis } from './actions'
import TarefasClient from './TarefasClient'
import AbasDemandas from './AbasDemandas'
import LembretesClient from './lembretes/LembretesClient'
import { getLembretes } from './lembretes/actions'
import PendenciasClient from './pendencias/PendenciasClient'
import { getPendencias } from '@/utils/pendencias/listar'

export const metadata = {
  title: 'Tarefas | Liberty Car',
  description: 'Tarefas atribuídas pela administração, com prazo e resposta.',
}

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string | string[] }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { aba: abaParam } = await searchParams
  const abaRaw = Array.isArray(abaParam) ? abaParam[0] : abaParam
  const aba = abaRaw === 'lembretes' || abaRaw === 'pendencias' ? abaRaw : 'tarefas'

  if (aba === 'pendencias') {
    const pendencias = await getPendencias(user.role, user.permissions)
    return (
      <>
        <AbasDemandas ativa="pendencias" />
        <PendenciasClient pendencias={pendencias} />
      </>
    )
  }

  if (aba === 'lembretes') {
    const lembretes = await getLembretes()
    return (
      <>
        <AbasDemandas ativa="lembretes" />
        <LembretesClient lembretes={lembretes} ceo={ehCeo(user.email)} />
      </>
    )
  }

  const admSupremo = isAdmSupremo(user)
  const [tarefas, usuarios, afazeres] = await Promise.all([
    getTarefas(),
    admSupremo ? getUsuariosAtribuiveis() : Promise.resolve([]),
    getMeusAfazeres(),
  ])

  return (
    <>
      <AbasDemandas ativa="tarefas" />
      <TarefasClient
        tarefas={tarefas}
        usuarios={usuarios}
        admSupremo={admSupremo}
        meuUid={user.uid}
        hoje={hojeNoFuso()}
        afazeres={afazeres}
      />
    </>
  )
}

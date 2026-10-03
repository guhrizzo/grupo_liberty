import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess, isAdmSupremo } from '@/utils/permissions'
import { ehMesValido, mesAtual } from '@/app/dashboard/financeiro/periodo'
import { getVendedoresPropostas } from '@/app/dashboard/propostas/registros/actions'
import { getMetas } from './actions'
import MetasClient from './MetasClient'

export const metadata = {
  title: 'Metas | Liberty Car',
  description: 'Metas mensais de propostas fechadas por vendedor, com bônus.',
}

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const admSupremo = isAdmSupremo(user)
  if (!admSupremo && !hasPageAccess(user, 'propostas')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const { mes: mesParam } = await searchParams
  const mesBruto = Array.isArray(mesParam) ? mesParam[0] : mesParam
  const mes = ehMesValido(mesBruto) ? mesBruto : mesAtual()

  const [metas, vendedores] = await Promise.all([
    getMetas(mes),
    admSupremo ? getVendedoresPropostas() : Promise.resolve([]),
  ])

  return (
    <MetasClient
      metas={metas}
      vendedores={vendedores}
      admSupremo={admSupremo}
      mes={mes}
      mesAtual={mesAtual()}
    />
  )
}

import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { listarNegativacoesAsaas } from '@/app/dashboard/cobrancas/negativacao-actions'
import NegativacoesClient from './NegativacoesClient'

export const dynamic = 'force-dynamic'

export default async function NegativacoesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!hasPageAccess(user, 'cobrancas')) redirect('/dashboard?error=acesso_negado')

  const linhas = await listarNegativacoesAsaas()
  return <NegativacoesClient linhas={linhas} podeNegativar={user.role === 'admin'} />
}

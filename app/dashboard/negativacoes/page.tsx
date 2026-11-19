import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import {
  listarNegativacoesAsaas,
  listarParcelasAtrasadasSemAsaas,
} from '@/app/dashboard/cobrancas/negativacao-actions'
import NegativacoesClient from './NegativacoesClient'

export const dynamic = 'force-dynamic'

export default async function NegativacoesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!hasPageAccess(user, 'cobrancas')) redirect('/dashboard?error=acesso_negado')

  const [linhas, atrasadas] = await Promise.all([
    listarNegativacoesAsaas(),
    listarParcelasAtrasadasSemAsaas(),
  ])
  return (
    <NegativacoesClient linhas={linhas} atrasadas={atrasadas} podeNegativar={user.role === 'admin'} />
  )
}

import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getProspeccao } from '@/app/dashboard/juridico/prospeccao-actions'
import { prospeccaoParaProposta } from '@/app/dashboard/juridico/prospeccao-proposta'
import CadastrarPropostaClient from './CadastrarPropostaClient'

export const metadata = {
  title: 'Cadastrar Nova Proposta | Liberty Car',
  description: 'Cadastre manualmente uma nova proposta para um cliente e veículo.',
}

export default async function CadastrarPropostaPage({
  searchParams,
}: {
  searchParams: Promise<{ prospeccao?: string | string[] }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'propostas')) {
    redirect('/dashboard?error=acesso_negado')
  }

  // Vindo da aba Jurídico → Prospecção: pré-preenche com os dados da linha.
  const { prospeccao: prospeccaoParam } = await searchParams
  const prospeccaoId = Array.isArray(prospeccaoParam) ? prospeccaoParam[0] : prospeccaoParam
  const prospeccao = prospeccaoId ? await getProspeccao(prospeccaoId) : null

  return (
    <CadastrarPropostaClient
      prefill={
        prospeccao
          ? { origem: prospeccao.nomeExecutado, dados: prospeccaoParaProposta(prospeccao) }
          : undefined
      }
    />
  )
}

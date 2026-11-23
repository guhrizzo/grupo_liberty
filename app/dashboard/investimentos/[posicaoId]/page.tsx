import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { idInvestimentoValido } from '@/utils/investimentos/modelo'
import { carregarExtratoInterno } from '@/utils/investimentos/repositorio'
import { formatDate } from '@/utils/format'
import { formatarDocumento } from '@/utils/portal/documento'
import { ExtratoInvestimento, ResumoInvestimento } from '@/app/components/investimentos/ResumoInvestimento'
import { FormEstorno, FormMovimento } from './FormMovimento'

export default async function InvestimentoInternoDetalhe({ params }: { params: Promise<{ posicaoId: string }> }) {
  const usuario = await getSessionUser()
  if (!usuario) redirect('/login')
  if (!hasPageAccess(usuario, 'investimentos')) notFound()
  const { posicaoId } = await params
  if (!idInvestimentoValido(posicaoId)) notFound()
  const posicao = await carregarExtratoInterno(posicaoId)
  if (!posicao) notFound()

  return (
    <main className="space-y-6">
      <Link href="/dashboard/investimentos" className="text-sm font-semibold text-liberty-deep hover:underline">Voltar aos investimentos</Link>
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">{posicao.opcaoNome}</h1>
        <p className="mt-2 text-sm text-neutral-600">{posicao.nomeCliente} · {formatarDocumento(posicao.documento)}</p>
        <p className="mt-1 text-sm text-neutral-600">{posicao.referencia} · {posicao.situacao === 'ativa' ? 'Ativa' : 'Encerrada'} · Data-base {formatDate(posicao.dataBase)}</p>
      </header>
      <ResumoInvestimento totais={posicao.totais} />
      <FormMovimento id={posicao.id} dataBase={posicao.dataBase} situacao={posicao.situacao} saldo={posicao.totais.saldo} />
      <ExtratoInvestimento movimentos={posicao.movimentos} acoes={(item) =>
        posicao.situacao === 'ativa' && item.tipo !== 'estorno' && !item.estornado
          ? <FormEstorno id={posicao.id} movimentoId={item.id} />
          : null
      } />
    </main>
  )
}

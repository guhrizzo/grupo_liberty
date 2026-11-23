import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconArrowLeft } from '@tabler/icons-react'
import { ExtratoInvestimento, ResumoInvestimento } from '@/app/components/investimentos/ResumoInvestimento'
import { idInvestimentoValido } from '@/utils/investimentos/modelo'
import { carregarExtratoCliente } from '@/utils/investimentos/repositorio'
import { formatDate } from '@/utils/format'

export default async function InvestimentoClienteDetalhe({ params }: { params: Promise<{ posicaoId: string }> }) {
  const { posicaoId } = await params
  if (!idInvestimentoValido(posicaoId)) notFound()
  const extrato = await carregarExtratoCliente(posicaoId)
  if (!extrato) notFound()

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-5 py-9 sm:px-8 sm:py-14">
      <Link href="/area-do-cliente/investimentos" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--portal-link)] hover:underline">
        <IconArrowLeft aria-hidden size={17} /> Voltar aos investimentos
      </Link>
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{extrato.opcaoNome}</h1>
        <p className="mt-1 text-sm text-[var(--portal-secundario)]">{extrato.referencia} · {extrato.situacao === 'ativa' ? 'Ativa' : 'Encerrada'}</p>
        <p className="mt-2 text-sm text-[var(--portal-secundario)]">Aberta em {formatDate(extrato.abertura)} · Data-base {formatDate(extrato.dataBase)}</p>
      </header>
      <ResumoInvestimento totais={extrato.totais} />
      <ExtratoInvestimento movimentos={extrato.movimentos} />
      {extrato.opcaoRegistrada && (
        <details className="rounded-xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)] p-5">
          <summary className="cursor-pointer font-semibold">Condições registradas na abertura</summary>
          <dl className="mt-3 space-y-2 text-sm">
            {([
              ['Categoria', extrato.opcaoRegistrada.categoria], ['Prazo', extrato.opcaoRegistrada.prazo],
              ['Liquidez', extrato.opcaoRegistrada.liquidez], ['Riscos', extrato.opcaoRegistrada.riscos],
              ['Condições', extrato.opcaoRegistrada.condicoes],
            ] as const).map(([rotulo, valor]) => (
              <div key={rotulo}><dt className="font-semibold">{rotulo}</dt><dd className="whitespace-pre-wrap break-words text-[var(--portal-secundario)]">{valor}</dd></div>
            ))}
          </dl>
        </details>
      )}
    </main>
  )
}

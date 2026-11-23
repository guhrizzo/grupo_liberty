import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconArrowLeft } from '@tabler/icons-react'
import { clienteComPosVenda } from '@/utils/pos-venda/repositorio'
import { rastreamentoPosVenda } from '@/utils/pos-venda/servicos'
import { idPosVendaValido } from '@/utils/pos-venda/modelo'
import HistoricoPosVenda from '@/app/components/rastreamento/HistoricoPosVenda'

export default async function RastreamentoClientePage({ params }: { params: Promise<{ contratoId: string }> }) {
  const cliente = await clienteComPosVenda()
  const { contratoId } = await params
  if (!cliente || !idPosVendaValido(contratoId)) notFound()
  const rastreio = await rastreamentoPosVenda(contratoId, cliente.documento)
  if (!rastreio) notFound()

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-5 py-9 sm:px-8 sm:py-14">
      <Link href="/area-do-cliente/pos-venda" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--portal-link)] hover:underline">
        <IconArrowLeft aria-hidden size={17} /> Voltar ao pós-venda
      </Link>
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Rastreamento</h1>
        <p className="mt-2 text-[var(--portal-secundario)]">{rastreio.veiculo}</p>
      </header>
      <HistoricoPosVenda posicoes={rastreio.posicoes} />
    </main>
  )
}

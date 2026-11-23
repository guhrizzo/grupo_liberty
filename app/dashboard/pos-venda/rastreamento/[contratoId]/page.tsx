import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { contratosPosVenda } from '@/utils/pos-venda/repositorio'
import { rastreamentoPosVenda } from '@/utils/pos-venda/servicos'
import { idPosVendaValido, type ContratoPosVenda } from '@/utils/pos-venda/modelo'
import HistoricoPosVenda from '@/app/components/rastreamento/HistoricoPosVenda'
import styles from '@/app/area-do-cliente/entrar/entrada.module.css'

export default async function RastreamentoPosVendaInterno({ params }: { params: Promise<{ contratoId: string }> }) {
  const usuario = await getSessionUser()
  if (!usuario) redirect('/login')
  if (!hasPageAccess(usuario, 'pos_venda') || !hasPageAccess(usuario, 'rastreamento')) notFound()

  const { contratoId } = await params
  if (!idPosVendaValido(contratoId)) notFound()
  const contrato = (await contratosPosVenda().doc(contratoId).get()).data() as ContratoPosVenda | undefined
  if (!contrato) notFound()
  const rastreamento = await rastreamentoPosVenda(contratoId, contrato.documento)
  if (!rastreamento) notFound()

  return (
    <main className="space-y-5">
      <Link href="/dashboard/pos-venda" className="text-sm text-liberty-deep hover:underline">Voltar ao pós-venda</Link>
      <div>
        <h1 className="text-3xl font-bold">Rastreamento autorizado</h1>
        <p className="mt-1 text-sm text-neutral-600">{rastreamento.veiculo}</p>
      </div>
      <div className={`${styles.paleta} ${styles.posVendaInterno}`} data-tema="light">
        <HistoricoPosVenda posicoes={rastreamento.posicoes} />
      </div>
    </main>
  )
}

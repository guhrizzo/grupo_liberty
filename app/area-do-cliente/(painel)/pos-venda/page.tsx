import { notFound } from 'next/navigation'
import { carregarPosVendaCliente, clienteComPosVenda } from '@/utils/pos-venda/repositorio'
import { acompanharServicosAtivos } from '@/utils/pos-venda/servicos'
import { servicosInclusos } from '@/utils/pos-venda/modelo'
import PainelPosVendaCliente from './PainelPosVendaCliente'

export default async function PosVendaClientePage() {
  const cliente = await clienteComPosVenda()
  if (!cliente) notFound()
  const { veiculos, contratos } = await carregarPosVendaCliente(cliente)
  const acompanhamentos = Object.fromEntries(await Promise.all(veiculos.flatMap((veiculo) => {
    const ativos = contratos.filter((contrato) => contrato.veiculoId === veiculo.id && contrato.situacao === 'ativo' &&
      servicosInclusos(contrato.servico).some((servico) => servico === 'juridico' || servico === 'quitacao'))
    if (!ativos.length) return []
    return [acompanharServicosAtivos(cliente.documento, veiculo.id, veiculo.vinculo, ativos).then((retorno) => [veiculo.id, retorno] as const)]
  })))

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-5 py-9 sm:px-8 sm:py-14">
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Pós-venda Liberty</h1>
        <p className="mt-2 text-[var(--portal-secundario)]">Consulte serviços, propostas e mensalidades dos veículos que você comprou da Liberty.</p>
      </header>
      <PainelPosVendaCliente veiculos={veiculos.map(({ id, nome, placa }) => ({ id, nome, placa }))} contratos={contratos} acompanhamentos={acompanhamentos} />
    </main>
  )
}

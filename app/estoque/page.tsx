import PublicHeader from '@/app/components/PublicHeader'
import PublicVehiclesList from '@/app/PublicVehiclesList'
import PublicSoldVehiclesList from '@/app/PublicSoldVehiclesList'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import { toPublicVeiculo, vendidoVisivel } from '@/app/dashboard/veiculos/public'

export const metadata = {
  title: 'Estoque de veículos | Liberty Car',
  description: 'Encontre veículos novos e seminovos disponíveis na Liberty Car.',
}

export default async function EstoquePage() {
  const estoque = await getVehicles()
  const veiculos = estoque.filter((v) => v.publico === true && !v.vendidoEm).map(toPublicVeiculo)
  const vendidos = estoque.filter((v) => vendidoVisivel(v.vendidoRegistradoEm ?? v.vendidoEm)).map(toPublicVeiculo)

  return (
    <>
      <PublicHeader />
      <main className="mx-auto w-full max-w-7xl space-y-14 px-4 py-10 md:px-8 md:py-16">
        <section aria-labelledby="titulo-estoque" className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-5 adobe-dark:border-adobe-line">
            <h1 id="titulo-estoque" className="text-3xl font-black tracking-tight text-neutral-900 sm:text-4xl adobe-dark:text-adobe-text-hi">Estoque de veículos</h1>
            <p className="text-sm text-neutral-600 adobe-dark:text-adobe-text-md">{veiculos.length} {veiculos.length === 1 ? 'veículo disponível' : 'veículos disponíveis'}</p>
          </div>
          <PublicVehiclesList veiculos={veiculos} />
        </section>
        {vendidos.length > 0 && (
          <section id="vendidos" aria-labelledby="titulo-vendidos" className="space-y-6">
            <h2 id="titulo-vendidos" className="border-b border-neutral-200 pb-4 text-2xl font-bold text-neutral-900 adobe-dark:border-adobe-line adobe-dark:text-adobe-text-hi">Vendidos recentemente</h2>
            <PublicSoldVehiclesList veiculos={vendidos} />
          </section>
        )}
      </main>
    </>
  )
}

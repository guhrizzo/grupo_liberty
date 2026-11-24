import { IconArrowDown, IconMapPin, IconShieldCheck } from '@tabler/icons-react'
import PublicVehiclesList from '@/app/PublicVehiclesList'
import PublicSoldVehiclesList from '@/app/PublicSoldVehiclesList'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import { toPublicVeiculo, vendidoVisivel } from '@/app/dashboard/veiculos/public'
import MidiaHero from './MidiaHero'
import ServicosLiberty from './ServicosLiberty'
import styles from './HeroLiberty.module.css'

export const metadata = {
  title: 'Liberty Car | Encontre seu Veículo Ideal',
  description: 'Confira o estoque de veículos novos e seminovos da Liberty Car em Jaú e Bauru.',
}

export default async function HomePage() {
  const estoque = await getVehicles()
  const veiculos = estoque.filter((v) => v.publico === true && !v.vendidoEm).map(toPublicVeiculo)
  const vendidos = estoque.filter((v) => vendidoVisivel(v.vendidoRegistradoEm ?? v.vendidoEm)).map(toPublicVeiculo)

  return (
    <main className="flex flex-col overflow-x-clip">
      <section className={styles.hero} aria-labelledby="titulo-home">
        <div className={styles.interior}>
          <div className={styles.conteudo}>
            <p className={styles.categoria}>Novos e seminovos</p>
            <h1 id="titulo-home">Seu próximo carro <span>está na Liberty.</span></h1>
            <p className={styles.descricao}>Explore nosso estoque de veículos vistoriados e encontre a opção certa para você.</p>
            <div className={styles.acoes}>
              <a href="#pos-venda" className={styles.primario}>
                Conhecer serviços <IconArrowDown aria-hidden size={19} />
              </a>
            </div>
            <ul className={styles.detalhes}>
              <li><IconShieldCheck aria-hidden size={19} /> Veículos vistoriados</li>
              <li><IconMapPin aria-hidden size={19} /> Jaú e Bauru, SP</li>
            </ul>
          </div>

          <MidiaHero />

          <nav aria-label="Mais sobre a Liberty" className={styles.atalhos}>
            <a href="https://libertycar.net.br" target="_blank" rel="noopener noreferrer">Sobre a Liberty</a>
          </nav>
        </div>
      </section>

      <section id="veiculos" aria-labelledby="titulo-veiculos" className="mx-auto w-full max-w-7xl scroll-mt-24 space-y-6 px-4 py-10 md:px-8 md:py-16">
        <h2 id="titulo-veiculos" className="text-3xl font-black tracking-tight text-neutral-900 sm:text-4xl adobe-dark:text-adobe-text-hi">
          Estoque de veículos
        </h2>
        <PublicVehiclesList veiculos={veiculos} />
      </section>

      {vendidos.length > 0 && (
        <section id="vendidos" aria-labelledby="titulo-vendidos" className="mx-auto w-full max-w-7xl scroll-mt-24 space-y-6 px-4 pb-10 md:px-8 md:pb-16">
          <h2 id="titulo-vendidos" className="border-b border-neutral-200 pb-4 text-2xl font-bold text-neutral-900 adobe-dark:border-adobe-line adobe-dark:text-adobe-text-hi">
            Vendidos recentemente
          </h2>
          <PublicSoldVehiclesList veiculos={vendidos} />
        </section>
      )}

      <ServicosLiberty />
    </main>
  )
}

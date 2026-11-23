import Link from 'next/link'
import { IconArrowDown, IconArrowRight, IconMapPin, IconShieldCheck } from '@tabler/icons-react'
import MidiaHero from './MidiaHero'
import ServicosLiberty from './ServicosLiberty'
import styles from './HeroLiberty.module.css'

export const metadata = {
  title: 'Liberty Car | Encontre seu Veículo Ideal',
  description: 'Confira o estoque de veículos da Liberty Car e conheça os serviços de quitação, pós-venda e investimentos.',
}

export default function HomePage() {
  return (
    <main className="flex flex-col overflow-x-clip">
      <section className={styles.hero} aria-labelledby="titulo-home">
        <div className={styles.interior}>
          <div className={styles.conteudo}>
            <p className={styles.categoria}>Novos e seminovos</p>
            <h1 id="titulo-home">Seu próximo carro <span>está na Liberty.</span></h1>
            <p className={styles.descricao}>Explore nosso estoque de veículos vistoriados e encontre a opção certa para você.</p>
            <div className={styles.acoes}>
              <Link href="/estoque" className={styles.primario}>
                Explorar estoque <IconArrowRight aria-hidden size={19} />
              </Link>
              <Link href="/anuncie-seu-veiculo" className={styles.secundario}>Anuncie seu veículo</Link>
            </div>
            <ul className={styles.detalhes}>
              <li><IconShieldCheck aria-hidden size={19} /> Veículos vistoriados</li>
              <li><IconMapPin aria-hidden size={19} /> Jaú e Bauru, SP</li>
            </ul>
          </div>

          <MidiaHero />

          <nav aria-label="Mais sobre a Liberty" className={styles.atalhos}>
            <a href="#servicos">Conheça nossos serviços <IconArrowDown aria-hidden size={16} /></a>
            <a href="https://libertycar.net.br" target="_blank" rel="noopener noreferrer">Sobre a Liberty</a>
          </nav>
        </div>
      </section>

      <ServicosLiberty />
    </main>
  )
}

import Link from 'next/link'
import { IconArrowUpRight, IconBuildingBank, IconChecks, IconFileDescription, IconLifebuoy, IconMapPin, IconPackage, IconScale, IconWallet } from '@tabler/icons-react'
import { SERVICOS_POS_VENDA } from '@/utils/pos-venda/modelo'
import RolagemServicos from './RolagemServicos'
import styles from './ServicosLiberty.module.css'

const bloco = 'relative w-full scroll-mt-24 overflow-hidden'
const conteudo = 'mx-auto w-full max-w-7xl px-4 py-16 md:px-8 md:py-24'
const icone = 'grid size-11 shrink-0 place-items-center rounded-xl bg-liberty/10 text-liberty-deep adobe-dark:text-adobe-accent-soft'
const titulo = 'mt-5 max-w-[15ch] text-4xl font-bold leading-[1.06] tracking-tight text-balance sm:text-5xl lg:text-6xl'
const descricao = 'mt-3 max-w-xl leading-relaxed text-neutral-600 adobe-dark:text-adobe-text-md'
const link = 'mt-7 inline-flex min-h-12 items-center gap-3 rounded-full bg-liberty-deep px-5 py-2 text-sm font-bold text-white hover:bg-[#005680] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-liberty-deep adobe-dark:bg-adobe-accent adobe-dark:text-adobe-bg-0 adobe-dark:hover:bg-adobe-accent-soft'
const iconesPlano = { juridico: IconScale, rastreamento: IconMapPin, pacote: IconPackage }
const planosVisiveis = SERVICOS_POS_VENDA.filter((servico): servico is Exclude<(typeof SERVICOS_POS_VENDA)[number], { id: 'quitacao' }> => servico.id !== 'quitacao')

export default function ServicosLiberty() {
  return (
    <section id="servicos" tabIndex={-1} aria-label="Serviços Liberty" className="w-full scroll-mt-24 text-neutral-950 outline-none adobe-dark:text-adobe-text-hi">
      <RolagemServicos>
        <section id="pos-venda" tabIndex={-1} data-servico-scroll aria-labelledby="tit-pos-venda" className={`${bloco} ${styles.posVenda}`}>
          <div className={conteudo}>
            <span className={icone}><IconLifebuoy aria-hidden size={24} /></span>
            <h3 id="tit-pos-venda" className={titulo}>Pós-venda e planos</h3>
            <p className={descricao}>Comprou seu veículo com a Liberty? Conheça os serviços disponíveis individualmente ou juntos em um pacote completo.</p>
            <ul data-planos-scroll className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {planosVisiveis.map(({ id, nome, descricao: detalhe }) => {
                const Icone = iconesPlano[id]
                return (
                  <li key={id} data-plano-scroll className={id === 'pacote' ? `${styles.plano} ${styles.pacote}` : styles.plano}>
                    <Icone aria-hidden size={26} stroke={1.7} />
                    <h4>{nome}</h4>
                    <p>{detalhe}</p>
                  </li>
                )
              })}
            </ul>
            <Link href="/area-do-cliente/entrar?destino=pos-venda" className={link}>Consultar serviços e planos <IconArrowUpRight aria-hidden size={17} /></Link>
          </div>
        </section>

        <section id="investimentos" tabIndex={-1} data-servico-scroll aria-labelledby="tit-investimentos" className={`${bloco} ${styles.investimentos}`}>
          <div className={`${conteudo} grid items-center gap-10 lg:grid-cols-2 lg:gap-16`}>
            <div>
              <span className={styles.iconeInvestimento}><IconBuildingBank aria-hidden size={24} /></span>
              <h3 id="tit-investimentos" className={titulo}>Investimentos Liberty</h3>
              <p className="mt-3 max-w-xl leading-relaxed text-slate-300">Consulte as opções publicadas e acompanhe os investimentos vinculados à sua conta, com saldos e histórico de movimentações.</p>
              <Link href="/area-do-cliente/entrar?destino=investimentos" className={styles.linkInvestimento}>Acessar investimentos <IconArrowUpRight aria-hidden size={17} /></Link>
            </div>
            <ul className={styles.painelInvestimentos}>
              {[{ Icone: IconFileDescription, texto: 'Opções, condições e prazos' }, { Icone: IconWallet, texto: 'Saldos dos seus investimentos' }, { Icone: IconChecks, texto: 'Extrato de movimentações' }].map(({ Icone, texto }) => (
                <li key={texto} data-servico-detalhe>
                  <Icone aria-hidden size={21} />{texto}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </RolagemServicos>
    </section>
  )
}

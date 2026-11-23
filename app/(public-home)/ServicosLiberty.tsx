import Link from 'next/link'
import { IconArrowDownRight, IconArrowUpRight, IconBuildingBank, IconChecks, IconCircleCheck, IconFileDescription, IconLifebuoy, IconMapPin, IconPackage, IconReceipt, IconScale, IconWallet } from '@tabler/icons-react'
import { SERVICOS_POS_VENDA } from '@/utils/pos-venda/modelo'
import RolagemServicos from './RolagemServicos'
import styles from './ServicosLiberty.module.css'

const bloco = 'relative w-full scroll-mt-24 overflow-hidden'
const conteudo = 'mx-auto w-full max-w-7xl px-4 py-16 md:px-8 md:py-24'
const icone = 'grid size-11 shrink-0 place-items-center rounded-xl bg-liberty/10 text-liberty-deep adobe-dark:text-adobe-accent-soft'
const titulo = 'mt-5 max-w-[15ch] text-4xl font-bold leading-[1.06] tracking-tight text-balance sm:text-5xl lg:text-6xl'
const descricao = 'mt-3 max-w-xl leading-relaxed text-neutral-600 adobe-dark:text-adobe-text-md'
const link = 'mt-7 inline-flex min-h-12 items-center gap-3 rounded-full bg-liberty-deep px-5 py-2 text-sm font-bold text-white hover:bg-[#005680] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-liberty-deep adobe-dark:bg-adobe-accent adobe-dark:text-adobe-bg-0 adobe-dark:hover:bg-adobe-accent-soft'
const iconesPlano = { juridico: IconScale, quitacao: IconReceipt, rastreamento: IconMapPin, pacote: IconPackage }

export default function ServicosLiberty() {
  return (
    <section id="servicos" tabIndex={-1} aria-labelledby="tit-servicos" className="w-full scroll-mt-24 text-neutral-950 outline-none adobe-dark:text-adobe-text-hi">
      <div className={styles.intro}>
        <div className="mx-auto grid w-full max-w-7xl items-center gap-4 px-4 py-6 md:px-8 lg:grid-cols-[1fr_auto] lg:gap-8">
          <div>
            <h2 id="tit-servicos" className="text-2xl font-bold tracking-tight sm:text-3xl">Serviços Liberty</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">Acompanhe suas operações e conheça os serviços para o seu veículo.</p>
          </div>
          <nav aria-label="Seções de serviços" className="flex flex-wrap gap-1.5 sm:gap-2">
            {[['quitacao', 'Quitação'], ['pos-venda', 'Pós-venda e planos'], ['investimentos', 'Investimentos']].map(([id, nome]) => (
              <a key={id} href={`#${id}`} className={styles.atalho}>
                {nome}<IconArrowDownRight aria-hidden size={15} />
              </a>
            ))}
          </nav>
        </div>
      </div>

      <RolagemServicos>
        <section id="quitacao" tabIndex={-1} data-servico-scroll aria-labelledby="tit-quitacao" className={`${bloco} ${styles.quitacao}`}>
          <div className={`${conteudo} grid items-center gap-10 lg:grid-cols-2 lg:gap-16`}>
            <div>
              <span className={icone}><IconReceipt aria-hidden size={24} /></span>
              <h3 id="tit-quitacao" className={titulo}>Acompanhamento de quitação</h3>
              <p className={descricao}>Vendeu seu veículo para a Liberty? Confira o andamento da quitação, a última atualização e os documentos disponibilizados na Área do Cliente.</p>
              <Link href="/area-do-cliente/entrar?destino=quitacao" className={link}>Acompanhar minha quitação <IconArrowUpRight aria-hidden size={17} /></Link>
            </div>
            <div className={styles.visualQuitacao}>
              <div className={styles.foto} data-servico-visual aria-hidden />
              <ol aria-label="Etapas da quitação" className={styles.etapas}>
                {['Recebimento do veículo', 'Análise de documentos', 'Negociação com o banco', 'Quitação e finalização'].map((etapa) => (
                  <li key={etapa} data-servico-detalhe>
                    <IconCircleCheck aria-hidden size={19} />{etapa}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="pos-venda" tabIndex={-1} data-servico-scroll aria-labelledby="tit-pos-venda" className={`${bloco} ${styles.posVenda}`}>
          <div className={conteudo}>
            <span className={icone}><IconLifebuoy aria-hidden size={24} /></span>
            <h3 id="tit-pos-venda" className={titulo}>Pós-venda e planos</h3>
            <p className={descricao}>Comprou seu veículo com a Liberty? Conheça os serviços disponíveis individualmente ou juntos em um pacote completo.</p>
            <ul data-planos-scroll className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICOS_POS_VENDA.map(({ id, nome, descricao: detalhe }) => {
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

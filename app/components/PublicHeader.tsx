import Link from 'next/link'
import Image from 'next/image'
import { IconArrowRight, IconSpeakerphone } from '@tabler/icons-react'
import LOGO_LIBERTY from '@/app/public/logo-liberty-car-blue.png'
import LOGO_LIBERTY_CLARO from '@/app/public/logo-liberty-car-white.png'
import BotaoTemaPublico from './BotaoTemaPublico'
import styles from './PublicHeader.module.css'

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-neutral-200">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-3 px-4 py-3 md:px-8">
        <Link href="/" className="flex flex-col leading-none min-w-0 shrink" aria-label="Liberty Car">
          <Image src={LOGO_LIBERTY} alt="Liberty Car" priority className="h-auto w-[94px] sm:w-[116px] adobe-dark:hidden" />
          <Image
            src={LOGO_LIBERTY_CLARO}
            alt="Liberty Car"
            priority
            className="hidden h-auto w-[94px] sm:w-[116px] adobe-dark:block"
          />
          <span className="hidden sm:block text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-500 mt-1.5 whitespace-nowrap">
            Seminovos &amp; Novos
          </span>
        </Link>

        <nav aria-label="Ações do site" className={styles.acoes}>
          <BotaoTemaPublico className={styles.tema} />
          <Link href="/anuncie-seu-veiculo" className={styles.secundario} aria-label="Anuncie seu veículo">
            <IconSpeakerphone aria-hidden size={17} stroke={2} />
            <span className="hidden sm:inline">Anuncie seu veículo</span>
            <span className="sm:hidden">Anuncie</span>
          </Link>
          <Link href="/entrar" className={styles.primario}>
            Entrar
            <IconArrowRight aria-hidden size={17} stroke={2} />
          </Link>
        </nav>
      </div>
    </header>
  )
}

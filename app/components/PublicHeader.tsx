import Link from 'next/link'
import { IconCar, IconArrowRight, IconUser, IconSpeakerphone } from '@tabler/icons-react'
import { Button } from './ui'

interface PublicHeaderProps {
  /** Usuário logado (só o e-mail é usado aqui) ou `null`. */
  user: { email?: string | null } | null
  /**
   * `home` mostra o e-mail do usuário ao lado e o rótulo "Entrar no Painel".
   * `inner` (páginas de veículo) é mais enxuto: só "Entrar".
   */
  variant?: 'home' | 'inner'
}

/**
 * Cabeçalho do site público — compartilhado pela home (`/`) e pelas páginas de
 * veículo (`/veiculos/[id]`). Antes existia duplicado e levemente divergente em
 * cada página.
 */
export default function PublicHeader({ user, variant = 'home' }: PublicHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-neutral-200">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-3 px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 group min-w-0 shrink">
          <div className="relative h-9 w-9 shrink-0 rounded-lg grid place-items-center liberty-glow bg-liberty/10">
            <IconCar size={20} className="text-liberty" stroke={2.2} />
          </div>
          <div className="flex flex-col leading-none min-w-0">
            <span className="text-lg font-black tracking-tighter text-neutral-900 whitespace-nowrap">
              LIBERTY<span className="text-liberty">CAR</span>
            </span>
            <span className="hidden sm:block text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-500 mt-0.5 whitespace-nowrap">
              Seminovos &amp; Novos
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link href="/anuncie-seu-veiculo">
            <Button variant="secondary" size="sm" leftIcon={<IconSpeakerphone size={14} stroke={2.5} />}>
              <span className="hidden sm:inline">Anuncie seu veículo</span>
              <span className="sm:hidden">Anuncie</span>
            </Button>
          </Link>

          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {variant === 'home' && (
                <span className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-neutral-600 max-w-[220px] truncate">
                  <IconUser size={14} className="text-liberty shrink-0" />
                  <span className="truncate">{user.email}</span>
                </span>
              )}
              <Link href="/dashboard">
                <Button variant="liberty" size="sm" rightIcon={<IconArrowRight size={14} stroke={2.5} />}>
                  Dashboard
                </Button>
              </Link>
            </div>
          ) : (
            <Link href="/login">
              <Button variant="secondary" size="sm" rightIcon={<IconArrowRight size={14} stroke={2.5} />}>
                <span className="hidden sm:inline">{variant === 'home' ? 'Entrar no Painel' : 'Entrar'}</span>
                <span className="sm:hidden">Entrar</span>
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

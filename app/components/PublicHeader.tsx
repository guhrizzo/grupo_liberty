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
      <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative h-9 w-9 rounded-lg grid place-items-center liberty-glow bg-liberty/10">
            <IconCar size={20} className="text-liberty" stroke={2.2} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-lg font-black tracking-tighter text-neutral-900">
              LIBERTY<span className="text-liberty">CAR</span>
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-500 mt-0.5">
              Seminovos &amp; Novos
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-3">
          <Link href="/anuncie-seu-veiculo">
            <Button variant="secondary" size="sm" leftIcon={<IconSpeakerphone size={14} stroke={2.5} />}>
              Anuncie seu veículo
            </Button>
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              {variant === 'home' && (
                <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
                  <IconUser size={14} className="text-liberty" />
                  {user.email}
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
                {variant === 'home' ? 'Entrar no Painel' : 'Entrar'}
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconHome,
  IconCar,
  IconMail,
  IconScale,
  IconTool,
  IconUsers,
  IconMenu2,
} from '@tabler/icons-react'
import LoadingBar from '../components/LoadingBar'

interface DashboardNavbarProps {
  email: string
  role: string | null
  displayName: string | null
  logoutAction: () => Promise<void>
}

type NavItem = {
  href: string
  label: string
  icon: string
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Visão Geral',
    icon: 'home',
    roles: ['admin', 'vendedor', 'advogado', 'suporte'],
  },
  {
    href: '/dashboard/veiculos',
    label: 'Veículos',
    icon: 'car',
    roles: ['admin', 'vendedor', 'advogado', 'suporte'],
  },
  {
    href: '/dashboard/propostas',
    label: 'Propostas',
    icon: 'mail',
    roles: ['admin', 'vendedor'],
  },
  {
    href: '/dashboard/juridico',
    label: 'Jurídico',
    icon: 'scales',
    roles: ['admin', 'advogado'],
  },
  {
    href: '/dashboard/manutencao',
    label: 'Manutenção',
    icon: 'wrench',
    roles: ['admin', 'vendedor', 'suporte'],
  },
  {
    href: '/dashboard/usuarios',
    label: 'Usuários',
    icon: 'users',
    roles: ['admin'],
  },
]

function Icon({ name }: { name: string }) {
  const cls = 'h-5 w-5'
  switch (name) {
    case 'home':
      return <IconHome className={cls} stroke={2} />
    case 'car':
      return <IconCar className={cls} stroke={2} />
    case 'mail':
      return <IconMail className={cls} stroke={2} />
    case 'scales':
      return <IconScale className={cls} stroke={2} />
    case 'wrench':
      return <IconTool className={cls} stroke={2} />
    case 'users':
      return <IconUsers className={cls} stroke={2} />
    default:
      return null
  }
}

export default function DashboardNavbar({ email, role, displayName, logoutAction }: DashboardNavbarProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [isLoggingOut, startLogout] = useTransition()

  const allowedItems = NAV_ITEMS.filter((item) => !role || item.roles.includes(role))

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(href)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="md:hidden fixed top-3 left-3 z-50 inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white p-2 shadow-xs cursor-pointer"
        aria-label="Abrir menu"
      >
        <IconMenu2 size={20} stroke={2} />
      </button>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-neutral-950/40"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static z-40 inset-y-0 left-0 w-64 bg-white border-r border-neutral-200 flex flex-col transform transition-transform md:transform-none ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="px-6 py-6 border-b border-neutral-200">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <span className="text-lg font-black tracking-tighter text-neutral-950">LIBERTY CAR</span>
          </Link>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
            Painel Interno
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {allowedItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-neutral-200 p-4">
          <div className="mb-3">
            <p className="text-xs font-semibold text-neutral-900 truncate">
              {displayName || email}
            </p>
            <p className="text-[11px] text-neutral-500 truncate">{email}</p>
            <span className="mt-2 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
              {role || 'Sem perfil'}
            </span>
          </div>
          <form
            action={() => {
              startLogout(async () => {
                await logoutAction()
              })
            }}
          >
            <button
              type="submit"
              disabled={isLoggingOut}
              className="w-full rounded-lg border border-neutral-200 hover:bg-neutral-100 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              {isLoggingOut ? 'Saindo...' : 'Sair da conta'}
            </button>
            {isLoggingOut && <LoadingBar className="h-0.5 mt-2" />}
          </form>
        </div>
      </aside>
    </>
  )
}

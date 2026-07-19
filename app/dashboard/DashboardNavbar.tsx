'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5Z" />
        </svg>
      )
    case 'car':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm18 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM3 13l2-6h14l2 6M3 13v4h18v-4M3 13h18" />
        </svg>
      )
    case 'mail':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      )
    case 'scales':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18M5 21h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0L6 8Zm12 0-3 6a3 3 0 0 0 6 0l-3-6Z" />
        </svg>
      )
    case 'wrench':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-2.6 2.4-2.4Z" />
        </svg>
      )
    case 'users':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    default:
      return null
  }
}

export default function DashboardNavbar({ email, role, displayName, logoutAction }: DashboardNavbarProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
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
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-lg border border-neutral-200 hover:bg-neutral-100 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer"
            >
              Sair da conta
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}

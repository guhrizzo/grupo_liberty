'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconHome,
  IconCar,
  IconMail,
  IconScale,
  IconTool,
  IconUsers,
  IconFileText,
  IconMenu2,
  IconBolt,
  IconLogout,
} from '@tabler/icons-react'
import LoadingBar from './LoadingBar'
import { ConfirmDialog, useToast } from './ui'

type NavItem = {
  href: string
  label: string
  icon: 'home' | 'car' | 'mail' | 'scales' | 'file-text' | 'wrench' | 'users'
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
    href: '/dashboard/contratos',
    label: 'Contratos',
    icon: 'file-text',
    roles: ['admin', 'advogado', 'vendedor'],
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

function NavIcon({ name }: { name: NavItem['icon'] }) {
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
    case 'file-text':
      return <IconFileText className={cls} stroke={2} />
    case 'wrench':
      return <IconTool className={cls} stroke={2} />
    case 'users':
      return <IconUsers className={cls} stroke={2} />
  }
}

function initialsFor(name: string | null | undefined, email: string) {
  const source = (name && name.trim()) || email
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  advogado: 'Advogado',
  suporte: 'Suporte',
}

interface DashboardShellProps {
  email: string
  role: string | null
  displayName: string | null
  logoutAction: () => Promise<void>
}

export default function DashboardShell({
  email,
  role,
  displayName,
  logoutAction,
}: DashboardShellProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [isLoggingOut, startLogout] = useTransition()
  const toast = useToast()
  const drawerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const allowedItems = NAV_ITEMS.filter((item) => !role || item.roles.includes(role))

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(href)

  // Fechar drawer com ESC e travar scroll quando aberto (mobile).
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Fecha drawer ao trocar de rota.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  function handleLogout() {
    startLogout(async () => {
      try {
        await logoutAction()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao sair'
        toast.error(msg, 'Não foi possível sair')
      }
    })
  }

  const initials = initialsFor(displayName, email)
  const roleLabel = role ? ROLE_LABEL[role] ?? role : 'Sem perfil'

  const SidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-neutral-200 flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-lg grid place-items-center bg-liberty/10 text-liberty-deep shrink-0">
          <IconBolt size={20} stroke={2.2} />
        </div>
        <div className="flex flex-col leading-none min-w-0">
          <span className="text-lg font-black tracking-tighter text-neutral-950 truncate">
            LIBERTY CAR
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-neutral-400 mt-0.5">
            Painel Interno
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-4"
        aria-label="Navegação principal"
      >
        <ul className="space-y-0.5">
          {allowedItems.map((item) => {
            const active = isActive(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? 'bg-neutral-950 text-white shadow-xs'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                  }`}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r-full bg-liberty"
                    />
                  )}
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User */}
      <div className="border-t border-neutral-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="relative h-10 w-10 rounded-full bg-liberty/10 text-liberty-deep flex items-center justify-center font-bold text-sm shrink-0"
            aria-hidden
          >
            {initials}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-liberty border-2 border-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-900 truncate">
              {displayName || email}
            </p>
            <p className="text-[11px] text-neutral-500 truncate">{email}</p>
            <span className="mt-1.5 inline-block rounded-full bg-liberty/10 text-liberty-deep border border-liberty/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              {roleLabel}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          disabled={isLoggingOut}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 hover:bg-neutral-100 hover:border-neutral-300 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
        >
          <IconLogout size={14} stroke={2} />
          {isLoggingOut ? 'Saindo...' : 'Sair da conta'}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="md:hidden fixed top-3 left-3 z-50 inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white p-2 shadow-xs cursor-pointer hover:bg-neutral-50"
        aria-label={open ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={open}
        aria-controls="dashboard-sidebar"
      >
        <IconMenu2 size={20} stroke={2} />
      </button>

      {/* Sidebar (mobile = drawer; desktop = coluna fixa) */}
      <aside
        id="dashboard-sidebar"
        ref={drawerRef}
        className={`fixed md:static z-40 inset-y-0 left-0 w-64 bg-white border-r border-neutral-200 flex flex-col transform transition-transform duration-200 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Menu lateral"
      >
        {SidebarContent}
      </aside>

      {/* Backdrop mobile */}
      {open && (
        <div
          onClick={() => {
            setOpen(false)
            triggerRef.current?.focus()
          }}
          className="md:hidden fixed inset-0 z-30 bg-neutral-950/40 backdrop-blur-[2px] animate-fade-in"
          aria-hidden
        />
      )}

      {/* Logout confirm */}
      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
        title="Sair da conta?"
        description="Você precisará fazer login novamente para acessar o painel."
        confirmLabel="Sair"
        cancelLabel="Cancelar"
        tone="danger"
        loading={isLoggingOut}
      />

      {isLoggingOut && <LoadingBar className="h-0.5 fixed top-0 left-0 right-0 z-[100]" />}
    </>
  )
}

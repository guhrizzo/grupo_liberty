import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import {
  IconUsers,
  IconCar,
  IconMail,
  IconScale,
  IconTool,
  IconFileText,
  IconCurrencyDollar,
  IconArrowRight,
  type Icon,
} from '@tabler/icons-react'
import { adminAuth, adminDb } from '@/utils/firebase/admin'

export const metadata: Metadata = {
  title: 'Dashboard | Liberty Car',
}

type ModuleCard = {
  href: string
  titulo: string
  descricao: string
  icon: Icon
  badge: string
  allowed: string[]
}

const MODULES: ModuleCard[] = [
  {
    href: '/dashboard/usuarios',
    titulo: 'Gerenciar Usuários',
    descricao: 'Cadastre novas contas de administradores, vendedores, advogados ou equipe de suporte.',
    icon: IconUsers,
    badge: 'Admin',
    allowed: ['admin'],
  },
  {
    href: '/dashboard/veiculos',
    titulo: 'Gerenciar Veículos',
    descricao: 'Cadastre veículos com fotos, gerencie o estoque e controle as informações da frota.',
    icon: IconCar,
    badge: 'Admin',
    allowed: ['admin'],
  },
  {
    href: '/dashboard/propostas',
    titulo: 'Gerenciar Propostas',
    descricao: 'Visualize e responda as mensagens de interesse e propostas de compra enviadas por clientes.',
    icon: IconMail,
    badge: 'Vendas',
    allowed: ['admin', 'vendedor'],
  },
  {
    href: '/dashboard/contratos',
    titulo: 'Gerenciar Contratos',
    descricao: 'Emissão e acompanhamento de contratos de compra e venda de veículos.',
    icon: IconFileText,
    badge: 'Vendas',
    allowed: ['admin', 'advogado', 'vendedor'],
  },
  {
    href: '/dashboard/financeiro',
    titulo: 'Gestão Financeira',
    descricao: 'Acompanhe faturamento, comissões, recebíveis e balanço financeiro das negociações.',
    icon: IconCurrencyDollar,
    badge: 'Financeiro',
    allowed: ['admin', 'vendedor', 'advogado'],
  },
  {
    href: '/dashboard/juridico',
    titulo: 'Módulo Jurídico',
    descricao: 'Acompanhe processos, contratos e prazos do departamento jurídico da Liberty Car.',
    icon: IconScale,
    badge: 'Jurídico',
    allowed: ['admin', 'advogado'],
  },
  {
    href: '/dashboard/manutencao',
    titulo: 'Manutenção da Frota',
    descricao: 'Ordens de serviço, agendamentos, oficinas e histórico de manutenções dos veículos.',
    icon: IconTool,
    badge: 'Operações',
    allowed: ['admin', 'vendedor', 'suporte'],
  },
]

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) return null

  let user: { uid: string; email?: string | null } | null = null
  let role: string | null = null

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true)
    user = { uid: decoded.uid, email: decoded.email ?? null }
    const profileDoc = await adminDb.collection('profiles').doc(user.uid).get()
    role = profileDoc.data()?.role || null
  } catch {
    return null
  }

  const visibleModules = MODULES.filter((m) => !role || m.allowed.includes(role))

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-neutral-200 bg-linear-to-br from-white to-liberty/5 p-6 shadow-xs adobe-dark:border-adobe-line adobe-dark:from-adobe-bg-2 adobe-dark:to-adobe-bg-2 adobe-dark:bg-adobe-bg-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-liberty-deep adobe-dark:text-adobe-accent-soft">
              Boas-vindas
            </p>
            <h2 className="mt-1 text-2xl font-black text-neutral-950 adobe-dark:text-adobe-text-hi">{user.email ?? ''}</h2>
            <p className="mt-1 text-sm text-neutral-500 adobe-dark:text-adobe-text-lo">
              Acesse as ferramentas e módulos do sistema autorizados para seu perfil.
            </p>
          </div>

          <div className="self-start sm:self-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-liberty/10 text-liberty-deep border border-liberty/30 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider adobe-dark:bg-adobe-accent/15 adobe-dark:text-adobe-accent-soft adobe-dark:border-adobe-accent/30">
              <span className="h-1.5 w-1.5 rounded-full bg-liberty adobe-dark:bg-adobe-accent" />
              Perfil: {role || 'Não definido'}
            </span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4 adobe-dark:text-adobe-text-lo">
          Módulos Disponíveis
        </h3>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibleModules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group rounded-xl border border-neutral-200 bg-white p-6 shadow-xs flex flex-col justify-between hover:border-liberty/40 hover:shadow-lg hover:shadow-liberty/5 hover:-translate-y-1 transition-[box-shadow,border-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:hover:border-adobe-accent/40 adobe-dark:hover:shadow-adobe-accent-glow"
            >
              <div>
                <div className="h-11 w-11 rounded-lg bg-liberty/10 text-liberty-deep flex items-center justify-center mb-4 group-hover:bg-liberty group-hover:text-white transition-[background-color,color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] adobe-dark:bg-adobe-accent/15 adobe-dark:text-adobe-accent-soft adobe-dark:group-hover:bg-adobe-accent adobe-dark:group-hover:text-[#0a1720]">
                  <m.icon size={22} stroke={1.75} />
                </div>
                <h4 className="text-lg font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">{m.titulo}</h4>
                <p className="text-sm text-neutral-500 mt-1.5 leading-relaxed adobe-dark:text-adobe-text-lo">{m.descricao}</p>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600 adobe-dark:bg-adobe-bg-3 adobe-dark:text-adobe-text-md">
                  {m.badge}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-liberty-deep group-hover:gap-2 transition-[gap,color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] adobe-dark:text-adobe-accent-soft">
                  Acessar
                  <IconArrowRight size={14} stroke={2.5} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

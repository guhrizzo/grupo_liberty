import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'

export const metadata: Metadata = {
  title: 'Dashboard | Liberty Car',
}

type ModuleCard = {
  href: string
  titulo: string
  descricao: string
  emoji: string
  badge: string
  allowed: string[]
}

const MODULES: ModuleCard[] = [
  {
    href: '/dashboard/usuarios',
    titulo: 'Gerenciar Usuários',
    descricao: 'Cadastre novas contas de administradores, vendedores, advogados ou equipe de suporte.',
    emoji: '👥',
    badge: 'Admin',
    allowed: ['admin'],
  },
  {
    href: '/dashboard/veiculos',
    titulo: 'Gerenciar Veículos',
    descricao: 'Cadastre veículos com fotos, gerencie o estoque e controle as informações da frota.',
    emoji: '🚗',
    badge: 'Admin',
    allowed: ['admin'],
  },
  {
    href: '/dashboard/propostas',
    titulo: 'Gerenciar Propostas',
    descricao: 'Visualize e responda as mensagens de interesse e propostas de compra enviadas por clientes.',
    emoji: '📩',
    badge: 'Vendas',
    allowed: ['admin', 'vendedor'],
  },
  {
    href: '/dashboard/juridico',
    titulo: 'Módulo Jurídico',
    descricao: 'Acompanhe processos, contratos e prazos do departamento jurídico da Liberty Car.',
    emoji: '⚖️',
    badge: 'Jurídico',
    allowed: ['admin', 'advogado'],
  },
  {
    href: '/dashboard/manutencao',
    titulo: 'Manutenção da Frota',
    descricao: 'Ordens de serviço, agendamentos, oficinas e histórico de manutenções dos veículos.',
    emoji: '🛠️',
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
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Boas-vindas</p>
            <h2 className="text-xl font-bold text-neutral-900 mt-1">{user.email ?? ''}</h2>
            <p className="text-sm text-neutral-500 mt-1">
              Acesse as ferramentas e módulos do sistema autorizados para seu perfil.
            </p>
          </div>

          <div className="self-start sm:self-center">
            <span className="rounded-full bg-neutral-900 text-white px-3.5 py-1 text-xs font-semibold uppercase tracking-wider">
              Perfil: {role || 'Não definido'}
            </span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
          Módulos Disponíveis
        </h3>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibleModules.map((m) => (
            <div
              key={m.href}
              className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center text-xl mb-4">
                  {m.emoji}
                </div>
                <h4 className="text-lg font-bold text-neutral-900">{m.titulo}</h4>
                <p className="text-sm text-neutral-500 mt-1">{m.descricao}</p>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  {m.badge}
                </span>
                <Link
                  href={m.href}
                  className="inline-block rounded-lg bg-neutral-950 hover:bg-neutral-850 text-white text-sm font-medium px-4 py-2 transition-colors"
                >
                  Acessar Painel
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { logout } from '@/app/login/actions'

export const metadata: Metadata = {
  title: 'Dashboard | Liberty Car',
}

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) redirect('/login')

  let user: any = null
  let role = null

  try {
    user = await adminAuth.verifySessionCookie(session, true)
    const profileDoc = await adminDb.collection('profiles').doc(user.uid).get()
    role = profileDoc.data()?.role || null
  } catch (error) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Topo / Navbar */}
        <div className="flex items-center justify-between border-b border-neutral-200 pb-5 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Liberty Car</h1>
            <p className="text-sm text-neutral-500">Painel de Controle Interno</p>
          </div>
          
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-neutral-200 hover:bg-neutral-100 px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
            >
              Sair da conta
            </button>
          </form>
        </div>

        {/* Card de Boas-vindas */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Boas-vindas</p>
              <h2 className="text-xl font-bold text-neutral-900 mt-1">{user.email}</h2>
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

        {/* Módulos do Sistema */}
        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
          Módulos Disponíveis
        </h3>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Módulo de Gerenciamento de Usuários (Apenas Admin) */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center font-bold text-neutral-700 mb-4">
                U
              </div>
              <h4 className="text-lg font-bold text-neutral-900">
                Gerenciar Usuários
              </h4>
              <p className="text-sm text-neutral-500 mt-1">
                Cadastre novas contas de administradores, vendedores, advogados ou equipe de suporte.
              </p>
            </div>
            
            <div className="mt-6">
              {role === 'admin' ? (
                <Link
                  href="/dashboard/usuarios"
                  className="inline-block rounded-lg bg-neutral-950 hover:bg-neutral-850 text-white text-sm font-medium px-4 py-2 transition-colors"
                >
                  Acessar Painel
                </Link>
              ) : (
                <div className="text-xs text-neutral-400 font-medium">
                  {role ? 'Requer perfil de Administrador.' : 'Associe um perfil à sua conta para acessar.'}
                  <div className="mt-2">
                    <Link
                      href="/dashboard/usuarios"
                      className="inline-block text-xs font-semibold text-neutral-600 hover:text-black underline"
                    >
                      Acessar para se tornar Admin (Dev)
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Módulo de Veículos (Apenas Admin) */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center font-bold text-neutral-700 mb-4">
                🚗
              </div>
              <h4 className="text-lg font-bold text-neutral-900">
                Gerenciar Veículos
              </h4>
              <p className="text-sm text-neutral-550 mt-1">
                Cadastre veículos com fotos, gerencie o estoque e controle as informações da frota.
              </p>
            </div>
            
            <div className="mt-6">
              {role === 'admin' ? (
                <Link
                  href="/dashboard/veiculos"
                  className="inline-block rounded-lg bg-neutral-950 hover:bg-neutral-850 text-white text-sm font-medium px-4 py-2 transition-colors"
                >
                  Acessar Painel
                </Link>
              ) : (
                <span className="text-xs font-semibold text-neutral-400">
                  Requer perfil de Administrador.
                </span>
              )}
            </div>
          </div>

          {/* Módulo de Gerenciamento de Propostas (Admin e Vendedor) */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center font-bold text-neutral-700 mb-4">
                📩
              </div>
              <h4 className="text-lg font-bold text-neutral-900">
                Gerenciar Propostas
              </h4>
              <p className="text-sm text-neutral-550 mt-1">
                Visualize e responda as mensagens de interesse e propostas de compra enviadas por clientes.
              </p>
            </div>
            
            <div className="mt-6">
              {role === 'admin' || role === 'vendedor' ? (
                <Link
                  href="/dashboard/propostas"
                  className="inline-block rounded-lg bg-neutral-950 hover:bg-neutral-850 text-white text-sm font-medium px-4 py-2 transition-colors"
                >
                  Acessar Painel
                </Link>
              ) : (
                <span className="text-xs font-semibold text-neutral-400">
                  Requer perfil de Vendedor ou Administrador.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
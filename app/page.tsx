import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import PublicVehiclesList from './PublicVehiclesList'

export const metadata = {
  title: 'Liberty Car | Encontre seu Veículo Ideal',
  description: 'Confira nosso estoque completo de veículos seminovos e novos com as melhores condições.',
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const veiculos = await getVehicles()

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-between">
      
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-250 bg-white/80 backdrop-blur-md px-4 py-4 md:px-8">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tighter text-neutral-950">
              LIBERTY CAR
            </span>
          </Link>

          <nav className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-block text-xs font-semibold text-neutral-500">
                  {user.email}
                </span>
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-neutral-950 hover:bg-neutral-850 text-white text-xs font-bold px-4 py-2 transition-all shadow-xs hover:shadow-md"
                >
                  Ir para o Dashboard
                </Link>
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-800 text-xs font-bold px-4 py-2 transition-all"
              >
                Entrar no Painel
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-12 md:px-8">
        <div className="mx-auto max-w-6xl space-y-12">
          
          {/* Hero Section */}
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <span className="rounded-full bg-neutral-900/5 text-neutral-850 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest">
              Estoque Liberty Car
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-neutral-950 tracking-tight leading-tight">
              Encontre seu próximo carro com total segurança
            </h1>
            <p className="text-sm md:text-base text-neutral-500 leading-relaxed font-medium">
              Veículos vistoriados, com procedência garantida e as melhores taxas do mercado. Explore nossa frota abaixo e faça sua proposta.
            </p>
          </div>

          {/* Listagem de Veículos */}
          <PublicVehiclesList veiculos={veiculos} />

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-8 px-4 md:px-8 text-center text-xs text-neutral-400 font-medium">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Liberty Car. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-neutral-600 transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-neutral-600 transition-colors">Política de Privacidade</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
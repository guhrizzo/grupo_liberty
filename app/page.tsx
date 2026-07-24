import Link from 'next/link'
import { cookies } from 'next/headers'
import { IconBolt, IconArrowRight, IconUser } from '@tabler/icons-react'
import { adminAuth } from '@/utils/firebase/admin'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import PublicVehiclesList from './PublicVehiclesList'
import { Button } from './components/ui'

export const metadata = {
  title: 'Liberty Car | Encontre seu Veículo Ideal',
  description: 'Confira nosso estoque completo de veículos seminovos e novos com as melhores condições.',
}

export default async function HomePage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  let user: { uid: string; email?: string | null } | null = null

  if (session) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session, true)
      user = { uid: decoded.uid, email: decoded.email ?? null }
    } catch (error) {
      // Ignorar erro e continuar como deslogado
    }
  }
  const veiculos = await getVehicles()

  return (
    <div className="min-h-screen flex flex-col">

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-neutral-200">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3 md:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative h-9 w-9 rounded-lg grid place-items-center liberty-glow bg-liberty/10">
              <IconBolt size={20} className="text-liberty" stroke={2.2} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-black tracking-tighter text-neutral-900">
                LIBERTY<span className="text-liberty">CAR</span>
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-500 mt-0.5">
                Seminovos & Novos
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
                  <IconUser size={14} className="text-liberty" />
                  {user.email}
                </span>
                <Link href="/dashboard">
                  <Button variant="liberty" size="sm" rightIcon={<IconArrowRight size={14} stroke={2.5} />}>
                    Dashboard
                  </Button>
                </Link>
              </div>
            ) : (
              <Link href="/login">
                <Button variant="secondary" size="sm" rightIcon={<IconArrowRight size={14} stroke={2.5} />}>
                  Entrar no Painel
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-10 md:px-8 md:py-16">
        <div className="mx-auto max-w-7xl space-y-12 md:space-y-16">

          {/* Hero Section */}
          <section className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-br from-liberty/8 via-white to-white shadow-lg shadow-liberty/5">
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-liberty/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-liberty-soft/10 blur-3xl pointer-events-none" />

            <div className="relative px-6 py-14 md:px-16 md:py-20 text-center max-w-3xl mx-auto space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-liberty/30 bg-liberty/5 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.25em] text-liberty-deep">
                <span className="h-1.5 w-1.5 rounded-full bg-liberty animate-[pulse-soft_1.4s_ease-in-out_infinite]" />
                Estoque Atualizado
              </span>
              <h1 className="text-4xl md:text-6xl font-black text-neutral-900 tracking-tight leading-[1.05]">
                Seu próximo carro com <span className="text-liberty">segurança</span> e a melhor taxa.
              </h1>
              <p className="text-sm md:text-base text-neutral-600 leading-relaxed max-w-xl mx-auto">
                Veículos vistoriados, procedência garantida e atendimento de Jaú/SP e Bauru/SP. Explore a frota e faça sua proposta.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <a href="#estoque">
                  <Button variant="liberty" size="lg" rightIcon={<IconArrowRight size={14} stroke={2.5} />}>
                    Ver Estoque
                  </Button>
                </a>
                <a href="#sobre">
                  <Button variant="secondary" size="lg">
                    Sobre a Liberty
                  </Button>
                </a>
              </div>

              {/* Trust strip */}
              <div className="pt-6 mt-2 border-t border-neutral-200 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xl md:text-2xl font-black text-liberty">{veiculos.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mt-0.5">Veículos</p>
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-black text-liberty">2</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mt-0.5">Lojas</p>
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-black text-liberty">100%</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mt-0.5">Vistoriados</p>
                </div>
              </div>
            </div>
          </section>

          {/* Listagem de Veículos */}
          <section id="estoque" className="space-y-6">
            <div className="flex items-end justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-liberty">
                  Frota Disponível
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-neutral-900 mt-1">
                  Veículos em Destaque
                </h2>
              </div>
              <span className="text-xs font-semibold text-neutral-500">
                {veiculos.length} {veiculos.length === 1 ? 'veículo' : 'veículos'}
              </span>
            </div>
            <PublicVehiclesList veiculos={veiculos} />
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-10 px-4 md:px-8">
        <div className="mx-auto max-w-7xl grid gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg grid place-items-center bg-liberty/10 liberty-glow">
                <IconBolt size={18} className="text-liberty" stroke={2.2} />
              </div>
              <span className="text-base font-black tracking-tighter text-neutral-900">
                LIBERTY<span className="text-liberty">CAR</span>
              </span>
            </div>
            <p className="mt-3 text-xs text-neutral-500 leading-relaxed max-w-xs">
              Veículos selecionados com transparência, segurança e as melhores condições de Jaú e Bauru.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-neutral-500">
              Lojas
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
              <li>Jaú/SP — Av. Principal, 1234</li>
              <li>Bauru/SP — R. das Palmeiras, 567</li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-neutral-500">
              Atendimento
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
              <li>Seg–Sáb • 08h–18h</li>
              <li>contato@libertycar.com.br</li>
            </ul>
          </div>
        </div>
        <div className="mx-auto max-w-7xl mt-8 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-500">
          <p>© {new Date().getFullYear()} Liberty Car. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-liberty transition-colors">Termos</a>
            <a href="#" className="hover:text-liberty transition-colors">Privacidade</a>
          </div>
        </div>
      </footer>

    </div>
  )
}

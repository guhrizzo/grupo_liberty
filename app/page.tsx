import Link from 'next/link'
import { cookies } from 'next/headers'
import { IconBolt, IconArrowRight, IconUser } from '@tabler/icons-react'
import { adminAuth } from '@/utils/firebase/admin'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import PublicVehiclesList from './PublicVehiclesList'
import FloatingLines from './components/floating'

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
    <div className="neon-theme min-h-screen flex flex-col">

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full glass border-b border-line">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3 md:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative h-9 w-9 rounded-lg grid place-items-center neon-glow bg-bg-3">
              <IconBolt size={20} className="text-neon-soft" stroke={2.2} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-black tracking-tighter text-white">
                LIBERTY<span className="neon-text">CAR</span>
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-text-lo mt-0.5">
                Seminovos & Novos
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-text-md">
                  <IconUser size={14} className="text-neon-soft" />
                  {user.email}
                </span>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-neon hover:bg-neon-soft text-[#001018] text-xs font-extrabold px-4 py-2 transition-all shadow-[0_0_18px_-4px_rgba(0,212,255,0.6)] hover:shadow-[0_0_24px_-2px_rgba(0,212,255,0.8)] cursor-pointer"
                >
                  Dashboard
                  <IconArrowRight size={14} stroke={2.5} />
                </Link>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line hover:border-neon hover:text-white text-text-md text-xs font-bold px-4 py-2 transition-all cursor-pointer"
              >
                Entrar no Painel
                <IconArrowRight size={14} stroke={2.5} />
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-10 md:px-8 md:py-16">
        <div className="mx-auto max-w-7xl space-y-12 md:space-y-16">

          {/* Hero Section */}
          <section className="relative overflow-hidden rounded-3xl border border-line glass-strong">
            <div className="absolute inset-0 grid-bg opacity-40" />
            <div className="absolute inset-0 bg-linear-to-br from-[rgba(0,212,255,0.10)] via-transparent to-transparent" />
            <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-neon opacity-10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-neon-deep opacity-10 blur-3xl" />

            {/* Floating Lines background */}
            <div className="absolute inset-0 pointer-events-none opacity-50">
              <FloatingLines
                enabledWaves={["top", "middle", "bottom"]}
                lineCount={6}
                lineDistance={10}
                bendRadius={8}
                bendStrength={-2}
                interactive
                parallax={true}
                animationSpeed={0.6}
                linesGradient={['#00D4FF', '#3b82f6', '#0f172a']} // Azul neon vibrante -> Azul médio -> Azul escuro
                
                
              />
            </div>

            <div className="relative px-6 py-14 md:px-16 md:py-20 text-center max-w-3xl mx-auto space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.25em] text-neon-soft">
                <span className="h-1.5 w-1.5 rounded-full bg-neon animate-[pulse-soft_1.4s_ease-in-out_infinite]" />
                Estoque Atualizado
              </span>
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.05]">
                Seu próximo carro com <span className="neon-text">segurança</span> e a melhor taxa.
              </h1>
              <p className="text-sm md:text-base text-text-md leading-relaxed max-w-xl mx-auto">
                Veículos vistoriados, procedência garantida e atendimento de Jaú/SP e Bauru/SP. Explore a frota e faça sua proposta.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <a
                  href="#estoque"
                  className="inline-flex items-center gap-2 rounded-lg bg-neon hover:bg-neon-soft text-[#001018] text-xs font-extrabold px-5 py-3 transition-all shadow-[0_0_22px_-4px_rgba(0,212,255,0.7)] cursor-pointer"
                >
                  Ver Estoque
                  <IconArrowRight size={14} stroke={2.5} />
                </a>
                <a
                  href="#sobre"
                  className="inline-flex items-center gap-2 rounded-lg border border-line hover:border-neon text-white text-xs font-bold px-5 py-3 transition-all cursor-pointer"
                >
                  Sobre a Liberty
                </a>
              </div>
            </div>
          </section>

          {/* Listagem de Veículos */}
          <section id="estoque" className="space-y-6">
            <div className="flex items-end justify-between gap-4 border-b border-line pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-neon-soft">
                  Frota Disponível
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-white mt-1">
                  Veículos em Destaque
                </h2>
              </div>
              <span className="text-xs font-semibold text-text-lo">
                {veiculos.length} {veiculos.length === 1 ? 'veículo' : 'veículos'}
              </span>
            </div>
            <PublicVehiclesList veiculos={veiculos} />
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-bg-1/80 backdrop-blur-md py-10 px-4 md:px-8">
        <div className="mx-auto max-w-7xl grid gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg grid place-items-center neon-glow bg-bg-3">
                <IconBolt size={18} className="text-neon-soft" stroke={2.2} />
              </div>
              <span className="text-base font-black tracking-tighter text-white">
                LIBERTY<span className="neon-text">CAR</span>
              </span>
            </div>
            <p className="mt-3 text-xs text-text-lo leading-relaxed max-w-xs">
              Veículos selecionados com transparência, segurança e as melhores condições de Jaú e Bauru.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-text-lo">
              Lojas
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-text-md">
              <li>Jaú/SP — Av. Principal, 1234</li>
              <li>Bauru/SP — R. das Palmeiras, 567</li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-text-lo">
              Atendimento
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-text-md">
              <li>Seg–Sáb • 08h–18h</li>
              <li>contato@libertycar.com.br</li>
            </ul>
          </div>
        </div>
        <div className="mx-auto max-w-7xl mt-8 pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-text-mute">
          <p>© {new Date().getFullYear()} Liberty Car. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-neon-soft transition-colors">Termos</a>
            <a href="#" className="hover:text-neon-soft transition-colors">Privacidade</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
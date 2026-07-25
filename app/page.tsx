import Link from 'next/link'
import { cookies } from 'next/headers'
import { IconBolt, IconArrowRight, IconUser } from '@tabler/icons-react'
import { adminAuth } from '@/utils/firebase/admin'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import PublicVehiclesList from './PublicVehiclesList'
import { Button } from './components/ui'
import FooterLegalLinks from './components/FooterLegalLinks'

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
              <span className="inline-flex items-center gap-2 rounded-full border border-liberty/30 bg-liberty/5 px-3.5 py-1 text-xs font-extrabold uppercase tracking-[0.25em] text-liberty-deep animate-[fade-up_0.5s_cubic-bezier(0.16,1,0.3,1)_both]">
                <span className="h-1.5 w-1.5 rounded-full bg-liberty animate-[pulse-soft_1.4s_ease-in-out_infinite]" />
                Estoque Atualizado
              </span>
              <h1 className="text-4xl md:text-6xl font-black text-neutral-900 tracking-tight leading-[1.05] animate-[fade-up_0.5s_cubic-bezier(0.16,1,0.3,1)_100ms_both]">
                Seu próximo carro com <span className="text-liberty">segurança</span> e o melhor Preço.
              </h1>
              <p className="text-sm md:text-base text-neutral-600 leading-relaxed max-w-xl mx-auto animate-[fade-up_0.5s_cubic-bezier(0.16,1,0.3,1)_200ms_both]">
                Veículos vistoriados, procedência garantida e atendimento de Jaú/SP e Bauru/SP. Explore a frota e faça sua proposta.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2 animate-[fade-up_0.5s_cubic-bezier(0.16,1,0.3,1)_300ms_both]">
                <a href="#estoque">
                  <Button variant="liberty" size="lg" rightIcon={<IconArrowRight size={14} stroke={2.5} />}>
                    Ver Estoque
                  </Button>
                </a>
                <a href="https://libertycar.net.br" target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="lg">
                    Sobre a Liberty
                  </Button>
                </a>
              </div>

              {/* Trust strip */}
              <div className="pt-6 mt-2 border-t border-neutral-200 grid grid-cols-3 gap-4 text-center animate-[fade-up_0.5s_cubic-bezier(0.16,1,0.3,1)_400ms_both]">
                <div className="group cursor-default">
                  <p className="text-xl md:text-2xl font-black text-liberty group-hover:scale-110 transition-transform duration-300">{veiculos.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mt-0.5">Veículos</p>
                </div>
                <div className="group cursor-default">
                  <p className="text-xl md:text-2xl font-black text-liberty group-hover:scale-110 transition-transform duration-300">2</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mt-0.5">Lojas</p>
                </div>
                <div className="group cursor-default">
                  <p className="text-xl md:text-2xl font-black text-liberty group-hover:scale-110 transition-transform duration-300">100%</p>
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
              <li>
                <a
                  href="https://maps.app.goo.gl/KKstZnVUb82SY4nf8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-liberty transition-colors"
                >
                  Jaú/SP — Ver no Google Maps
                </a>
              </li>
              <li>Bauru/SP — Av. Duque de Caxias, 7-75</li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-neutral-500">
              Atendimento
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
              <li>Seg–Sex • 08h–18h</li>
              <li>Sábado • 09h–17h</li>
            </ul>
            <div className="social-links mt-3 flex items-center gap-2">
              <a
                href="https://www.instagram.com/liberty_car7/"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition-all duration-300 ease-out hover:scale-110 hover:-translate-y-0.5 hover:border-liberty hover:bg-liberty/10 hover:text-liberty hover:shadow-lg hover:shadow-liberty/20 active:scale-95"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-instagram transition-transform duration-300 ease-out group-hover:rotate-6"
                  aria-hidden="true"
                >
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
              </a>
              <a
                href="https://wa.me/5514998420710"
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition-all duration-300 ease-out hover:scale-110 hover:-translate-y-0.5 hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-message-circle transition-transform duration-300 ease-out group-hover:-rotate-6"
                  aria-hidden="true"
                >
                  <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl mt-8 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-500">
          <p>© {new Date().getFullYear()} Liberty Car. Todos os direitos reservados.</p>
          <FooterLegalLinks />
        </div>
      </footer>

    </div>
  )
}

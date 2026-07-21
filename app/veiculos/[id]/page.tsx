import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { IconArrowLeft, IconBolt, IconArrowRight, IconCalendar, IconPalette, IconRoad, IconManualGearbox, IconGasStation, IconMapPin, IconMessage2 } from '@tabler/icons-react'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import PropostaForm from './PropostaForm'
import GalleryViewer from './GalleryViewer'

export default async function VeiculoPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const docRef = adminDb.collection('veiculos').doc(id)
  const docSnap = await docRef.get()

  if (!docSnap.exists) {
    notFound()
  }

  const veiculo = { id: docSnap.id, ...docSnap.data() } as any

  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  let user: { uid: string; email?: string | null } | null = null

  if (session) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session, true)
      user = { uid: decoded.uid, email: decoded.email ?? null }
    } catch (error) {
      // Ignorar erro
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  return (
    <div className="neon-theme min-h-screen flex flex-col">

      {/* Topbar */}
      <header className="sticky top-0 z-40 w-full glass border-b border-[var(--color-line)]">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3 md:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-lg grid place-items-center neon-glow bg-[var(--color-bg-3)]">
              <IconBolt size={20} className="text-[var(--color-neon-soft)]" stroke={2.2} />
            </div>
            <span className="text-lg font-black tracking-tighter text-white">
              LIBERTY<span className="neon-text">CAR</span>
            </span>
          </Link>
          {user ? (
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-neon)] hover:bg-[var(--color-neon-soft)] text-[#001018] text-xs font-extrabold px-4 py-2 transition-all shadow-[0_0_18px_-4px_rgba(0,212,255,0.6)] cursor-pointer">
              Dashboard <IconArrowRight size={14} stroke={2.5} />
            </Link>
          ) : (
            <Link href="/login" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] hover:border-[var(--color-neon)] hover:text-white text-[var(--color-text-md)] text-xs font-bold px-4 py-2 transition-all cursor-pointer">
              Entrar
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl">

          <div className="mb-6 flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text-md)] hover:text-[var(--color-neon-soft)] transition-colors">
              <IconArrowLeft size={16} stroke={2} />
              Voltar para a listagem
            </Link>
          </div>

          <div className="grid gap-8 lg:grid-cols-3 items-start">

            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-[var(--color-line)] glass p-4">
                <GalleryViewer fotos={veiculo.fotos} alt={`${veiculo.marca} ${veiculo.modelo}`} />
              </div>

              <div className="rounded-2xl border border-[var(--color-line)] glass-strong p-6">
                <div className="border-b border-[var(--color-line)] pb-5 mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[var(--color-neon-soft)]">
                      {veiculo.marca}
                    </span>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mt-1">
                      {veiculo.modelo}
                    </h1>
                    {veiculo.localizacao && (
                      <span className="inline-flex items-center gap-1.5 mt-2 text-xs text-[var(--color-text-md)]">
                        <IconMapPin size={14} className="text-[var(--color-neon-soft)]" />
                        Loja {veiculo.localizacao === 'bauru' ? 'Bauru/SP' : 'Jaú/SP'}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[var(--color-text-lo)]">Preço à vista</p>
                    <p className="text-3xl font-black neon-text">
                      {formatCurrency(veiculo.preco)}
                    </p>
                  </div>
                </div>

                <h2 className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[var(--color-text-lo)] mb-3">
                  Ficha Técnica
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Spec icon={<IconCalendar size={16} />} label="Ano" value={String(veiculo.ano)} />
                  {veiculo.cor && <Spec icon={<IconPalette size={16} />} label="Cor" value={veiculo.cor} />}
                  {veiculo.quilometragem !== null && veiculo.quilometragem !== undefined && (
                    <Spec icon={<IconRoad size={16} />} label="Quilometragem" value={`${veiculo.quilometragem.toLocaleString('pt-BR')} km`} />
                  )}
                  <Spec icon={<IconManualGearbox size={16} />} label="Câmbio" value={String(veiculo.cambio).toUpperCase()} />
                  <Spec icon={<IconGasStation size={16} />} label="Combustível" value={String(veiculo.combustivel).toUpperCase()} />
                </div>

                {veiculo.descricao && (
                  <div className="border-t border-[var(--color-line)] pt-6 mt-6">
                    <h3 className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[var(--color-text-lo)] mb-3">
                      Descrição
                    </h3>
                    <p className="text-sm text-[var(--color-text-md)] leading-relaxed whitespace-pre-line">
                      {veiculo.descricao}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6 lg:sticky lg:top-24">
              {user ? (
                <PropostaForm veiculoId={veiculo.id} veiculoModelo={`${veiculo.marca} ${veiculo.modelo}`} />
              ) : (
                <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line)] glass-strong p-6">
                  <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[var(--color-neon)] opacity-15 blur-3xl" />
                  <div className="relative">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg neon-glow bg-[var(--color-bg-3)] mb-4">
                      <IconMessage2 size={20} className="text-[var(--color-neon-soft)]" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Faça uma Proposta</h3>
                    <p className="text-xs text-[var(--color-text-md)] mb-6 leading-relaxed">
                      Para enviar propostas, tirar dúvidas ou agendar visitas, autentique-se no sistema Liberty Car.
                    </p>
                    <Link
                      href={`/login?redirect=/veiculos/${veiculo.id}`}
                      className="block w-full text-center bg-[var(--color-neon)] hover:bg-[var(--color-neon-soft)] text-[#001018] font-extrabold py-3 rounded-xl text-sm transition-all shadow-[0_0_18px_-4px_rgba(0,212,255,0.7)] cursor-pointer"
                    >
                      Fazer Login
                    </Link>
                    <p className="text-[11px] text-[var(--color-text-mute)] mt-3 text-center">
                      Não tem conta? Solicite ao administrador.
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--color-bg-2)] border border-[var(--color-line)] p-3.5 hover:border-[var(--color-neon)]/40 transition-colors">
      <div className="flex items-center gap-1.5 text-[var(--color-neon-soft)]">
        {icon}
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]">{label}</p>
      </div>
      <p className="text-sm font-bold text-white mt-1.5">{value}</p>
    </div>
  )
}

import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { IconBolt, IconArrowRight, IconCalendar, IconPalette, IconRoad, IconManualGearbox, IconGasStation, IconMapPin, IconMessage2, IconChevronRight, IconCash, IconAlertTriangle, IconCreditCard } from '@tabler/icons-react'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import PropostaForm from './PropostaForm'
import GalleryViewer from './GalleryViewer'
import ShareButton from '@/app/components/ShareButton'
import { Button } from '@/app/components/ui'
import type { Metadata } from 'next'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params
  try {
    const snap = await adminDb.collection('veiculos').doc(id).get()
    if (!snap.exists) {
      return { title: 'Veículo não encontrado | Liberty Car' }
    }
    const v = snap.data() as {
      marca?: string
      modelo?: string
      ano?: number
      preco?: number
      fotos?: string[]
      quilometragem?: number | null
      cambio?: string
      combustivel?: string
    }
    const titulo = [v.marca, v.modelo, v.ano].filter(Boolean).join(' ')
    const description = v.preco
      ? `${titulo} por ${formatCurrency(v.preco)}. ${v.quilometragem ? v.quilometragem.toLocaleString('pt-BR') + ' km' : ''} ${v.cambio?.toUpperCase() ?? ''} ${v.combustivel?.toUpperCase() ?? ''}`.trim()
      : `${titulo} disponível na Liberty Car.`
    const ogImages = v.fotos && v.fotos.length > 0 ? [{ url: v.fotos[0] }] : undefined
    return {
      title: `${titulo} | Liberty Car`,
      description,
      openGraph: {
        title: `${titulo} | Liberty Car`,
        description,
        type: 'website',
        ...(ogImages ? { images: ogImages } : {}),
      },
    }
  } catch {
    return { title: 'Liberty Car' }
  }
}

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
  let user: { uid: string; email?: string | null; role?: string | null } | null = null

  if (session) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session, true)
      const profileDoc = await adminDb.collection('profiles').doc(decoded.uid).get()
      user = {
        uid: decoded.uid,
        email: decoded.email ?? null,
        role: profileDoc.data()?.role || null,
      }
    } catch (error) {
      // Ignorar erro
    }
  }

  // Flag para exibir informações internas (acessória, débitos, financiamento)
  // para o próprio time (admin/vendedor/advogado/suporte).
  const showInternalInfo =
    !!user && ['admin', 'vendedor', 'advogado', 'suporte'].includes(user.role ?? '')

  return (
    <div className="min-h-screen flex flex-col">

      {/* Topbar */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-neutral-200">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3 md:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-lg grid place-items-center bg-liberty/10 liberty-glow">
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
          {user ? (
            <Link href="/dashboard">
              <Button variant="liberty" size="sm" rightIcon={<IconArrowRight size={14} stroke={2.5} />}>
                Dashboard
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="secondary" size="sm">Entrar</Button>
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl">

          {/* Breadcrumb + Share */}
          <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
            <nav aria-label="Trilha de navegação" className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 flex-wrap">
              <Link href="/" className="hover:text-liberty transition-colors">
                Estoque
              </Link>
              {veiculo.marca && (
                <>
                  <IconChevronRight size={12} stroke={2} aria-hidden className="text-neutral-300" />
                  <span className="text-neutral-500">{veiculo.marca}</span>
                </>
              )}
              <IconChevronRight size={12} stroke={2} aria-hidden className="text-neutral-300" />
              <span className="text-liberty font-bold truncate max-w-[60vw]">
                {veiculo.modelo} {veiculo.ano}
              </span>
            </nav>

            <ShareButton
              url={`/veiculos/${veiculo.id}`}
              title={`${veiculo.marca} ${veiculo.modelo} ${veiculo.ano}`}
              text={`${veiculo.marca} ${veiculo.modelo} ${veiculo.ano} na Liberty Car`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 hover:border-liberty hover:text-liberty text-neutral-700 bg-white px-3.5 py-2 text-xs font-bold transition-all cursor-pointer"
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-3 items-start">

            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <GalleryViewer fotos={veiculo.fotos} alt={`${veiculo.marca} ${veiculo.modelo}`} />
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="border-b border-neutral-200 pb-5 mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-liberty">
                      {veiculo.marca}
                    </span>
                    <h1 className="text-3xl md:text-4xl font-black text-neutral-900 tracking-tight mt-1">
                      {veiculo.modelo}
                    </h1>
                    {veiculo.localizacao && (
                      <span className="inline-flex items-center gap-1.5 mt-2 text-xs text-neutral-600">
                        <IconMapPin size={14} className="text-liberty" />
                        Loja {veiculo.localizacao === 'bauru' ? 'Bauru/SP' : 'Jaú/SP'}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-neutral-500">Preço à vista</p>
                    <p className="text-3xl font-black text-liberty">
                      {formatCurrency(veiculo.preco)}
                    </p>
                  </div>
                </div>

                <h2 className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-neutral-500 mb-3">
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
                  <div className="border-t border-neutral-200 pt-6 mt-6">
                    <h3 className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-neutral-500 mb-3">
                      Descrição
                    </h3>
                    <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                      {veiculo.descricao}
                    </p>
                  </div>
                )}

                {/* Bloco interno — visível só para o time logado. */}
                {showInternalInfo && (
                  <div className="border-t border-neutral-200 pt-6 mt-6">
                    <h3 className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-liberty-deep mb-3 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-liberty animate-[pulse-soft_1.4s_ease-in-out_infinite]" />
                      Informações Internas
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Spec
                        icon={<IconCash size={16} />}
                        label="Acessória"
                        value={
                          veiculo.telefoneAcessoria
                            ? veiculo.telefoneAcessoria
                            : 'Não informada'
                        }
                      />
                      <Spec
                        icon={<IconAlertTriangle size={16} />}
                        label="Débitos"
                        value={
                          veiculo.debitos !== undefined && veiculo.debitos !== null
                            ? formatCurrency(veiculo.debitos)
                            : 'Sem débitos'
                        }
                      />
                      <Spec
                        icon={<IconCreditCard size={16} />}
                        label="Financiamento"
                        value={
                          veiculo.valorParcela
                            ? `${veiculo.parcelasRestantes ?? '?'}x ${formatCurrency(veiculo.valorParcela)}`
                            : 'Quitado'
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6 lg:sticky lg:top-24">
              {user ? (
                <PropostaForm veiculoId={veiculo.id} veiculoModelo={`${veiculo.marca} ${veiculo.modelo}`} />
              ) : (
                <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-liberty/10 liberty-glow mb-4">
                    <IconMessage2 size={20} className="text-liberty" />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900 mb-2">Faça uma Proposta</h3>
                  <p className="text-xs text-neutral-600 mb-6 leading-relaxed">
                    Para enviar propostas, tirar dúvidas ou agendar visitas, autentique-se no sistema Liberty Car.
                  </p>
                  <Link href={`/login?redirect=/veiculos/${veiculo.id}`}>
                    <Button variant="liberty" fullWidth size="lg">Fazer Login</Button>
                  </Link>
                  <p className="text-[11px] text-neutral-500 mt-3 text-center">
                    Não tem conta? Solicite ao administrador.
                  </p>
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
    <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3.5 hover:border-liberty/40 transition-colors">
      <div className="flex items-center gap-1.5 text-liberty">
        {icon}
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]">{label}</p>
      </div>
      <p className="text-sm font-bold text-neutral-900 mt-1.5">{value}</p>
    </div>
  )
}

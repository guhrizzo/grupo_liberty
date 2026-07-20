import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { IconArrowLeft } from '@tabler/icons-react'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import PropostaForm from './PropostaForm'
import GalleryViewer from './GalleryViewer'

export default async function VeiculoPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  // Buscar dados do veículo no Firestore
  const docRef = adminDb.collection('veiculos').doc(id)
  const docSnap = await docRef.get()

  if (!docSnap.exists) {
    notFound()
  }

  const veiculo = { id: docSnap.id, ...docSnap.data() } as any

  // Verificar se o usuário está logado via Firebase Session Cookie
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  let user: any = null

  if (session) {
    try {
      user = await adminAuth.verifySessionCookie(session, true)
    } catch (error) {
      // Ignorar erro e continuar como deslogado
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Cabeçalho de Navegação */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <IconArrowLeft size={16} stroke={2} />
            Voltar para a listagem
          </Link>

          {user && (
            <Link
              href="/dashboard"
              className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3.5 py-1.5 rounded-lg transition-colors"
            >
              Ir para o Dashboard
            </Link>
          )}
        </div>

        {/* Layout Principal em Duas Colunas */}
        <div className="grid gap-8 lg:grid-cols-3 items-start">
          
          {/* Coluna 1 & 2: Galeria e Detalhes */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Fotos / Galeria */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs">
              <GalleryViewer fotos={veiculo.fotos} alt={`${veiculo.marca} ${veiculo.modelo}`} />
            </div>

            {/* Informações Básicas do Veículo */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs">
              <div className="border-b border-neutral-100 pb-4 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  {veiculo.marca}
                </span>
                <h1 className="text-3xl font-extrabold text-neutral-950 tracking-tight mt-1">
                  {veiculo.modelo}
                </h1>
                <p className="text-2xl font-black text-neutral-950 mt-2">
                  {formatCurrency(veiculo.preco)}
                </p>
              </div>

              <div className="space-y-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
                  Ficha Técnica
                </h2>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl bg-neutral-50 p-3.5 border border-neutral-100">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Ano</p>
                    <p className="text-sm font-semibold text-neutral-900 mt-0.5">{veiculo.ano}</p>
                  </div>
                  {veiculo.cor && (
                    <div className="rounded-xl bg-neutral-50 p-3.5 border border-neutral-100">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Cor</p>
                      <p className="text-sm font-semibold text-neutral-900 mt-0.5">{veiculo.cor}</p>
                    </div>
                  )}
                  {veiculo.quilometragem !== null && (
                    <div className="rounded-xl bg-neutral-50 p-3.5 border border-neutral-100">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Km</p>
                      <p className="text-sm font-semibold text-neutral-900 mt-0.5">
                        {veiculo.quilometragem.toLocaleString('pt-BR')} km
                      </p>
                    </div>
                  )}
                  <div className="rounded-xl bg-neutral-50 p-3.5 border border-neutral-100">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Câmbio</p>
                    <p className="text-sm font-semibold text-neutral-950 uppercase mt-0.5">{veiculo.cambio}</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-3.5 border border-neutral-100">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Combustível</p>
                    <p className="text-sm font-semibold text-neutral-950 uppercase mt-0.5">{veiculo.combustivel}</p>
                  </div>
                </div>

                {veiculo.descricao && (
                  <div className="border-t border-neutral-100 pt-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 mb-3">
                      Descrição do Veículo
                    </h3>
                    <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-line">
                      {veiculo.descricao}
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Coluna 3: Caixa de Proposta / Login CTA */}
          <div className="space-y-6 lg:sticky lg:top-8">
            {user ? (
              <PropostaForm veiculoId={veiculo.id} veiculoModelo={`${veiculo.marca} ${veiculo.modelo}`} />
            ) : (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-900 text-white p-6 shadow-md">
                <h3 className="text-lg font-bold mb-2">Faça uma Proposta</h3>
                <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
                  Para enviar propostas de compra, tirar dúvidas ou agendar visitas a este veículo, você precisa estar autenticado em nosso sistema.
                </p>
                <div className="space-y-3">
                  <Link
                    href={`/login?redirect=/veiculos/${veiculo.id}`}
                    className="block w-full text-center bg-white hover:bg-neutral-100 text-neutral-900 font-bold py-3 rounded-xl text-sm transition-colors shadow-xs"
                  >
                    Fazer Login
                  </Link>
                  <div className="text-center">
                    <span className="text-xs text-neutral-400">
                      Não tem uma conta? Solicite ou faça cadastro no painel.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

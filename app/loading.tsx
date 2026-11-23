'use client'

import { usePathname } from 'next/navigation'
import { SkeletonPortal } from '@/app/area-do-cliente/SkeletonPortal'
import { Skeleton, SkeletonPage, SkeletonHeader } from '@/app/components/ui'
import DashboardPropostasRegistrosIdEditarSkeleton from '@/app/dashboard/propostas/registros/[id]/editar/loading'
import DashboardContratosGerarModeloSkeleton from '@/app/dashboard/contratos/gerar/[modelo]/loading'
import DashboardContratosGerarSkeleton from '@/app/dashboard/contratos/gerar/loading'
import DashboardPropostasNovaSkeleton from '@/app/dashboard/propostas/nova/loading'
import DashboardPropostasRegistrosSkeleton from '@/app/dashboard/propostas/registros/loading'
import DashboardPropostasSiteSkeleton from '@/app/dashboard/propostas/site/loading'
import DashboardAgendaSkeleton from '@/app/dashboard/agenda/loading'
import DashboardAnalyticsSkeleton from '@/app/dashboard/analytics/loading'
import DashboardAnunciosSkeleton from '@/app/dashboard/anuncios/loading'
import DashboardChecklistPosCompraSkeleton from '@/app/dashboard/checklist-pos-compra/loading'
import DashboardCobrancasSkeleton from '@/app/dashboard/cobrancas/loading'
import DashboardConsultaFipeSkeleton from '@/app/dashboard/consulta-fipe/loading'
import DashboardContratosSkeleton from '@/app/dashboard/contratos/loading'
import DashboardDemandasSkeleton from '@/app/dashboard/demandas/loading'
import DashboardFeedbackSkeleton from '@/app/dashboard/feedback/loading'
import DashboardFinanceiroSkeleton from '@/app/dashboard/financeiro/loading'
import DashboardInteressesSkeleton from '@/app/dashboard/interesses/loading'
import DashboardJuridicoSkeleton from '@/app/dashboard/juridico/loading'
import DashboardLeadsSkeleton from '@/app/dashboard/leads/loading'
import DashboardManutencaoSkeleton from '@/app/dashboard/manutencao/loading'
import DashboardMetasSkeleton from '@/app/dashboard/metas/loading'
import DashboardMetricasDiariasSkeleton from '@/app/dashboard/metricas-diarias/loading'
import DashboardNegativacoesSkeleton from '@/app/dashboard/negativacoes/loading'
import DashboardNovidadesSkeleton from '@/app/dashboard/novidades/loading'
import DashboardPropostasSkeleton from '@/app/dashboard/propostas/loading'
import DashboardQuitacoesSkeleton from '@/app/dashboard/quitacoes/loading'
import DashboardRastreamentoSkeleton from '@/app/dashboard/rastreamento/loading'
import DashboardRedeApoioSkeleton from '@/app/dashboard/rede-apoio/loading'
import DashboardSeguroSkeleton from '@/app/dashboard/seguro/loading'
import DashboardUsuariosSkeleton from '@/app/dashboard/usuarios/loading'
import DashboardVeiculosSkeleton from '@/app/dashboard/veiculos/loading'
import GoogleAgendaConectadoSkeleton from '@/app/google-agenda/conectado/loading'
import VeiculosIdSkeleton from '@/app/veiculos/[id]/loading'
import PublicHomeSkeleton from '@/app/(public-home)/loading'
import EstoqueSkeleton from '@/app/estoque/loading'
import AnuncieSeuVeiculoSkeleton from '@/app/anuncie-seu-veiculo/loading'
import DashboardSkeleton from '@/app/dashboard/loading'
import EntrarDispositivoSkeleton from '@/app/entrar-dispositivo/loading'
import EntrarLoading from '@/app/entrar/loading'
import LoginSkeleton from '@/app/login/loading'
import MapaRastreamentoSkeleton from '@/app/mapa-rastreamento/loading'

// Os caminhos mais especificos precedem os skeletons herdados de cada secao.
const routeSkeletons = [
    { route: '/dashboard/propostas/registros/[id]/editar', Component: DashboardPropostasRegistrosIdEditarSkeleton },
    { route: '/dashboard/contratos/gerar/[modelo]', Component: DashboardContratosGerarModeloSkeleton },
    { route: '/dashboard/contratos/gerar', Component: DashboardContratosGerarSkeleton },
    { route: '/dashboard/propostas/nova', Component: DashboardPropostasNovaSkeleton },
    { route: '/dashboard/propostas/registros', Component: DashboardPropostasRegistrosSkeleton },
    { route: '/dashboard/propostas/site', Component: DashboardPropostasSiteSkeleton },
    { route: '/dashboard/agenda', Component: DashboardAgendaSkeleton },
    { route: '/dashboard/analytics', Component: DashboardAnalyticsSkeleton },
    { route: '/dashboard/anuncios', Component: DashboardAnunciosSkeleton },
    { route: '/dashboard/checklist-pos-compra', Component: DashboardChecklistPosCompraSkeleton },
    { route: '/dashboard/cobrancas', Component: DashboardCobrancasSkeleton },
    { route: '/dashboard/consulta-fipe', Component: DashboardConsultaFipeSkeleton },
    { route: '/dashboard/contratos', Component: DashboardContratosSkeleton },
    { route: '/dashboard/demandas', Component: DashboardDemandasSkeleton },
    { route: '/dashboard/feedback', Component: DashboardFeedbackSkeleton },
    { route: '/dashboard/financeiro', Component: DashboardFinanceiroSkeleton },
    { route: '/dashboard/interesses', Component: DashboardInteressesSkeleton },
    { route: '/dashboard/juridico', Component: DashboardJuridicoSkeleton },
    { route: '/dashboard/leads', Component: DashboardLeadsSkeleton },
    { route: '/dashboard/manutencao', Component: DashboardManutencaoSkeleton },
    { route: '/dashboard/metas', Component: DashboardMetasSkeleton },
    { route: '/dashboard/metricas-diarias', Component: DashboardMetricasDiariasSkeleton },
    { route: '/dashboard/negativacoes', Component: DashboardNegativacoesSkeleton },
    { route: '/dashboard/novidades', Component: DashboardNovidadesSkeleton },
    { route: '/dashboard/propostas', Component: DashboardPropostasSkeleton },
    { route: '/dashboard/quitacoes', Component: DashboardQuitacoesSkeleton },
    { route: '/dashboard/rastreamento', Component: DashboardRastreamentoSkeleton },
    { route: '/dashboard/rede-apoio', Component: DashboardRedeApoioSkeleton },
    { route: '/dashboard/seguro', Component: DashboardSeguroSkeleton },
    { route: '/dashboard/usuarios', Component: DashboardUsuariosSkeleton },
    { route: '/dashboard/veiculos', Component: DashboardVeiculosSkeleton },
    { route: '/google-agenda/conectado', Component: GoogleAgendaConectadoSkeleton },
    { route: '/veiculos/[id]', Component: VeiculosIdSkeleton },
    { route: '/', Component: PublicHomeSkeleton },
    { route: '/estoque', Component: EstoqueSkeleton },
    { route: '/anuncie-seu-veiculo', Component: AnuncieSeuVeiculoSkeleton },
    { route: '/dashboard', Component: DashboardSkeleton },
    { route: '/entrar-dispositivo', Component: EntrarDispositivoSkeleton },
    { route: '/login', Component: LoginSkeleton },
    { route: '/mapa-rastreamento', Component: MapaRastreamentoSkeleton },
]

/** Usa o skeleton da rota mesmo enquanto o layout autenticado ainda carrega. */
export default function Loading() {
  const pathname = usePathname() ?? ''
  if (pathname === '/entrar') return <EntrarLoading />
  if (pathname === '/area-do-cliente' || pathname.startsWith('/area-do-cliente/')) return <SkeletonPortal />
  const segments = pathname.split('/').filter(Boolean)
  const Component = routeSkeletons.find(({ route }) => {
    if (route === '/') return pathname === '/'
    const pattern = route.split('/').filter(Boolean)
    return pattern.length <= segments.length && pattern.every((part, i) => part.startsWith('[') || part === segments[i])
  })?.Component
  const content = Component ? <Component /> : <SkeletonPage><SkeletonHeader /><Skeleton className="h-60 w-full rounded-xl" /></SkeletonPage>

  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return (
      <div className="flex h-dvh overflow-hidden bg-neutral-50 adobe-dark:bg-adobe-bg-1" aria-busy="true" aria-label="Carregando sistema">
        <aside aria-hidden="true" className="hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-white md:flex adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-0">
          <div className="shrink-0 border-b border-neutral-200 px-4 py-5 adobe-dark:border-adobe-line"><Skeleton className="h-14 w-32" /></div>
          <div className="min-h-0 flex-1 space-y-3 overflow-hidden px-3 py-4">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
          </div>
          <div className="shrink-0 space-y-3 border-t border-neutral-200 p-4 adobe-dark:border-adobe-line">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto px-4 py-8 md:px-8"><div className="mx-auto max-w-7xl">{content}</div></div>
      </div>
    )
  }

  return content
}

import { Skeleton } from '@/app/components/ui'

/** Mapa de rastreamento: tela cheia com a barra de título por cima. */
export default function MapaRastreamentoLoading() {
  return (
    <div className="relative min-h-screen w-full" aria-busy="true" aria-label="Carregando">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="absolute left-4 top-4 flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  )
}

import { Skeleton } from '@/app/components/ui'

export default function GeradorPropostaLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,38%)_minmax(0,1fr)]">
        {/* Lista */}
        <div className="flex flex-col rounded-xl border border-neutral-200 bg-neutral-50/40 overflow-hidden">
          <div className="border-b border-neutral-200 bg-white p-3 space-y-3">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="divide-y divide-neutral-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2 w-1/3" />
              </div>
            ))}
          </div>
        </div>

        {/* Detalhe */}
        <div className="flex flex-col rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="space-y-2 border-b border-neutral-100 pb-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-4 space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

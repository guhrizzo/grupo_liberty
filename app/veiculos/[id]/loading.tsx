import { Skeleton } from '../../components/ui'

export default function VeiculoDetalheLoading() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 space-y-6">
        <Skeleton className="h-3 w-40" />
        <div className="grid gap-8 lg:grid-cols-3 items-start">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="aspect-16/9 w-full rounded-2xl" />
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-2/3" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

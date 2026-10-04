import { Skeleton } from '../../components/ui'

export default function MetricasDiariasLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3 w-80" />
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

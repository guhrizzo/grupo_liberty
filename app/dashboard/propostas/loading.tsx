import { Skeleton } from '../../components/ui'

export default function PropostasLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3 w-80" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

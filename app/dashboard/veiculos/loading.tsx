import { Skeleton, SkeletonCard } from '../../components/ui'

export default function VeiculosLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}

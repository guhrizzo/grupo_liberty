import { Skeleton, SkeletonCard, SkeletonTableRow } from '../components/ui'

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div>
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  )
}

// Re-exporta para uso em sub-rotas
export { SkeletonCard, SkeletonTableRow }

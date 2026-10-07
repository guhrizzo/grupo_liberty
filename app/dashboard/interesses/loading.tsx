import { Skeleton } from '../../components/ui'

export default function InteressesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-3 w-80" />
      </div>
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
      ))}
    </div>
  )
}

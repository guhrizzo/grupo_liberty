import { Skeleton, SkeletonTableRow } from '../../components/ui'

export default function JuridicoLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              {Array.from({ length: 6 }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonTableRow key={i} cols={6} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

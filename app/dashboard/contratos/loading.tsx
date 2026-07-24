import { Skeleton, SkeletonTableRow } from '../../components/ui'

export default function ContratosLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3 w-80" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonTableRow key={i} cols={5} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

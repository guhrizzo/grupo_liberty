import { Skeleton, SkeletonTableRow } from '../../components/ui'

export default function UsuariosLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-56" />
      </div>
      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <Skeleton className="h-5 w-48 mb-6" />
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-8">
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <Skeleton className="h-5 w-56 mb-6" />
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <th key={i} className="px-4 py-3">
                      <Skeleton className="h-3 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonTableRow key={i} cols={4} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

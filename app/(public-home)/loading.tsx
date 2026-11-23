import { Skeleton } from '@/app/components/ui'

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Carregando">
      <section aria-hidden className="bg-[#0b111d]">
        <div className="mx-auto grid max-w-7xl lg:grid-cols-[43%_57%]">
          <div className="space-y-5 px-4 pt-12 md:px-8 md:pt-20 lg:pb-16">
            <Skeleton className="h-3 w-32 bg-slate-700!" />
            <Skeleton className="h-14 w-full max-w-sm bg-slate-700! lg:h-20" />
            <Skeleton className="h-14 w-4/5 max-w-xs bg-slate-700! lg:h-20" />
            <Skeleton className="h-4 w-4/5 max-w-xs bg-slate-700!" />
            <div className="flex flex-wrap gap-2 pt-2">
              <Skeleton className="h-12 w-40 bg-slate-700!" />
              <Skeleton className="h-12 w-36 bg-slate-700!" />
            </div>
            <Skeleton className="h-5 w-2/3 max-w-64 bg-slate-700!" />
          </div>
          <Skeleton className="aspect-[16/10] min-h-48 w-full rounded-none bg-slate-900! lg:min-h-[34rem] lg:aspect-auto" />
          <div className="mx-4 border-t border-slate-700 py-4 md:mx-8 lg:col-span-2">
            <Skeleton className="h-5 w-48 bg-slate-700!" />
          </div>
        </div>
      </section>
      <div aria-hidden className="bg-[#111c2c]">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
          <Skeleton className="h-8 w-48 bg-slate-700!" />
        </div>
      </div>
    </main>
  )
}

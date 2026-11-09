import { Skeleton } from '@/app/components/ui'

/** Login: cartão centralizado com logo, campos e botão. */
export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6 adobe-dark:bg-adobe-bg-1" aria-busy="true">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <Skeleton className="mx-auto h-12 w-40" />
        <Skeleton className="mx-auto h-4 w-56" />
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  )
}

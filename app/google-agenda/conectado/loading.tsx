import { Skeleton } from '@/app/components/ui'

/** Retorno do Google Agenda: cartão de confirmação centralizado. */
export default function GoogleAgendaConectadoLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6 adobe-dark:bg-adobe-bg-1" aria-busy="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <Skeleton className="mx-auto h-14 w-14 rounded-full" />
        <Skeleton className="mx-auto h-6 w-56" />
        <Skeleton className="mx-auto h-4 w-64" />
        <Skeleton className="mx-auto h-11 w-40 rounded-xl" />
      </div>
    </div>
  )
}

/** Fallback compartilhado enquanto o layout da rota carrega. */
export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 adobe-dark:bg-adobe-bg-1" role="status" aria-label="Carregando" aria-busy="true">
      <span aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-liberty motion-reduce:animate-none adobe-dark:border-adobe-line adobe-dark:border-t-adobe-accent" />
      <span className="sr-only">Carregando...</span>
    </div>
  )
}

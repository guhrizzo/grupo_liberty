import { IconLoader2 } from '@tabler/icons-react'

export default function EntrarLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-neutral-50 adobe-dark:bg-adobe-bg-1" role="status">
      <IconLoader2 aria-hidden="true" size={32} className="text-liberty-deep motion-safe:animate-spin adobe-dark:text-adobe-accent-soft" />
      <span className="sr-only">Carregando opções de acesso</span>
    </div>
  )
}

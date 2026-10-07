import Link from 'next/link'

export type AbaDemandas = 'tarefas' | 'lembretes'

const ABAS: { id: AbaDemandas; label: string; href: string }[] = [
  { id: 'tarefas', label: 'Tarefas', href: '/dashboard/demandas' },
  { id: 'lembretes', label: 'Lembretes ao CEO', href: '/dashboard/demandas?aba=lembretes' },
]

/** Seletor de abas da página Demandas (a aba ativa vem da URL). */
export default function AbasDemandas({ ativa }: { ativa: AbaDemandas }) {
  return (
    <nav
      aria-label="Abas de Demandas"
      className="mb-4 flex w-fit max-w-full items-center gap-1.5 overflow-x-auto rounded-lg border border-neutral-200 bg-white p-1 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2"
    >
      {ABAS.map((a) => (
        <Link
          key={a.id}
          href={a.href}
          aria-current={ativa === a.id ? 'page' : undefined}
          className={
            'shrink-0 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ' +
            (ativa === a.id
              ? 'bg-liberty text-white shadow-xs'
              : 'text-neutral-600 hover:bg-neutral-100 adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-3')
          }
        >
          {a.label}
        </Link>
      ))}
    </nav>
  )
}

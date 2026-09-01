import { IconSparkles, IconArrowUpRight, IconBug } from '@tabler/icons-react'
import { formatDate } from '@/utils/format'
import type { ChangelogEntry, ChangelogTag } from '@/constants/changelog'

const TAG_META: Record<
  ChangelogTag,
  { label: string; classes: string; Icon: typeof IconSparkles }
> = {
  novo: {
    label: 'Novo',
    classes: 'border-liberty/30 bg-liberty/10 text-liberty-deep',
    Icon: IconSparkles,
  },
  melhoria: {
    label: 'Melhoria',
    classes: 'border-sky-200 bg-sky-50 text-sky-700',
    Icon: IconArrowUpRight,
  },
  correcao: {
    label: 'Correção',
    classes: 'border-amber-200 bg-amber-50 text-amber-700',
    Icon: IconBug,
  },
}

/** Apresentação de uma entrada do changelog. Sem estado — usado no modal e na página. */
export function ChangelogEntryItem({ entry }: { entry: ChangelogEntry }) {
  const meta = TAG_META[entry.tag]
  const Icon = meta.Icon

  return (
    <article className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ' +
            meta.classes
          }
        >
          <Icon size={11} stroke={2.5} />
          {meta.label}
        </span>
        <span className="text-[11px] font-medium text-neutral-400">
          {formatDate(entry.date)}
        </span>
      </div>

      <h3 className="mt-2 text-sm font-bold text-neutral-950">{entry.title}</h3>

      {entry.items.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {entry.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-neutral-600">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-300" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

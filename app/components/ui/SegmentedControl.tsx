import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

/** Visual único dos seletores em "pílulas" (abas e filtros): o mesmo das abas do Financeiro. */
export const SEGMENTED_WRAPPER =
  'inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2'

export function segmentedItemClass(active: boolean) {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold transition-colors cursor-pointer',
    active
      ? 'bg-neutral-950 text-white adobe-dark:bg-adobe-accent adobe-dark:text-[#0a1720]'
      : 'text-neutral-600 hover:bg-neutral-100 adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-3',
  )
}

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  title?: string
}

/** Grupo de botões exclusivos (filtro/visualização). Para abas com link, use as classes exportadas acima. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn(SEGMENTED_WRAPPER, className)}>
      {options.map((o) => (
        <button
          key={o.value || 'todos'}
          type="button"
          title={o.title}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={segmentedItemClass(value === o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

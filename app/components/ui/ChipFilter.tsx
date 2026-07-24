import { cn } from '@/utils/cn'

export interface ChipFilterOption<T extends string> {
  value: T
  label: string
}

export function ChipFilter<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: {
  options: readonly T[] | ChipFilterOption<T>[]
  value: T
  onChange: (v: T) => void
  label?: string
  className?: string
  size?: 'sm' | 'md'
}) {
  const list: ChipFilterOption<T>[] = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  )
  return (
    <div className={cn('flex flex-wrap gap-1.5 items-center', className)}>
      {label && (
        <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-text-lo dark:text-neutral-400 mr-1">
          {label}
        </span>
      )}
      {list.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              'rounded-lg font-semibold transition-all cursor-pointer',
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              active
                ? 'bg-liberty text-white shadow-sm shadow-liberty/30'
                : 'bg-[var(--color-bg-2)] dark:bg-neutral-100 text-text-md dark:text-neutral-700 border border-[var(--color-line)] dark:border-neutral-200 hover:bg-[var(--color-bg-3)] dark:hover:bg-neutral-200',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

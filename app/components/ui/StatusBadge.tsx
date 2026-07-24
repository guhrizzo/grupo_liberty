import { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'liberty'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  liberty: 'bg-liberty/10 text-liberty-deep border-liberty/30',
}

export interface StatusBadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
  /** Tamanho do texto. */
  size?: 'xs' | 'sm'
}

export function StatusBadge({ tone = 'neutral', children, className, size = 'xs' }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-extrabold uppercase tracking-wider',
        size === 'sm' ? 'text-[11px] px-2.5 py-0.5' : 'text-[10px] px-2.5 py-0.5',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

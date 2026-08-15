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
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200 adobe-dark:bg-adobe-bg-3 adobe-dark:text-adobe-text-md adobe-dark:border-adobe-line',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 adobe-dark:bg-emerald-500/15 adobe-dark:text-emerald-300 adobe-dark:border-emerald-500/30',
  warning: 'bg-amber-50 text-amber-800 border-amber-200 adobe-dark:bg-amber-500/15 adobe-dark:text-amber-300 adobe-dark:border-amber-500/30',
  danger: 'bg-rose-50 text-rose-700 border-rose-200 adobe-dark:bg-rose-500/15 adobe-dark:text-rose-300 adobe-dark:border-rose-500/30',
  info: 'bg-sky-50 text-sky-700 border-sky-200 adobe-dark:bg-sky-500/15 adobe-dark:text-sky-300 adobe-dark:border-sky-500/30',
  liberty: 'bg-liberty/10 text-liberty-deep border-liberty/30 adobe-dark:bg-adobe-accent/15 adobe-dark:text-adobe-accent-soft adobe-dark:border-adobe-accent/30',
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

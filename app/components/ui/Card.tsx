import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border border-neutral-200 bg-white shadow-xs transition-shadow neon-theme:border-[var(--color-line)] neon-theme:bg-[var(--color-bg-1)]',
          className,
        )}
        {...rest}
      />
    )
  },
)

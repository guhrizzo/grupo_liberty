'use client'

import { forwardRef, SelectHTMLAttributes, useId } from 'react'
import { cn } from '@/utils/cn'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  containerClassName?: string
  options?: { value: string; label: string }[]
  children?: React.ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    hint,
    error,
    className,
    containerClassName,
    id,
    options,
    children,
    ...rest
  },
  ref,
) {
  const reactId = useId()
  const inputId = id ?? `sel-${reactId}`
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 neon-theme:text-text-lo mb-1.5"
        >
          {label}
        </label>
      )}
      <select
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(errorId, hintId) || undefined}
        className={cn(
          'w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all cursor-pointer appearance-none',
          'focus:outline-none focus:border-liberty focus:ring-2 focus:ring-liberty/20',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          // light (default)
          'bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300',
          // dark (neon-theme)
          'neon-theme:bg-[var(--color-bg-2)] neon-theme:text-text-hi neon-theme:border-[var(--color-line)]',
          error
            ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
            : '',
          className,
        )}
        {...rest}
      >
        {options
          ? options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          : children}
      </select>
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs font-semibold text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-neutral-500 neon-theme:text-text-lo">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

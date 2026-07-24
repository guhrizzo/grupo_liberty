'use client'

import { forwardRef, TextareaHTMLAttributes, useId } from 'react'
import { cn } from '@/utils/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  containerClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, containerClassName, id, ...rest },
  ref,
) {
  const reactId = useId()
  const inputId = id ?? `ta-${reactId}`
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-text-lo dark:text-neutral-400 mb-1.5"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(errorId, hintId) || undefined}
        className={cn(
          'w-full rounded-xl border bg-[var(--color-bg-2)] dark:bg-white px-3.5 py-2.5 text-sm text-text-hi dark:text-neutral-900 placeholder:text-text-lo dark:placeholder:text-neutral-400 transition-all',
          'focus:outline-none focus:border-liberty focus:ring-2 focus:ring-liberty/20',
          'disabled:opacity-60 disabled:cursor-not-allowed resize-none',
          error
            ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
            : 'border-[var(--color-line)] dark:border-neutral-200',
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs font-semibold text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-text-lo dark:text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

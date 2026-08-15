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
          className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 neon-theme:text-text-lo adobe-dark:text-adobe-text-lo mb-1.5"
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
          'w-full rounded-xl border px-3.5 py-2.5 text-sm transition-[border-color,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] resize-none',
          'placeholder:text-neutral-400 neon-theme:placeholder:text-text-lo adobe-dark:placeholder:text-adobe-text-lo',
          'focus:outline-none focus:border-liberty focus:ring-2 focus:ring-liberty/20',
          'adobe-dark:focus:border-adobe-accent adobe-dark:focus:ring-adobe-accent/20',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          // light (default)
          'bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300',
          // dark (neon-theme)
          'neon-theme:bg-[var(--color-bg-2)] neon-theme:text-text-hi neon-theme:border-[var(--color-line)]',
          // dark (adobe-dark — dashboard escuro)
          'adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-hi adobe-dark:border-adobe-line adobe-dark:hover:border-adobe-bg-4',
          error
            ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
            : '',
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs font-semibold text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-neutral-500 neon-theme:text-text-lo adobe-dark:text-adobe-text-lo">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

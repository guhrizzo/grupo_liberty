'use client'

import { forwardRef, InputHTMLAttributes, ReactNode, useId } from 'react'
import { cn } from '@/utils/cn'
import { MaskName, MASKS } from '@/utils/masks'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leftIcon?: ReactNode
  rightAdornment?: ReactNode
  /** Aplica máscara enquanto digita. Use `displayTransform` se precisar converter. */
  mask?: MaskName
  /** Converte o valor exibido (formatado) antes de chamar onChange. */
  displayTransform?: (formatted: string) => string
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leftIcon,
    rightAdornment,
    mask,
    displayTransform,
    className,
    containerClassName,
    id,
    onChange,
    ...rest
  },
  ref,
) {
  const reactId = useId()
  const inputId = id ?? `input-${reactId}`
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
      <div className="relative">
        {leftIcon && (
          <span
            aria-hidden
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-lo dark:text-neutral-500 pointer-events-none"
          >
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(errorId, hintId) || undefined}
          onChange={(e) => {
            if (mask) {
              const formatted = MASKS[mask](e.target.value)
              const out = displayTransform ? displayTransform(formatted) : formatted
              e.target.value = out
            }
            onChange?.(e)
          }}
          className={cn(
            'w-full rounded-xl border bg-[var(--color-bg-2)] dark:bg-[var(--color-bg-2)] text-sm text-text-hi dark:text-white placeholder:text-text-lo dark:placeholder:text-neutral-500 transition-all',
            'focus:outline-none focus:border-liberty focus:ring-2 focus:ring-liberty/20',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            leftIcon ? 'pl-10' : 'pl-3.5',
            rightAdornment ? 'pr-12' : 'pr-3.5',
            'py-2.5',
            error
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
              : 'border-[var(--color-line)] dark:border-neutral-200',
            className,
          )}
          {...rest}
        />
        {rightAdornment && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            {rightAdornment}
          </div>
        )}
      </div>
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

'use client'

import React, {
  forwardRef,
  SelectHTMLAttributes,
  useId,
  useState,
  useRef,
  useEffect,
  useMemo,
  ReactNode,
} from 'react'
import { IconChevronDown, IconCheck } from '@tabler/icons-react'
import { cn } from '@/utils/cn'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string
  hint?: string
  error?: string
  placeholder?: string
  containerClassName?: string
  options?: SelectOption[]
  children?: ReactNode
}

/**
 * Converte children (<option value="...">label</option>) em uma lista de objetos SelectOption.
 */
function parseChildrenToOptions(children?: ReactNode): SelectOption[] {
  if (!children) return []
  const opts: SelectOption[] = []

  React.Children.forEach(children, (child) => {
    if (
      React.isValidElement<{ value?: unknown; children?: ReactNode }>(child) &&
      child.type === 'option'
    ) {
      const value = String(child.props.value ?? '')
      const label =
        typeof child.props.children === 'string'
          ? child.props.children
          : String(child.props.children ?? value)
      opts.push({ value, label })
    }
  })

  return opts
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    hint,
    error,
    className,
    containerClassName,
    id,
    options: providedOptions,
    children,
    value: controlledValue,
    defaultValue,
    onChange,
    disabled,
    name,
    placeholder,
    ...rest
  },
  ref,
) {
  const reactId = useId()
  const inputId = id ?? `sel-${reactId}`
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined

  // Extrai lista de opções unificada (seja via prop `options` ou via `<option>` `children`)
  const options = useMemo(() => {
    if (providedOptions && providedOptions.length > 0) {
      return providedOptions
    }
    return parseChildrenToOptions(children)
  }, [providedOptions, children])

  // Estado interno para controle da seleção
  const [internalValue, setInternalValue] = useState<string>(() => {
    if (controlledValue !== undefined) return String(controlledValue)
    if (defaultValue !== undefined) return String(defaultValue)
    return options[0]?.value ?? ''
  })

  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hiddenSelectRef = useRef<HTMLSelectElement | null>(null)

  // Sincroniza valor controlado quando mudar externamente
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(String(controlledValue))
    }
  }, [controlledValue])

  const currentValue = controlledValue !== undefined ? String(controlledValue) : internalValue

  // Encontra a opção selecionada
  const selectedOption = options.find((o) => o.value === currentValue) ?? options[0]

  // Fecha o dropdown ao clicar fora ou ao pressionar ESC
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Trata a escolha de uma opção
  const handleSelectOption = (optValue: string) => {
    setInternalValue(optValue)
    setIsOpen(false)

    // Notifica formulários / handlers do React através do elemento select oculto
    if (hiddenSelectRef.current) {
      hiddenSelectRef.current.value = optValue

      // Dispara evento sintético de Change
      const event = new Event('change', { bubbles: true })
      hiddenSelectRef.current.dispatchEvent(event)
    }

    if (onChange) {
      const syntheticEvent = {
        target: { value: optValue, name: name ?? '' },
        currentTarget: { value: optValue, name: name ?? '' },
      } as React.ChangeEvent<HTMLSelectElement>
      onChange(syntheticEvent)
    }
  }

  return (
    <div className={cn('w-full', containerClassName)} ref={containerRef}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 neon-theme:text-text-lo mb-1.5"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {/* Select Nativo Oculto para Formulários e Accesibilidade */}
        <select
          id={inputId}
          ref={(e) => {
            hiddenSelectRef.current = e
            if (typeof ref === 'function') ref(e)
            else if (ref) ref.current = e
          }}
          name={name}
          disabled={disabled}
          value={currentValue}
          onChange={(e) => handleSelectOption(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(errorId, hintId) || undefined}
          className="sr-only"
          tabIndex={-1}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Gatilho Visível Estilizado */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            // base
            'w-full flex items-center justify-between gap-2 rounded-xl border text-sm font-semibold transition-[border-color,box-shadow,background-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer py-2.5 px-3.5 text-left',
            'focus:outline-none focus:ring-4',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            // tema claro (Dashboard e padrão)
            'bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300 hover:shadow-sm focus:border-liberty focus:ring-liberty/15',
            'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
            // tema escuro (neon-theme - site público)
            'neon-theme:bg-[var(--color-bg-2)] neon-theme:text-text-hi neon-theme:border-[var(--color-line)]',
            'neon-theme:hover:border-[var(--color-neon)]/50 neon-theme:hover:shadow-[0_0_15px_-3px_rgba(0,212,255,0.15)]',
            'neon-theme:focus:border-[var(--color-neon)] neon-theme:focus:ring-[rgba(0,212,255,0.18)]',
            // erro
            error
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
              : '',
            isOpen &&
              'border-liberty ring-4 ring-liberty/15 neon-theme:border-[var(--color-neon)] neon-theme:ring-[rgba(0,212,255,0.18)]',
            className,
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder ?? 'Selecione...'}
          </span>
          <IconChevronDown
            size={18}
            className={cn(
              'shrink-0 text-neutral-400 transition-transform duration-300 ease-out',
              'neon-theme:text-text-lo',
              isOpen && 'rotate-180 text-liberty neon-theme:text-neon-soft',
            )}
          />
        </button>

        {/* Dropdown Flutuante Estilizado */}
        {isOpen && (
          <div
            className={cn(
              'absolute left-0 right-0 top-full mt-1.5 z-50 max-h-60 overflow-y-auto rounded-xl border p-1 shadow-xl',
              'animate-zoom-in-95 backdrop-blur-md',
              // tema claro
              'bg-white/95 border-neutral-200 text-neutral-800 shadow-neutral-900/10',
              // tema escuro
              'neon-theme:bg-[var(--color-bg-1)]/95 neon-theme:border-[var(--color-line)] neon-theme:text-text-hi neon-theme:shadow-black/50',
            )}
          >
            {options.map((opt) => {
              const isSelected = opt.value === currentValue
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelectOption(opt.value)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold rounded-lg text-left transition-ui-fast cursor-pointer',
                    // tema claro
                    isSelected
                      ? 'bg-liberty/10 text-liberty-deep font-extrabold'
                      : 'hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900',
                    // tema escuro
                    'neon-theme:hover:bg-[var(--color-bg-3)] neon-theme:hover:text-white',
                    isSelected &&
                      'neon-theme:bg-[var(--color-neon)]/15 neon-theme:text-neon-soft neon-theme:font-extrabold',
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <IconCheck
                      size={14}
                      className="shrink-0 text-liberty neon-theme:text-neon-soft"
                    />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

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

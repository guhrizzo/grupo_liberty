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
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { IconChevronDown, IconCheck } from '@tabler/icons-react'
import { cn } from '@/utils/cn'
import styles from './Select.module.css'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string
  hint?: string
  error?: string
  placeholder?: string
  containerClassName?: string
  options?: readonly SelectOption[]
  temaPortal?: boolean
  children?: ReactNode
}

/**
 * Converte children (<option value="...">label</option>) em uma lista de objetos SelectOption.
 */
/** Altura máxima da lista de opções (px) — equivale a `max-h-60`. */
const DROPDOWN_MAX = 240

function parseChildrenToOptions(children?: ReactNode): SelectOption[] {
  if (!children) return []
  const opts: SelectOption[] = []

  React.Children.forEach(children, (child) => {
    if (
      React.isValidElement<{ value?: unknown; children?: ReactNode; disabled?: boolean }>(child) &&
      child.type === 'option'
    ) {
      const value = String(child.props.value ?? '')
      const label =
        typeof child.props.children === 'string'
          ? child.props.children
          : String(child.props.children ?? value)
      opts.push({ value, label, disabled: child.props.disabled })
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
    temaPortal,
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
  const listId = `${inputId}-opcoes`
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
  const [indiceAtivo, setIndiceAtivo] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // O dropdown vai num portal com posição fixa para não ser cortado por modais com rolagem.
  // Abre para baixo; sem espaço embaixo (select no fim da página), abre para cima.
  const [pos, setPos] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
    maxHeight: number
  } | null>(null)
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
      const alvo = e.target as Node
      if (containerRef.current?.contains(alvo) || dropdownRef.current?.contains(alvo)) return
      setIsOpen(false)
    }
    const reposicionar = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const folga = 6 // distância do botão
      const borda = 12 // distância da borda da janela
      const abaixo = window.innerHeight - r.bottom - folga - borda
      const acima = r.top - folga - borda
      // Altura estimada da lista (cada opção ~34px + padding), limitada ao máximo.
      const estimada = Math.min(DROPDOWN_MAX, options.length * 34 + 10)
      if (estimada > abaixo && acima > abaixo) {
        setPos({
          bottom: window.innerHeight - r.top + folga,
          left: r.left,
          width: r.width,
          maxHeight: Math.min(DROPDOWN_MAX, acima),
        })
      } else {
        setPos({
          top: r.bottom + folga,
          left: r.left,
          width: r.width,
          maxHeight: Math.min(DROPDOWN_MAX, Math.max(abaixo, 96)),
        })
      }
    }
    reposicionar()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', reposicionar)
    window.addEventListener('scroll', reposicionar, true)
    return () => {
      window.removeEventListener('resize', reposicionar)
      window.removeEventListener('scroll', reposicionar, true)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, options.length])

  useEffect(() => {
    if (isOpen && pos && indiceAtivo >= 0) {
      dropdownRef.current?.querySelectorAll('[role="option"]')[indiceAtivo]?.scrollIntoView({ block: 'nearest' })
    }
  }, [isOpen, pos, indiceAtivo])

  function abrir() {
    const selecionado = options.findIndex((opcao) => opcao.value === currentValue && !opcao.disabled)
    setIndiceAtivo(selecionado >= 0 ? selecionado : options.findIndex((opcao) => !opcao.disabled))
    setIsOpen(true)
  }

  function teclado(evento: ReactKeyboardEvent<HTMLButtonElement>) {
    if (evento.key === 'Tab' || evento.key === 'Escape') {
      if (evento.key === 'Escape' && isOpen) {
        evento.preventDefault()
        evento.stopPropagation()
      }
      setIsOpen(false)
      return
    }

    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(evento.key)) {
      evento.preventDefault()
      if (!isOpen) abrir()
      const disponiveis = options.flatMap((opcao, i) => opcao.disabled ? [] : [i])
      if (evento.key === 'Home') setIndiceAtivo(disponiveis[0] ?? -1)
      else if (evento.key === 'End') setIndiceAtivo(disponiveis.at(-1) ?? -1)
      else if (isOpen) {
        const delta = evento.key === 'ArrowDown' ? 1 : -1
        const indice = Math.max(0, Math.min(disponiveis.length - 1, disponiveis.indexOf(indiceAtivo) + delta))
        setIndiceAtivo(disponiveis[indice] ?? -1)
      }
      return
    }

    if (isOpen && (evento.key === 'Enter' || evento.key === ' ')) {
      evento.preventDefault()
      const opcao = options[indiceAtivo]
      if (opcao && !opcao.disabled) handleSelectOption(opcao.value)
    }
  }

  // Trata a escolha de uma opção
  const handleSelectOption = (optValue: string) => {
    setInternalValue(optValue)
    setIsOpen(false)
    triggerRef.current?.focus()

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
          htmlFor={`${inputId}-gatilho`}
          className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 neon-theme:text-text-lo adobe-dark:text-adobe-text-lo mb-1.5"
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
          aria-hidden="true"
          tabIndex={-1}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Gatilho Visível Estilizado */}
        <button
          ref={triggerRef}
          id={`${inputId}-gatilho`}
          role="combobox"
          aria-label={rest['aria-label'] ?? label}
          aria-describedby={cn(errorId, hintId) || undefined}
          aria-invalid={error ? true : undefined}
          aria-controls={isOpen && pos ? listId : undefined}
          aria-expanded={isOpen}
          aria-activedescendant={isOpen && pos && indiceAtivo >= 0 ? `${listId}-${indiceAtivo}` : undefined}
          type="button"
          disabled={disabled}
          onClick={() => isOpen ? setIsOpen(false) : abrir()}
          onKeyDown={teclado}
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
            // dark mode dashboard (estilo Adobe)
            'adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-hi adobe-dark:border-adobe-line',
            'adobe-dark:hover:border-adobe-bg-4 adobe-dark:hover:shadow-none',
            'adobe-dark:focus:border-adobe-accent adobe-dark:focus:ring-adobe-accent/15',
            // erro
            error
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
              : '',
            isOpen &&
              'border-liberty ring-4 ring-liberty/15 neon-theme:border-[var(--color-neon)] neon-theme:ring-[rgba(0,212,255,0.18)] adobe-dark:border-adobe-accent adobe-dark:ring-adobe-accent/15',
            styles.gatilho,
            temaPortal && styles.portal,
            className,
          )}
        >
          <span className="truncate" data-vazio={currentValue === ''}>
            {selectedOption ? selectedOption.label : placeholder ?? 'Selecione...'}
          </span>
          <IconChevronDown
            size={18}
            className={cn(
              'shrink-0 text-neutral-400 transition-transform duration-300 ease-out',
              'neon-theme:text-text-lo adobe-dark:text-adobe-text-lo',
              isOpen && 'rotate-180 text-liberty neon-theme:text-neon-soft adobe-dark:text-adobe-accent-soft',
            )}
          />
        </button>

        {/* Dropdown Flutuante Estilizado */}
        {isOpen && pos && createPortal(
          <div
            ref={dropdownRef}
            id={listId}
            role="listbox"
            aria-label={rest['aria-label'] ?? label}
            style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
            className={cn(
              'z-[100] max-h-60 overflow-y-auto rounded-xl border p-1 shadow-xl',
              styles.lista,
              temaPortal && styles.portal,
              'animate-zoom-in-95 backdrop-blur-md',
              // tema claro
              'bg-white/95 border-neutral-200 text-neutral-800 shadow-neutral-900/10',
              // tema escuro
              'neon-theme:bg-[var(--color-bg-1)]/95 neon-theme:border-[var(--color-line)] neon-theme:text-text-hi neon-theme:shadow-black/50',
              // dark mode dashboard (estilo Adobe)
              'adobe-dark:bg-adobe-bg-2/95 adobe-dark:border-adobe-line adobe-dark:text-adobe-text-hi adobe-dark:shadow-black/50',
            )}
          >
            {options.map((opt, indice) => {
              const isSelected = opt.value === currentValue
              return (
                <button
                  key={opt.value}
                  id={`${listId}-${indice}`}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  data-ativo={indice === indiceAtivo}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => handleSelectOption(opt.value)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold rounded-lg text-left transition-ui-fast cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed',
                    // tema claro
                    isSelected
                      ? 'bg-liberty/10 text-liberty-deep font-extrabold'
                      : 'hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900',
                    // tema escuro
                    'neon-theme:hover:bg-[var(--color-bg-3)] neon-theme:hover:text-white',
                    isSelected &&
                      'neon-theme:bg-[var(--color-neon)]/15 neon-theme:text-neon-soft neon-theme:font-extrabold',
                    // dark mode dashboard (estilo Adobe)
                    'adobe-dark:hover:bg-adobe-bg-3 adobe-dark:hover:text-adobe-text-hi',
                    isSelected &&
                      'adobe-dark:bg-adobe-accent/15 adobe-dark:text-adobe-accent-soft adobe-dark:font-extrabold',
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <IconCheck
                      size={14}
                      className="shrink-0 text-liberty neon-theme:text-neon-soft adobe-dark:text-adobe-accent-soft"
                    />
                  )}
                </button>
              )
            })}
          </div>,
          (temaPortal ? containerRef.current?.closest('[data-tema]') : containerRef.current?.closest('.neon-theme, .adobe-dark')) ?? document.body,
        )}
      </div>

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

'use client'

import {
  KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { IconBuildingBank, IconCheck, IconAlertTriangle } from '@tabler/icons-react'
import { cn } from '@/utils/cn'
import { BANCOS, getBancoByNome, type BancoInfo } from '@/constants/bancos'

export interface BancoAutocompleteProps {
  label?: string
  hint?: string
  error?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  containerClassName?: string
  id?: string
  name?: string
}

export function BancoAutocomplete({
  label = 'Banco / Financeira',
  hint,
  error,
  value,
  onChange,
  placeholder = 'Digite para buscar um banco…',
  containerClassName,
  id,
  name,
}: BancoAutocompleteProps) {
  const reactId = useId()
  const inputId = id ?? `banco-${reactId}`
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined

  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const term = value.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!term) return BANCOS
    return BANCOS.filter((b) => b.nome.toLowerCase().includes(term))
  }, [term])

  const bancoReconhecido = useMemo(() => getBancoByNome(value), [value])

  // Mantém o índice destacado dentro dos limites da lista filtrada atual,
  // sem precisar de um efeito para sincronizar o estado.
  const safeHighlighted =
    filtered.length > 0 ? Math.min(highlighted, filtered.length - 1) : 0

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.children[safeHighlighted] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [safeHighlighted, open])

  const selectBanco = (banco: BancoInfo) => {
    onChange(banco.nome)
    setOpen(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setHighlighted(0)
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(Math.min(safeHighlighted + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(Math.max(safeHighlighted - 1, 0))
    } else if (e.key === 'Enter') {
      if (filtered[safeHighlighted]) {
        e.preventDefault()
        selectBanco(filtered[safeHighlighted])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
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
        <span
          aria-hidden
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 neon-theme:text-text-lo pointer-events-none"
        >
          <IconBuildingBank size={14} />
        </span>

        <input
          id={inputId}
          ref={inputRef}
          name={name}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${inputId}-listbox`}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(errorId, hintId) || undefined}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value)
            setHighlighted(0)
            setOpen(true)
          }}
          onFocus={() => {
            setHighlighted(0)
            setOpen(true)
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full rounded-xl border text-sm transition-[border-color,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] py-2.5 pl-10 pr-9',
            'placeholder:text-neutral-400 neon-theme:placeholder:text-text-lo',
            'focus:outline-none focus:border-liberty focus:ring-4 focus:ring-liberty/15',
            'bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300',
            'neon-theme:bg-[var(--color-bg-2)] neon-theme:text-text-hi neon-theme:border-[var(--color-line)]',
            error
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
              : '',
          )}
        />

        {value.trim() && (
          <span
            aria-hidden
            title={
              bancoReconhecido
                ? `Banco reconhecido · Quitação ${bancoReconhecido.descontoPercent ?? '—'}%`
                : 'Banco não encontrado na tabela — % de quitação não será aplicada automaticamente'
            }
            className={cn(
              'absolute right-3.5 top-1/2 -translate-y-1/2',
              bancoReconhecido ? 'text-emerald-600' : 'text-amber-500',
            )}
          >
            {bancoReconhecido ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
          </span>
        )}

        {open && (
          <div
            id={`${inputId}-listbox`}
            role="listbox"
            className={cn(
              'absolute left-0 right-0 top-full mt-1.5 z-50 max-h-64 overflow-y-auto rounded-xl border p-1 shadow-xl',
              'animate-zoom-in-95 backdrop-blur-md',
              'bg-white/95 border-neutral-200 text-neutral-800 shadow-neutral-900/10',
              'neon-theme:bg-[var(--color-bg-1)]/95 neon-theme:border-[var(--color-line)] neon-theme:text-text-hi neon-theme:shadow-black/50',
            )}
          >
            {filtered.length > 0 ? (
              <div ref={listRef}>
                {filtered.map((b, idx) => {
                  const isHighlighted = idx === safeHighlighted
                  const isSelected = b.nome.toLowerCase() === term
                  return (
                    <button
                      key={b.codigo}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlighted(idx)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectBanco(b)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-3 py-2 text-xs rounded-lg text-left transition-ui-fast cursor-pointer',
                        isHighlighted || isSelected
                          ? 'bg-liberty/10 text-liberty-deep font-extrabold'
                          : 'hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900 font-semibold',
                        'neon-theme:hover:bg-[var(--color-bg-3)] neon-theme:hover:text-white',
                        (isHighlighted || isSelected) &&
                          'neon-theme:bg-[var(--color-neon)]/15 neon-theme:text-neon-soft',
                      )}
                    >
                      <span className="truncate">{b.nome}</span>
                      <span className="shrink-0 text-[10px] font-bold text-neutral-500 neon-theme:text-text-lo">
                        {b.quitacaoPercent != null ? `Quit. ${b.quitacaoPercent}%` : '—'}
                        {b.descontoPercent != null ? ` · Desc. ${b.descontoPercent}%` : ''}
                      </span>
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
            ) : (
              <p className="px-3 py-2.5 text-xs text-neutral-500 neon-theme:text-text-lo">
                Nenhum banco encontrado. Será salvo como texto livre: &quot;{value.trim()}&quot;.
              </p>
            )}
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
      ) : value.trim() ? (
        <p
          className={cn(
            'mt-1.5 text-[11px] font-semibold',
            bancoReconhecido ? 'text-emerald-600' : 'text-amber-600',
          )}
        >
          {bancoReconhecido
            ? `Banco reconhecido · quitação de ${bancoReconhecido.descontoPercent ?? '—'}% usada na Proposta Prévia.`
            : 'Banco não encontrado na tabela — a % de quitação não entrará no cálculo automático.'}
        </p>
      ) : null}
    </div>
  )
}

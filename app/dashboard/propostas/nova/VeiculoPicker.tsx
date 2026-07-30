'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconSearch,
  IconCheck,
  IconX,
  IconCar,
} from '@tabler/icons-react'
import { formatCurrency } from '@/utils/format'
import type { VeiculoResumo } from '../actions'

interface VeiculoPickerProps {
  open: boolean
  onClose: () => void
  veiculos: VeiculoResumo[]
  value: string | null
  onSelect: (id: string) => void
}

export function VeiculoPicker({
  open,
  onClose,
  veiculos,
  value,
  onSelect,
}: VeiculoPickerProps) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase()
    if (!t) return veiculos
    return veiculos.filter((v) =>
      `${v.marca} ${v.modelo} ${v.ano ?? ''}`.toLowerCase().includes(t),
    )
  }, [veiculos, search])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-liberty/10 text-liberty">
              <IconCar size={22} stroke={2} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-950">
                Selecione um veículo
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Clique no card do veículo desejado para vinculá-lo à proposta.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-ui cursor-pointer"
          >
            <IconX size={18} stroke={2} />
          </button>
        </div>

        <div className="border-b border-neutral-100 bg-neutral-50/50 px-6 py-3">
          <div className="relative">
            <IconSearch
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por marca ou modelo..."
              className="w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors"
            />
          </div>
          <p className="mt-2 text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
            {filtered.length} {filtered.length === 1 ? 'veículo' : 'veículos'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <IconCar size={32} className="text-neutral-300" stroke={1.5} />
              <p className="text-sm font-semibold text-neutral-700">
                Nenhum veículo encontrado
              </p>
              <p className="text-xs text-neutral-500">
                Ajuste a busca ou cadastre um novo veículo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filtered.map((v) => {
                const isSelected = v.id === value
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      onSelect(v.id)
                      onClose()
                    }}
                    className={
                      'group relative flex flex-col items-stretch overflow-hidden rounded-xl border bg-white text-left transition-[border-color,box-shadow,transform] duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md ' +
                      (isSelected
                        ? 'border-liberty ring-2 ring-liberty/30'
                        : 'border-neutral-200 hover:border-liberty/40')
                    }
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                      {v.foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.foto}
                          alt={`${v.marca} ${v.modelo}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 text-neutral-400">
                          <IconCar size={32} stroke={1.5} />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-liberty text-white shadow-sm">
                          <IconCheck size={16} stroke={2.5} />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/80">
                          {[v.marca, v.ano ? `${v.ano}` : null].filter(Boolean).join(' ')}
                        </span>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-xs font-bold text-neutral-900">
                        {v.modelo}
                      </p>
                      {v.preco != null && (
                        <p className="mt-0.5 truncate text-[11px] font-semibold text-liberty-deep">
                          {formatCurrency(v.preco)}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

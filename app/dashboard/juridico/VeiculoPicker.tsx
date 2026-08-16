'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconSearch,
  IconCheck,
  IconX,
  IconCar,
  IconUser,
} from '@tabler/icons-react'

export interface VeiculoPickerItem {
  id: string
  marca: string
  modelo: string
  ano: number | null
  placa: string | null
  /** Nome do cliente vinculado a este veículo (via contrato), se houver. */
  cliente: string | null
}

interface VeiculoPickerProps {
  open: boolean
  onClose: () => void
  veiculos: VeiculoPickerItem[]
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
      `${v.marca} ${v.modelo} ${v.ano ?? ''} ${v.placa ?? ''} ${v.cliente ?? ''}`
        .toLowerCase()
        .includes(t),
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
        className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
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
                Clique no veículo desejado para vinculá-lo ao processo.
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
              placeholder="Buscar por marca, modelo, placa ou cliente..."
              className="w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors"
            />
          </div>
          <p className="mt-2 text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
            {filtered.length} {filtered.length === 1 ? 'veículo' : 'veículos'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
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
            <ul className="divide-y divide-neutral-100">
              {filtered.map((v) => {
                const isSelected = v.id === value
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(v.id)
                        onClose()
                      }}
                      className={
                        'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left transition-colors cursor-pointer ' +
                        (isSelected ? 'bg-liberty/10' : 'hover:bg-neutral-50')
                      }
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
                          <IconCar size={16} stroke={1.75} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-neutral-900">
                            {v.marca} {v.modelo}
                            {v.ano ? ` ${v.ano}` : ''}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                            {v.placa && <span className="font-semibold">{v.placa}</span>}
                            {v.cliente ? (
                              <span className="flex items-center gap-1 truncate">
                                {v.placa && <span className="text-neutral-300">•</span>}
                                <IconUser size={11} stroke={2} />
                                <span className="truncate">{v.cliente}</span>
                              </span>
                            ) : (
                              <span className="italic text-neutral-400">Sem cliente vinculado</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-liberty text-white">
                          <IconCheck size={14} stroke={2.5} />
                        </div>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

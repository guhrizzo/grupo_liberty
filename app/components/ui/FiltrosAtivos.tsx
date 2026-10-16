'use client'

import { IconX } from '@tabler/icons-react'
import { cn } from '@/utils/cn'

export interface FiltroAtivo {
  /** Chave estável. */
  id: string
  /** Ex.: "Status: Atrasadas". */
  label: string
  onRemove: () => void
}

/** Filtros em uso como chips, cada um removível com um clique, mais "Limpar tudo". */
export function FiltrosAtivos({
  filtros,
  onClear,
  className,
}: {
  filtros: FiltroAtivo[]
  onClear?: () => void
  className?: string
}) {
  if (filtros.length === 0) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} aria-label="Filtros ativos">
      {filtros.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={f.onRemove}
          aria-label={`Remover filtro ${f.label}`}
          className="inline-flex items-center gap-1 rounded-full border border-liberty/30 bg-liberty/10 px-2.5 py-1 text-[11px] font-semibold text-liberty-deep hover:bg-liberty/20 cursor-pointer"
        >
          {f.label}
          <IconX size={12} stroke={2.5} />
        </button>
      ))}
      {onClear && filtros.length > 1 && (
        <button
          type="button"
          onClick={onClear}
          className="px-1.5 text-[11px] font-semibold text-neutral-500 underline hover:text-neutral-900 cursor-pointer"
        >
          Limpar tudo
        </button>
      )}
    </div>
  )
}

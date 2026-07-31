'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconTool,
  IconSearch,
  IconCheck,
  IconX,
  IconCurrencyDollar,
} from '@tabler/icons-react'
import { onlyDigits } from '@/utils/masks'
import { formatCurrency } from '@/utils/format'

const PECAS_PADRAO = [
  'Parachoque dianteiro',
  'Parachoque traseiro',
  'Capô',
  'Porta dianteira esquerda',
  'Porta dianteira direita',
  'Porta traseira esquerda',
  'Porta traseira direita',
  'Farol dianteiro esquerdo',
  'Farol dianteiro direito',
  'Lanterna traseira esquerda',
  'Lanterna traseira direita',
  'Retrovisor esquerdo',
  'Retrovisor direito',
  'Para-brisa',
  'Vidro traseiro',
  'Vidro porta dianteira esquerda',
  'Vidro porta dianteira direita',
  'Vidro porta traseira esquerda',
  'Vidro porta traseira direita',
  'Teto',
  'Asa dianteira esquerda',
  'Asa dianteira direita',
  'Painel frontal',
  'Grade dianteira',
  'Maçaneta externa',
  'Alto-falante',
  'Tapete',
  'Banco dianteiro esquerdo',
  'Banco dianteiro direito',
  'Banco traseiro',
  'Volante',
  'Painel de instrumentos',
  'Console central',
  'Pneu dianteiro esquerdo',
  'Pneu dianteiro direito',
  'Pneu traseiro esquerdo',
  'Pneu traseiro direito',
  'Roda dianteira esquerda',
  'Roda dianteira direita',
  'Roda traseira esquerda',
  'Roda traseira direita',
  'Escape',
  'Motor',
  'Radiador',
  'Bateria',
  'Alternador',
  'Correia do alternador',
  'Correia dentada',
  'Pastilha de freio dianteira',
  'Pastilha de freio traseira',
  'Disco de freio dianteiro',
  'Disco de freio traseiro',
  'Amortecedor dianteiro esquerdo',
  'Amortecedor dianteiro direito',
  'Amortecedor traseiro esquerdo',
  'Amortecedor traseiro direito',
  'Suspensão dianteira',
  'Suspensão traseira',
  'Embreagem',
  'Caixa de câmbio',
  'Direção hidráulica',
  'Ar-condicionado',
  'Compressor do ar',
  'Filtro de ar',
  'Filtro de óleo',
  'Filtro de combustível',
  'Velas',
  'Bobina',
]

export type PecaValor = { peca: string; valor: number }

interface ConsertoPecasModalProps {
  open: boolean
  onClose: () => void
  /** Callback com a lista final de peças/valores. */
  onConfirm: (pecas: PecaValor[], total: number) => void
  /** Lista inicial de peças/valores ao abrir o modal (modo edição). */
  initial?: PecaValor[]
}

const parseMoneyInput = (raw: string): number => {
  const d = onlyDigits(raw)
  if (!d) return 0
  const cents = parseInt(d.slice(-2), 10) || 0
  const reais = parseInt(d.slice(0, -2) || '0', 10) || 0
  return reais + cents / 100
}

export function ConsertoPecasModal({
  open,
  onClose,
  onConfirm,
  initial,
}: ConsertoPecasModalProps) {
  const [search, setSearch] = useState('')
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    if (initial) {
      for (const { peca, valor } of initial) {
        const cents = Math.round(valor * 100)
        const reais = Math.floor(cents / 100)
        const frac = cents % 100
        v[peca] =
          reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') +
          ',' +
          String(frac).padStart(2, '0')
      }
    }
    return v
  })
  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>()
    if (initial) for (const { peca } of initial) s.add(peca)
    return s
  })

  const total = useMemo(() => {
    let acc = 0
    selected.forEach((p) => {
      acc += parseMoneyInput(values[p] || '')
    })
    return acc
  }, [selected, values])

  if (!open || typeof document === 'undefined') return null

  const filtered = PECAS_PADRAO.filter((p) =>
    p.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const toggle = (peca: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(peca)) next.delete(peca)
      else next.add(peca)
      return next
    })
  }

  const updateValue = (peca: string, raw: string) => {
    // máscara pt-BR para digitação
    const d = onlyDigits(raw)
    if (!d) {
      setValues((prev) => ({ ...prev, [peca]: '' }))
      return
    }
    const cents = parseInt(d.slice(-2), 10)
    const reais = parseInt(d.slice(0, -2) || '0', 10)
    const reaisFmt = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    const frac = String(cents).padStart(2, '0')
    const formatted = `${reaisFmt},${frac}`
    setValues((prev) => ({ ...prev, [peca]: formatted }))
  }

  const handleConfirm = () => {
    if (selected.size === 0) {
      onClose()
      return
    }
    const pecas: PecaValor[] = []
    let t = 0
    selected.forEach((p) => {
      const v = parseMoneyInput(values[p] || '')
      pecas.push({ peca: p, valor: v })
      t += v
    })
    onConfirm(pecas, t)
    onClose()
  }

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
              <IconTool size={22} stroke={2} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-950">
                Conserto de peças
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Selecione as peças que precisam de conserto e informe o valor de
                cada reparo. O total será somado automaticamente ao custo da
                manutenção.
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
              placeholder="Buscar peça..."
              className="w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors"
            />
          </div>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            {selected.size} {selected.size === 1 ? 'peça selecionada' : 'peças selecionadas'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <IconTool size={32} className="text-neutral-300" stroke={1.5} />
              <p className="text-sm font-semibold text-neutral-700">
                Nenhuma peça encontrada
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((peca) => {
                const isSelected = selected.has(peca)
                const valor = values[peca] || ''
                return (
                  <li key={peca}>
                    <div
                      className={
                        'flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ' +
                        (isSelected
                          ? 'border-liberty/40 bg-liberty/5'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50')
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggle(peca)}
                        aria-pressed={isSelected}
                        className={
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors cursor-pointer ' +
                          (isSelected
                            ? 'bg-liberty border-liberty text-white'
                            : 'border-neutral-300 hover:border-liberty/60')
                        }
                      >
                        {isSelected && <IconCheck size={12} stroke={3} />}
                      </button>
                      <span className="flex-1 text-sm font-semibold text-neutral-900">
                        {peca}
                      </span>
                      <div className="relative w-32 sm:w-40">
                        <span
                          aria-hidden
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                        >
                          <IconCurrencyDollar size={12} />
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          disabled={!isSelected}
                          value={valor}
                          onChange={(e) => updateValue(peca, e.target.value)}
                          placeholder="0,00"
                          className={
                            'w-full rounded-lg border py-1.5 pl-7 pr-2 text-xs font-semibold transition-colors focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 ' +
                            (isSelected
                              ? 'border-neutral-200 bg-white text-neutral-900 focus:border-liberty focus:ring-2 focus:ring-liberty/15'
                              : 'border-neutral-200 bg-neutral-50 text-neutral-400')
                          }
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-neutral-100 bg-neutral-50/60 px-6 py-4">
          <div className="text-xs text-neutral-500">
            {selected.size > 0 ? (
              <span>
                Total estimado:{' '}
                <strong className="text-base font-bold text-liberty-deep">
                  {formatCurrency(total)}
                </strong>
              </span>
            ) : (
              <span>Selecione ao menos uma peça para continuar.</span>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-liberty px-4 py-2 text-xs font-bold text-white shadow-xs transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer hover:bg-liberty-deep disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconCheck size={14} stroke={2.5} />
              Confirmar peças
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

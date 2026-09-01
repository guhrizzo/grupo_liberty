'use client'

import { useEffect, useState } from 'react'
import { IconSparkles } from '@tabler/icons-react'
import { Modal } from '@/app/components/ui'
import { ChangelogEntryItem } from '@/app/components/ChangelogEntryItem'
import { CHANGELOG, entriesSince, type ChangelogEntry } from '@/constants/changelog'

const STORAGE_KEY = 'changelog:lastSeenId'
const MAX_PRIMEIRO_ACESSO = 5

/**
 * Abre automaticamente, no primeiro acesso ao dashboard após um deploy com
 * novidades, um modal com as entradas do `CHANGELOG` que o usuário ainda não viu.
 * O "visto" é rastreado por `localStorage` (por dispositivo). Fechar de qualquer
 * forma marca tudo como visto.
 */
export function ChangelogModal() {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null)

  useEffect(() => {
    if (CHANGELOG.length === 0) return

    let lastSeenId: string | null = null
    try {
      lastSeenId = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      return // storage bloqueado (aba privada, etc.) — não incomoda
    }

    const novas = entriesSince(lastSeenId)
    if (novas.length === 0) return

    // `localStorage` só existe no cliente e o estado inicial tem que bater com o
    // SSR (modal fechado) para não dar mismatch de hidratação — daí o setState
    // aqui no mount, de propósito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(lastSeenId ? novas : novas.slice(0, MAX_PRIMEIRO_ACESSO))
  }, [])

  function close() {
    try {
      window.localStorage.setItem(STORAGE_KEY, CHANGELOG[0].id)
    } catch {
      // sem storage: não dá pra lembrar, mas ao menos fecha
    }
    setEntries(null)
  }

  return (
    <Modal
      open={entries !== null}
      onClose={close}
      title="Novidades"
      description="O que mudou no sistema nesta atualização."
      size="lg"
    >
      <div className="mt-3 max-h-[60vh] divide-y divide-neutral-100 overflow-y-auto pr-1">
        {(entries ?? []).map((entry) => (
          <ChangelogEntryItem key={entry.id} entry={entry} />
        ))}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
        <a
          href="/dashboard/novidades"
          className="text-xs font-semibold text-neutral-500 hover:text-neutral-800 transition-ui"
        >
          Ver histórico
        </a>
        <button
          type="button"
          onClick={close}
          className="inline-flex items-center gap-1.5 rounded-lg bg-liberty px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-liberty-deep cursor-pointer"
        >
          <IconSparkles size={14} stroke={2.5} />
          Entendi
        </button>
      </div>
    </Modal>
  )
}

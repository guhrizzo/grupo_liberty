'use client'

import { IconLayoutGrid, IconList } from '@tabler/icons-react'
import type { ModoVisualizacao } from './useModoVisualizacao'

/** Botões "Blocos / Lista" para alternar o modo de visualização. */
export default function SeletorVisualizacao({
  modo,
  onChange,
}: {
  modo: ModoVisualizacao
  onChange: (m: ModoVisualizacao) => void
}) {
  const opcoes = [
    { valor: 'blocos' as const, label: 'Blocos', Icone: IconLayoutGrid },
    { valor: 'lista' as const, label: 'Lista', Icone: IconList },
  ]
  return (
    <div role="group" aria-label="Modo de visualização" className="inline-flex shrink-0 rounded-xl bg-neutral-100 p-1">
      {opcoes.map(({ valor, label, Icone }) => (
        <button
          key={valor}
          type="button"
          onClick={() => onChange(valor)}
          aria-pressed={modo === valor}
          title={`Ver em ${label.toLowerCase()}`}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            modo === valor ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Icone size={15} stroke={2.2} />
          {label}
        </button>
      ))}
    </div>
  )
}

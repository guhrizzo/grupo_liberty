'use client'

import { IconLayoutGrid, IconList } from '@tabler/icons-react'
import { SegmentedControl } from '@/app/components/ui'
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
    <SegmentedControl
      ariaLabel="Modo de visualização"
      className="shrink-0"
      value={modo}
      onChange={onChange}
      options={opcoes.map(({ valor, label, Icone }) => ({
        value: valor,
        title: `Ver em ${label.toLowerCase()}`,
        label: (
          <>
            <Icone size={15} stroke={2.2} />
            {label}
          </>
        ),
      }))}
    />
  )
}

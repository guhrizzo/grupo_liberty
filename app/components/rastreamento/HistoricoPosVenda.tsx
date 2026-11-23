import { IconMapPin } from '@tabler/icons-react'
import { formatarEvento } from '@/utils/autocarsat/formatar'
import type { rastreamentoPosVenda } from '@/utils/pos-venda/servicos'

type Posicoes = NonNullable<Awaited<ReturnType<typeof rastreamentoPosVenda>>>['posicoes']

export default function HistoricoPosVenda({ posicoes }: { posicoes: Posicoes }) {
  return posicoes.length === 0 ? (
    <p className="rounded-xl border border-[var(--portal-divisor)] p-5">Ainda não há uma posição válida para este veículo.</p>
  ) : (
    <section className="rounded-xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)] p-5">
      <h2 className="font-semibold">Última localização e histórico disponível</h2>
      <ol className="mt-3 divide-y divide-[var(--portal-divisor)]">
        {posicoes.map(({ id, data, local, latitude, longitude }) => (
          <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span>{formatarEvento(data).texto}{local && ` · ${local}`}</span>
            <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-[var(--portal-link)] hover:underline">
              <IconMapPin size={16} aria-hidden /> Ver no mapa
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { IconChevronDown } from '@tabler/icons-react'
import { formatDate } from '@/utils/format'
import { TAG_META } from '@/app/components/ChangelogEntryItem'
import type { ChangelogEntry } from '@/constants/changelog'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split('-')
  return `${MESES[Number(mes) - 1] ?? mes} de ${ano}`
}

/** Novidades agrupadas por mês; cada mês e cada novidade abre e fecha. */
export function NovidadesLista({ entries }: { entries: ChangelogEntry[] }) {
  // `entries` já vem do mais novo para o mais antigo.
  const meses = useMemo(() => {
    const mapa = new Map<string, ChangelogEntry[]>()
    for (const e of entries) {
      const k = e.date.slice(0, 7)
      mapa.set(k, [...(mapa.get(k) ?? []), e])
    }
    return [...mapa.entries()].map(([chave, lista]) => ({ chave, lista }))
  }, [entries])

  // Por padrão: só o mês mais recente aberto, com a novidade mais recente expandida.
  const [mesesFechados, setMesesFechados] = useState<Set<string>>(
    () => new Set(meses.slice(1).map((m) => m.chave)),
  )
  const [abertas, setAbertas] = useState<Set<string>>(
    () => new Set(entries.slice(0, 1).map((e) => e.id)),
  )

  function alternar<T>(set: Set<T>, valor: T): Set<T> {
    const novo = new Set(set)
    if (novo.has(valor)) novo.delete(valor)
    else novo.add(valor)
    return novo
  }

  const tudoAberto = mesesFechados.size === 0 && abertas.size === entries.length

  function alternarTudo() {
    if (tudoAberto) {
      setMesesFechados(new Set(meses.map((m) => m.chave)))
      setAbertas(new Set())
    } else {
      setMesesFechados(new Set())
      setAbertas(new Set(entries.map((e) => e.id)))
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={alternarTudo}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-bold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
        >
          {tudoAberto ? 'Recolher tudo' : 'Expandir tudo'}
        </button>
      </div>

      {meses.map((m) => {
        const mesAberto = !mesesFechados.has(m.chave)
        return (
          <section
            key={m.chave}
            aria-label={rotuloMes(m.chave)}
            className="rounded-2xl border border-neutral-200 bg-white shadow-xs"
          >
            <button
              type="button"
              onClick={() => setMesesFechados((s) => alternar(s, m.chave))}
              aria-expanded={mesAberto}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left cursor-pointer md:px-6"
            >
              <h2 className="text-base font-bold text-neutral-950">
                {rotuloMes(m.chave)}{' '}
                <span className="text-xs font-medium text-neutral-400">
                  ({m.lista.length} novidade{m.lista.length === 1 ? '' : 's'})
                </span>
              </h2>
              <IconChevronDown
                size={16}
                stroke={2.5}
                className={`shrink-0 text-neutral-400 transition-transform ${mesAberto ? 'rotate-180' : ''}`}
              />
            </button>

            {mesAberto && (
              <div className="divide-y divide-neutral-100 border-t border-neutral-100 px-5 md:px-6">
                {m.lista.map((entry) => {
                  const meta = TAG_META[entry.tag]
                  const Icon = meta.Icon
                  const aberta = abertas.has(entry.id)
                  return (
                    <article key={entry.id} className="py-3">
                      <button
                        type="button"
                        onClick={() => setAbertas((s) => alternar(s, entry.id))}
                        aria-expanded={aberta}
                        className="flex w-full items-start gap-3 text-left cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={
                                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ' +
                                meta.classes
                              }
                            >
                              <Icon size={11} stroke={2.5} />
                              {meta.label}
                            </span>
                            <span className="text-[11px] font-medium text-neutral-400">
                              {formatDate(entry.date)}
                            </span>
                          </div>
                          <h3 className="mt-2 text-sm font-bold text-neutral-950">{entry.title}</h3>
                        </div>
                        <IconChevronDown
                          size={16}
                          stroke={2.5}
                          className={`mt-1 shrink-0 text-neutral-400 transition-transform ${aberta ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {aberta && entry.items.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {entry.items.map((item, i) => (
                            <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-neutral-600">
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-300" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconCalendarWeek } from '@tabler/icons-react'
import { formatCurrency } from '@/utils/format'
import type { Cobranca, Parcela } from './actions'

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

interface ItemDia {
  cobrancaId: string
  clienteNome: string
  veiculoResumo: string
  parcela: Parcela
  total: number
}

function paraIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function segundaDaSemana(base: Date): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  const offset = (d.getDay() + 6) % 7 // segunda = 0
  d.setDate(d.getDate() - offset)
  return d
}

function addDias(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function dm(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function estiloStatus(p: Parcela): { rotulo: string; classe: string } {
  switch (p.status) {
    case 'pago':
      return { rotulo: 'Paga', classe: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'atrasado':
      return { rotulo: 'Atrasada', classe: 'bg-rose-50 text-rose-700 border-rose-200' }
    case 'parcial':
      return { rotulo: 'Parcial', classe: 'bg-sky-50 text-sky-700 border-sky-200' }
    default:
      return { rotulo: 'Pendente', classe: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
}

/** Grade semanal: cobranças (parcelas) que vencem em cada dia, com o cliente. */
export function SemanaTab({ cobrancas }: { cobrancas: Cobranca[] }) {
  const [inicio, setInicio] = useState(() => segundaDaSemana(new Date()))
  const hojeIso = paraIso(new Date())
  const [aberto, setAberto] = useState(true)
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lê preferência do navegador após a hidratação
      if (localStorage.getItem('cobrancas:semana-minimizada') === '1') setAberto(false)
    } catch {}
  }, [])
  function alternar() {
    setAberto((v) => {
      try {
        localStorage.setItem('cobrancas:semana-minimizada', v ? '1' : '0')
      } catch {}
      return !v
    })
  }

  const porData = useMemo(() => {
    const mapa = new Map<string, ItemDia[]>()
    for (const c of cobrancas) {
      for (const p of c.parcelas) {
        if (p.suspensa) continue
        const lista = mapa.get(p.dataVencimento) ?? []
        lista.push({
          cobrancaId: c.id,
          clienteNome: c.clienteNome,
          veiculoResumo: c.veiculoResumo,
          parcela: p,
          total: p.status === 'pago' ? p.valorParcela : p.valorRestante,
        })
        mapa.set(p.dataVencimento, lista)
      }
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.clienteNome.localeCompare(b.clienteNome, 'pt-BR'))
    }
    return mapa
  }, [cobrancas])

  const dias = Array.from({ length: 7 }, (_, i) => addDias(inicio, i))
  const fim = dias[6]
  const itensSemana = dias.flatMap((d) => porData.get(paraIso(d)) ?? [])
  const totalAberto = itensSemana
    .filter((i) => i.parcela.status !== 'pago')
    .reduce((s, i) => s + i.total, 0)
  const ehSemanaAtual = paraIso(inicio) === paraIso(segundaDaSemana(new Date()))

  return (
    <section className="space-y-3">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-neutral-950 md:text-lg">
            Semana de {dm(inicio)} a {dm(fim)}
          </h2>
          <p className="text-[11px] text-neutral-500">
            {itensSemana.length} cobrança{itensSemana.length === 1 ? '' : 's'} com vencimento na semana
            {' · '}a receber: <strong className="text-neutral-800">{formatCurrency(totalAberto)}</strong>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={alternar}
            aria-expanded={aberto}
            aria-label={aberto ? 'Minimizar semana' : 'Expandir semana'}
            className="rounded-lg border border-neutral-200 bg-white p-2 text-neutral-600 hover:bg-neutral-100"
          >
            <IconChevronDown size={16} className={`transition-transform ${aberto ? '' : '-rotate-90'}`} />
          </button>
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() => setInicio((d) => addDias(d, -7))}
            className="rounded-lg border border-neutral-200 bg-white p-2 text-neutral-600 hover:bg-neutral-100"
          >
            <IconChevronLeft size={16} />
          </button>
          <button
            type="button"
            disabled={ehSemanaAtual}
            onClick={() => setInicio(segundaDaSemana(new Date()))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            <IconCalendarWeek size={14} />
            Esta semana
          </button>
          <button
            type="button"
            aria-label="Próxima semana"
            onClick={() => setInicio((d) => addDias(d, 7))}
            className="rounded-lg border border-neutral-200 bg-white p-2 text-neutral-600 hover:bg-neutral-100"
          >
            <IconChevronRight size={16} />
          </button>
        </div>
      </header>

      {aberto && (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4 2xl:grid-cols-7">
        {dias.map((d, i) => {
          const iso = paraIso(d)
          const itens = porData.get(iso) ?? []
          const ehHoje = iso === hojeIso
          return (
            <div
              key={iso}
              className={`flex min-h-24 flex-col rounded-xl border bg-white shadow-xs ${
                ehHoje ? 'border-sky-500 ring-1 ring-sky-500' : 'border-neutral-200'
              }`}
            >
              <div className="flex items-baseline justify-between border-b border-neutral-100 px-3 py-2">
                <span className="text-xs font-bold uppercase text-neutral-950">{DIAS_SEMANA[i]}</span>
                <span className="text-[11px] text-neutral-500">{dm(d)}</span>
              </div>
              <ul className="flex-1 space-y-1.5 p-2">
                {itens.length === 0 && (
                  <li className="px-1 py-2 text-center text-[11px] text-neutral-300">—</li>
                )}
                {itens.map((it) => {
                  const st = estiloStatus(it.parcela)
                  return (
                    <li
                      key={it.parcela.id}
                      className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-2"
                    >
                      <p className="break-words text-xs font-bold leading-tight text-neutral-900">
                        {it.clienteNome}
                      </p>
                      <p className="mt-0.5 break-words text-[11px] leading-tight text-neutral-500">
                        {it.veiculoResumo} · parcela {it.parcela.numeroParcela}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-semibold text-neutral-800">
                          {formatCurrency(it.total)}
                        </span>
                        <span
                          className={`whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${st.classe}`}
                        >
                          {st.rotulo}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
      )}
    </section>
  )
}

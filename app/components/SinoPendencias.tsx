'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { IconBell, IconTool } from '@tabler/icons-react'
import { useToast } from '@/app/components/ui'
import { formatDate } from '@/utils/format'
import type { Pendencia } from '@/utils/pendencias/types'

/** Intervalo do lembrete enquanto o painel fica aberto. */
const LEMBRETE_MS = 2 * 60 * 60 * 1000
const CHAVE_AVISO = 'liberty_pendencias_aviso'

/**
 * Sininho fixo do painel: contador das pendências do usuário (calculadas no
 * servidor a cada navegação) e lembrete recorrente — um aviso ao abrir o
 * painel e outro a cada 2 horas com ele aberto, até as pendências serem
 * concluídas. Sem cron: tudo acontece no navegador.
 */
export default function SinoPendencias({ pendencias }: { pendencias: Pendencia[] }) {
  const toast = useToast()
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const total = pendencias.length
  const atrasadas = pendencias.filter((p) => p.atrasada).length

  // Lembrete: ao entrar e a cada LEMBRETE_MS. O horário do último aviso fica
  // no sessionStorage para não repetir a cada troca de página.
  useEffect(() => {
    if (total === 0) return
    function avisar() {
      try {
        const ultimo = Number(sessionStorage.getItem(CHAVE_AVISO) || 0)
        if (Date.now() - ultimo < LEMBRETE_MS) return
        sessionStorage.setItem(CHAVE_AVISO, String(Date.now()))
      } catch {
        // sem sessionStorage: avisa só uma vez por carregamento (efeito roda de novo ao navegar)
      }
      const texto = total === 1 ? '1 pendência' : `${total} pendências`
      toast.info(
        atrasadas > 0
          ? `Você tem ${texto}, ${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}. Veja no sininho.`
          : `Você tem ${texto} para executar. Veja no sininho.`,
      )
    }
    avisar()
    const t = setInterval(avisar, 10 * 60 * 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, atrasadas])

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  return (
    <div ref={ref} className="fixed right-3 top-3 z-30">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={total ? `Pendências (${total})` : 'Pendências'}
        aria-expanded={aberto}
        className="relative inline-flex cursor-pointer items-center justify-center rounded-lg border border-neutral-200 bg-white p-2 shadow-xs hover:bg-neutral-50 adobe-dark:border-[var(--color-adobe-line)] adobe-dark:bg-[var(--color-adobe-bg-2)] adobe-dark:text-[var(--color-adobe-text-hi)] adobe-dark:hover:bg-[var(--color-adobe-bg-3)]"
      >
        <IconBell size={18} className={atrasadas > 0 ? 'animate-pulse text-red-600' : undefined} />
        {total > 0 && (
          <span
            className={
              'absolute -right-1.5 -top-1.5 min-w-4 rounded-full px-1 text-center text-[10px] font-bold leading-4 text-white ' +
              (atrasadas > 0 ? 'bg-red-600' : 'bg-liberty')
            }
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg adobe-dark:border-[var(--color-adobe-line)] adobe-dark:bg-[var(--color-adobe-bg-2)]">
          <div className="border-b border-neutral-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-neutral-500 adobe-dark:border-[var(--color-adobe-line)] adobe-dark:text-[var(--color-adobe-text-lo)]">
            Pendências
          </div>
          {total === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-500 adobe-dark:text-[var(--color-adobe-text-lo)]">
              Nenhuma pendência. Tudo em dia.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-neutral-100 overflow-y-auto adobe-dark:divide-[var(--color-adobe-line)]">
              {pendencias.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <Link
                    href={p.href}
                    onClick={() => setAberto(false)}
                    className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-neutral-50 adobe-dark:hover:bg-[var(--color-adobe-bg-3)]"
                  >
                    <IconTool size={16} className={'mt-0.5 shrink-0 ' + (p.atrasada ? 'text-red-600' : 'text-neutral-500')} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-neutral-900 adobe-dark:text-[var(--color-adobe-text-hi)]">
                        {p.titulo}
                      </span>
                      <span className={'block text-xs ' + (p.atrasada ? 'font-bold text-red-700' : 'text-neutral-500')}>
                        {p.data ? formatDate(p.data) : 'Sem data'}
                        {p.atrasada ? ' · atrasada' : p.venceHoje ? ' · hoje' : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/dashboard/demandas?aba=pendencias"
            onClick={() => setAberto(false)}
            className="block border-t border-neutral-200 px-4 py-2.5 text-center text-xs font-bold text-liberty hover:bg-neutral-50 adobe-dark:border-[var(--color-adobe-line)] adobe-dark:hover:bg-[var(--color-adobe-bg-3)]"
          >
            Ver todas em Demandas
          </Link>
        </div>
      )}
    </div>
  )
}

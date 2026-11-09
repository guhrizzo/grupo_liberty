'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { IconBell, IconChecklist, IconChecks, IconTool } from '@tabler/icons-react'
import { useToast } from '@/app/components/ui'
import { formatDate } from '@/utils/format'
import type { Pendencia } from '@/utils/pendencias/types'

/** Intervalo do lembrete enquanto o painel fica aberto. */
const LEMBRETE_MS = 2 * 60 * 60 * 1000
const CHAVE_AVISO = 'liberty_pendencias_aviso'
const MAX_ITENS = 20

type Grupo = { chave: string; titulo: string; tom: 'atrasada' | 'hoje' | 'normal'; itens: Pendencia[] }

function agrupar(pendencias: Pendencia[]): Grupo[] {
  const grupos: Grupo[] = [
    { chave: 'atrasadas', titulo: 'Atrasadas', tom: 'atrasada', itens: [] },
    { chave: 'hoje', titulo: 'Para hoje', tom: 'hoje', itens: [] },
    { chave: 'proximas', titulo: 'Próximas', tom: 'normal', itens: [] },
  ]
  for (const p of pendencias.slice(0, MAX_ITENS)) {
    if (p.atrasada) grupos[0].itens.push(p)
    else if (p.venceHoje) grupos[1].itens.push(p)
    else grupos[2].itens.push(p)
  }
  return grupos.filter((g) => g.itens.length > 0)
}

/**
 * Sininho do painel: contador das pendências do próprio usuário (o ADM supremo
 * vê as de todos — calculadas no servidor a cada navegação) e lembrete
 * recorrente — um aviso ao abrir o painel e outro a cada 2 horas com ele
 * aberto, até as pendências serem concluídas. Sem cron: tudo acontece no navegador.
 *
 * Posição: fica na linha do topo do conteúdo (não cobre nada) e acompanha a
 * rolagem da página (sticky).
 */
export default function SinoPendencias({ pendencias }: { pendencias: Pendencia[] }) {
  const toast = useToast()
  const [aberto, setAberto] = useState(false)
  const [balancando, setBalancando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const total = pendencias.length
  const atrasadas = pendencias.filter((p) => p.atrasada).length
  const hoje = pendencias.filter((p) => !p.atrasada && p.venceHoje).length

  const balancar = useCallback(() => {
    setBalancando(false)
    // reinicia a animação CSS no próximo frame
    requestAnimationFrame(() => setBalancando(true))
  }, [])

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
      balancar()
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

  // O sino balança uma vez ao carregar cada página com pendências.
  useEffect(() => {
    if (total > 0) balancar()
  }, [total, balancar])

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  const grupos = agrupar(pendencias)
  const restantes = total - Math.min(total, MAX_ITENS)

  return (
    <div className="pointer-events-none sticky top-3 z-30 mb-3 flex h-10 justify-end">
      <div ref={ref} className="pointer-events-auto relative">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-label={total ? `Pendências (${total}${atrasadas ? `, ${atrasadas} atrasadas` : ''})` : 'Pendências'}
          aria-expanded={aberto}
          aria-haspopup="true"
          title="Pendências"
          className={
            'relative grid h-10 w-10 cursor-pointer place-items-center rounded-full border shadow-sm transition-colors ' +
            (aberto
              ? 'border-liberty bg-liberty/10 text-liberty-deep adobe-dark:border-[var(--color-adobe-accent)] adobe-dark:bg-[var(--color-adobe-accent)]/15 adobe-dark:text-[var(--color-adobe-accent-soft)] '
              : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 adobe-dark:border-[var(--color-adobe-line)] adobe-dark:bg-[var(--color-adobe-bg-2)] adobe-dark:text-[var(--color-adobe-text-hi)] adobe-dark:hover:bg-[var(--color-adobe-bg-3)] ')
          }
        >
          <IconBell
            size={20}
            stroke={1.9}
            key={balancando ? 'a' : 'b'}
            className={
              (balancando ? 'sino-balanca ' : '') +
              (atrasadas > 0 ? 'text-red-600 adobe-dark:text-red-400' : '')
            }
          />
          {total > 0 && (
            <span
              className={
                'absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white adobe-dark:ring-[var(--color-adobe-bg-1)] ' +
                (atrasadas > 0 ? 'bg-red-600' : 'bg-liberty')
              }
            >
              {atrasadas > 0 && (
                <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-red-500/60 motion-reduce:animate-none" aria-hidden />
              )}
              {total > 99 ? '99+' : total}
            </span>
          )}
        </button>

        {aberto && (
          <div className="absolute right-0 mt-2 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl adobe-dark:border-[var(--color-adobe-line)] adobe-dark:bg-[var(--color-adobe-bg-2)]">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 adobe-dark:border-[var(--color-adobe-line)]">
              <span className="text-sm font-bold text-neutral-900 adobe-dark:text-[var(--color-adobe-text-hi)]">Pendências</span>
              <span className="flex items-center gap-1.5 text-[11px] font-bold">
                {atrasadas > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 adobe-dark:bg-red-500/15 adobe-dark:text-red-300">
                    {atrasadas} atrasada{atrasadas > 1 ? 's' : ''}
                  </span>
                )}
                {hoje > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 adobe-dark:bg-amber-500/15 adobe-dark:text-amber-300">
                    {hoje} para hoje
                  </span>
                )}
                {total > 0 && atrasadas === 0 && hoje === 0 && (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600 adobe-dark:bg-[var(--color-adobe-bg-3)] adobe-dark:text-[var(--color-adobe-text-md)]">
                    {total}
                  </span>
                )}
              </span>
            </div>

            {total === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-600 adobe-dark:bg-emerald-500/10 adobe-dark:text-emerald-400">
                  <IconChecks size={22} />
                </span>
                <p className="text-sm font-semibold text-neutral-800 adobe-dark:text-[var(--color-adobe-text-hi)]">Tudo em dia</p>
                <p className="text-xs text-neutral-500 adobe-dark:text-[var(--color-adobe-text-lo)]">Você não tem pendências no momento.</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {grupos.map((g) => (
                  <section key={g.chave}>
                    <h3
                      className={
                        'sticky top-0 border-b px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur ' +
                        (g.tom === 'atrasada'
                          ? 'border-red-100 bg-red-50/95 text-red-700 adobe-dark:border-red-500/20 adobe-dark:bg-[#2b2020]/95 adobe-dark:text-red-300'
                          : 'border-neutral-100 bg-neutral-50/95 text-neutral-500 adobe-dark:border-[var(--color-adobe-line)] adobe-dark:bg-[var(--color-adobe-bg-3)]/95 adobe-dark:text-[var(--color-adobe-text-lo)]')
                      }
                    >
                      {g.titulo} · {g.itens.length}
                    </h3>
                    <ul className="divide-y divide-neutral-100 adobe-dark:divide-[var(--color-adobe-line)]">
                      {g.itens.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={p.href}
                            onClick={() => setAberto(false)}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 adobe-dark:hover:bg-[var(--color-adobe-bg-3)]"
                          >
                            <span
                              className={
                                'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ' +
                                (p.atrasada
                                  ? 'bg-red-100 text-red-700 adobe-dark:bg-red-500/15 adobe-dark:text-red-300'
                                  : 'bg-neutral-100 text-neutral-600 adobe-dark:bg-[var(--color-adobe-bg-3)] adobe-dark:text-[var(--color-adobe-text-md)]')
                              }
                            >
                              {p.origem !== 'manutencao' ? <IconChecklist size={17} /> : <IconTool size={17} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-neutral-900 adobe-dark:text-[var(--color-adobe-text-hi)]">
                                {p.titulo}
                              </span>
                              {p.detalhe && (
                                <span className="block truncate text-xs text-neutral-500 adobe-dark:text-[var(--color-adobe-text-lo)]">
                                  {p.detalhe}
                                </span>
                              )}
                              <span
                                className={
                                  'mt-0.5 block text-xs ' +
                                  (p.atrasada
                                    ? 'font-bold text-red-700 adobe-dark:text-red-300'
                                    : p.venceHoje
                                      ? 'font-semibold text-amber-700 adobe-dark:text-amber-300'
                                      : 'text-neutral-500 adobe-dark:text-[var(--color-adobe-text-lo)]')
                                }
                              >
                                {p.data ? formatDate(p.data) : 'Sem data'}
                                {p.atrasada ? ' · atrasada' : p.venceHoje ? ' · hoje' : ''}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {restantes > 0 && (
                  <p className="border-t border-neutral-100 px-4 py-2 text-center text-xs text-neutral-500 adobe-dark:border-[var(--color-adobe-line)] adobe-dark:text-[var(--color-adobe-text-lo)]">
                    + {restantes} outra{restantes > 1 ? 's' : ''} em Demandas
                  </p>
                )}
              </div>
            )}

            <Link
              href="/dashboard/demandas?aba=pendencias"
              onClick={() => setAberto(false)}
              className="block border-t border-neutral-200 px-4 py-3 text-center text-xs font-bold text-liberty hover:bg-neutral-50 adobe-dark:border-[var(--color-adobe-line)] adobe-dark:hover:bg-[var(--color-adobe-bg-3)]"
            >
              Ver todas em Demandas
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { IconCornerDownLeft, IconSearch } from '@tabler/icons-react'

export interface ItemPaleta {
  href: string
  label: string
  icone: ReactNode
  /** Texto extra pesquisável (ex.: sinônimos). */
  busca?: string
}

const CHAVE_RECENTES = 'dashboard_paleta_recentes'
const MAX_RECENTES = 5

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function lerRecentes(): string[] {
  try {
    const bruto = localStorage.getItem(CHAVE_RECENTES)
    const lista = bruto ? JSON.parse(bruto) : []
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Busca rápida do painel (Ctrl+K / ⌘K): abre uma caixa de pesquisa para ir direto
 * a qualquer aba a que o usuário tem acesso. Guarda as últimas escolhas.
 */
export default function PaletaComandos({ itens }: { itens: ItemPaleta[] }) {
  const router = useRouter()
  const [aberta, setAberta] = useState(false)
  const [consulta, setConsulta] = useState('')
  const [indice, setIndice] = useState(0)
  const [recentes, setRecentes] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)

  // Atalho global. Ctrl+K (Windows/Linux) ou ⌘K (Mac).
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAberta((v) => !v)
      }
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [])

  useEffect(() => {
    if (!aberta) return
    setConsulta('')
    setIndice(0)
    setRecentes(lerRecentes())
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      document.body.style.overflow = anterior
    }
  }, [aberta])

  const resultados = useMemo(() => {
    const q = normalizar(consulta)
    if (!q) {
      return recentes
        .map((h) => itens.find((i) => i.href === h))
        .filter((i): i is ItemPaleta => !!i)
    }
    const termos = q.split(/\s+/)
    return itens.filter((i) => {
      const alvo = normalizar(`${i.label} ${i.busca ?? ''}`)
      return termos.every((t) => alvo.includes(t))
    })
  }, [consulta, itens, recentes])

  useEffect(() => {
    setIndice(0)
  }, [consulta])

  useEffect(() => {
    listaRef.current?.children[indice]?.scrollIntoView({ block: 'nearest' })
  }, [indice])

  function abrirItem(item: ItemPaleta) {
    try {
      const novos = [item.href, ...lerRecentes().filter((h) => h !== item.href)].slice(0, MAX_RECENTES)
      localStorage.setItem(CHAVE_RECENTES, JSON.stringify(novos))
    } catch {
      // sem localStorage: só não lembra dos recentes
    }
    setAberta(false)
    router.push(item.href)
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setAberta(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndice((i) => (resultados.length ? (i + 1) % resultados.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndice((i) => (resultados.length ? (i - 1 + resultados.length) % resultados.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = resultados[indice]
      if (item) abrirItem(item)
    }
  }

  if (!aberta || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-neutral-950/50 px-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setAberta(false)
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Buscar no painel"
    >
      <div
        onKeyDown={aoTeclar}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl adobe-dark:border-[var(--color-adobe-line)] adobe-dark:bg-[var(--color-adobe-bg-2)]"
      >
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 adobe-dark:border-[var(--color-adobe-line)]">
          <IconSearch size={18} className="shrink-0 text-neutral-400" />
          <input
            ref={inputRef}
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Buscar no painel..."
            aria-label="Buscar no painel"
            className="h-14 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 adobe-dark:text-[var(--color-adobe-text-hi)]"
          />
          <kbd className="rounded-md border border-neutral-200 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-500 adobe-dark:border-[var(--color-adobe-line)] adobe-dark:text-[var(--color-adobe-text-lo)]">
            esc
          </kbd>
        </div>

        {resultados.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-neutral-500 adobe-dark:text-[var(--color-adobe-text-lo)]">
            {consulta ? 'Nenhum resultado.' : 'Nenhuma pesquisa recente.'}
          </p>
        ) : (
          <>
            {!consulta && (
              <p className="px-4 pt-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Recentes</p>
            )}
            <ul ref={listaRef} className="max-h-80 overflow-y-auto p-2" role="listbox">
              {resultados.map((item, i) => (
                <li key={item.href} role="option" aria-selected={i === indice}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndice(i)}
                    onClick={() => abrirItem(item)}
                    className={
                      'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors ' +
                      (i === indice
                        ? 'bg-liberty/10 text-liberty-deep adobe-dark:bg-[var(--color-adobe-accent)]/15 adobe-dark:text-[var(--color-adobe-accent-soft)]'
                        : 'text-neutral-700 adobe-dark:text-[var(--color-adobe-text-md)]')
                    }
                  >
                    <span className="shrink-0">{item.icone}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {i === indice && <IconCornerDownLeft size={15} className="shrink-0 opacity-60" />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2.5 text-[11px] text-neutral-500 adobe-dark:border-[var(--color-adobe-line)] adobe-dark:text-[var(--color-adobe-text-lo)]">
          <span>↑↓ navegar · Enter abrir · Esc fechar</span>
          <span>Liberty Car</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

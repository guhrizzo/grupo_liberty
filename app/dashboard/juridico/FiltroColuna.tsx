'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  IconChevronDown,
  IconFilterFilled,
  IconFilterOff,
  IconSearch,
  IconSortAscending,
  IconSortAscendingLetters,
  IconSortDescending,
  IconSortDescendingLetters,
} from '@tabler/icons-react'
import { Button } from '@/app/components/ui'
import { rotuloFiltro } from './prospeccao-filtro'

/** Acima disso a lista pede a pesquisa (milhares de checkboxes travam o menu). */
const MAX_VALORES = 500

const LARGURA_MENU = 280

/**
 * Conteúdo do menu de filtro de uma coluna, como no autofiltro do Excel:
 * classificação, pesquisa e lista de valores marcáveis.
 */
export function FiltroLista({
  valores,
  selecionados,
  numerica,
  ordem,
  onAplicar,
  onOrdenar,
  onFechar,
  focarPesquisa = true,
}: {
  /** Valores distintos da coluna (já considerando os outros filtros). */
  valores: string[]
  /** Filtro atual da coluna; undefined = tudo marcado. */
  selecionados: Set<string> | undefined
  numerica: boolean
  ordem: 'asc' | 'desc' | null
  /** null = remove o filtro da coluna. */
  onAplicar: (sel: Set<string> | null) => void
  onOrdenar: (dir: 'asc' | 'desc') => void
  onFechar: () => void
  /** No celular fica false: o teclado abriria por cima da lista. */
  focarPesquisa?: boolean
}) {
  const [rascunho, setRascunho] = useState<Set<string>>(
    () => new Set(selecionados ?? valores),
  )
  const [pesquisa, setPesquisa] = useState('')
  const termo = pesquisa.trim().toLowerCase()

  const visiveis = useMemo(
    () => (termo ? valores.filter((v) => rotuloFiltro(v).toLowerCase().includes(termo)) : valores),
    [valores, termo],
  )
  const marcadosVisiveis = visiveis.filter((v) => rascunho.has(v)).length
  const todos = visiveis.length > 0 && marcadosVisiveis === visiveis.length
  const alguns = marcadosVisiveis > 0 && !todos

  const todosRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (todosRef.current) todosRef.current.indeterminate = alguns
  }, [alguns])

  function alternar(v: string) {
    setRascunho((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }

  function alternarTodos() {
    setRascunho((prev) => {
      const next = new Set(prev)
      for (const v of visiveis) {
        if (todos) next.delete(v)
        else next.add(v)
      }
      return next
    })
  }

  // Com pesquisa, vale só o que está marcado E bate com a pesquisa (igual ao Excel).
  const resultado = termo ? new Set(visiveis.filter((v) => rascunho.has(v))) : rascunho
  const semFiltro = !termo && valores.every((v) => rascunho.has(v))

  function aplicar() {
    if (resultado.size === 0) return
    onAplicar(semFiltro ? null : resultado)
    onFechar()
  }

  const AscIcon = numerica ? IconSortAscending : IconSortAscendingLetters
  const DescIcon = numerica ? IconSortDescending : IconSortDescendingLetters
  const itemOrdem =
    'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100 adobe-dark:text-adobe-text-md adobe-dark:hover:bg-white/5'

  return (
    <div
      className="flex flex-col gap-2 text-xs normal-case tracking-normal"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault()
          aplicar()
        }
      }}
    >
      <div>
        <button
          type="button"
          onClick={() => {
            onOrdenar('asc')
            onFechar()
          }}
          className={`${itemOrdem} ${ordem === 'asc' ? 'bg-liberty/10 text-liberty-deep' : ''}`}
        >
          <AscIcon size={15} />
          {numerica ? 'Classificar do menor para o maior' : 'Classificar de A a Z'}
        </button>
        <button
          type="button"
          onClick={() => {
            onOrdenar('desc')
            onFechar()
          }}
          className={`${itemOrdem} ${ordem === 'desc' ? 'bg-liberty/10 text-liberty-deep' : ''}`}
        >
          <DescIcon size={15} />
          {numerica ? 'Classificar do maior para o menor' : 'Classificar de Z a A'}
        </button>
        {selecionados && (
          <button
            type="button"
            onClick={() => {
              onAplicar(null)
              onFechar()
            }}
            className={itemOrdem}
          >
            <IconFilterOff size={15} />
            Limpar filtro desta coluna
          </button>
        )}
      </div>

      <div className="relative">
        <IconSearch
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          autoFocus={focarPesquisa}
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
          placeholder="Pesquisar"
          className="h-8 w-full rounded-md border border-neutral-300 bg-white pl-8 pr-2 text-xs text-neutral-900 outline-none focus:border-liberty-deep adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-1 adobe-dark:text-adobe-text-hi"
        />
      </div>

      <div className="max-h-60 overflow-y-auto rounded-md border border-neutral-200 py-1 adobe-dark:border-adobe-line">
        {visiveis.length === 0 ? (
          <p className="px-2 py-3 text-center text-neutral-400">Nenhum valor encontrado.</p>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-2 px-2 py-1 font-semibold text-neutral-800 hover:bg-neutral-50 adobe-dark:text-adobe-text-hi adobe-dark:hover:bg-white/5">
              <input
                ref={todosRef}
                type="checkbox"
                checked={todos}
                onChange={alternarTodos}
                className="h-3.5 w-3.5 cursor-pointer accent-liberty-deep"
              />
              {termo ? '(Selecionar todos os resultados)' : '(Selecionar tudo)'}
            </label>
            {visiveis.slice(0, MAX_VALORES).map((v) => (
              <label
                key={v}
                className={`flex cursor-pointer items-center gap-2 px-2 py-1 hover:bg-neutral-50 adobe-dark:hover:bg-white/5 ${
                  v === '' ? 'italic text-neutral-500' : 'text-neutral-700 adobe-dark:text-adobe-text-md'
                }`}
              >
                <input
                  type="checkbox"
                  checked={rascunho.has(v)}
                  onChange={() => alternar(v)}
                  className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-liberty-deep"
                />
                <span className="truncate" title={rotuloFiltro(v)}>
                  {rotuloFiltro(v)}
                </span>
              </label>
            ))}
            {visiveis.length > MAX_VALORES && (
              <p className="px-2 py-1.5 text-[11px] text-neutral-400">
                Mostrando {MAX_VALORES} de {visiveis.length}. Use a pesquisa para achar os demais.
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
        <Button size="sm" variant="liberty" onClick={aplicar} disabled={resultado.size === 0}>
          OK
        </Button>
      </div>
    </div>
  )
}

/**
 * Botão ▾ do cabeçalho da coluna. O menu abre num portal com posição fixa,
 * para não ser cortado pela caixa com rolagem da tabela.
 */
export function FiltroColunaBotao({
  label,
  filtrada,
  ordem,
  children,
}: {
  label: string
  filtrada: boolean
  ordem: 'asc' | 'desc' | null
  children: (fechar: () => void) => ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!aberto || !botaoRef.current) return
    const r = botaoRef.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(r.left, window.innerWidth - LARGURA_MENU - 8))
    setPos({ top: r.bottom + 4, left })
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const fechar = () => setAberto(false)
    const onDown = (e: MouseEvent) => {
      const alvo = e.target as Node
      if (menuRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) return
      fechar()
    }
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return
      fechar()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Não deixa o Esc chegar na "tela cheia".
        e.stopPropagation()
        fechar()
        botaoRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', fechar)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', fechar)
    }
  }, [aberto])

  const Icone = filtrada ? IconFilterFilled : IconChevronDown
  const OrdemIcone = ordem === 'asc' ? IconSortAscending : IconSortDescending

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={`Filtrar ${label}`}
        aria-expanded={aberto}
        title={filtrada ? `Filtro ativo em ${label}` : `Filtrar ${label}`}
        className={`inline-flex h-5 shrink-0 cursor-pointer items-center gap-0.5 rounded border px-0.5 transition-colors ${
          filtrada || ordem
            ? 'border-liberty-deep/40 bg-liberty/15 text-liberty-deep'
            : 'border-neutral-300 bg-white text-neutral-500 hover:border-neutral-400 hover:text-neutral-800 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-1 adobe-dark:text-adobe-text-lo'
        }`}
      >
        {ordem && <OrdemIcone size={11} stroke={2.4} />}
        <Icone size={11} stroke={2.4} />
      </button>
      {aberto &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label={`Filtro de ${label}`}
            style={{ top: pos.top, left: pos.left, width: LARGURA_MENU }}
            className="fixed z-[60] rounded-lg border border-neutral-200 bg-white p-2 shadow-xl adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2"
          >
            {children(() => setAberto(false))}
          </div>,
          document.body,
        )}
    </>
  )
}

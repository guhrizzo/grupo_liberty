'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  IconArrowLeft,
  IconChevronLeft,
  IconList,
  IconMaximize,
  IconMinimize,
  IconSearch,
} from '@tabler/icons-react'
import LOGO_LIBERTY from '@/app/public/logo-liberty-car-blue.png'
import { ESTADOS, type EstadoVeiculo } from '@/utils/autocarsat/formatar'
import { MapaRastreamento, type PontoMapa } from '@/app/components/rastreamento/MapaRastreamento'

const ORDEM: EstadoVeiculo[] = ['movimento', 'parado', 'desligado', 'semsinal']

const ROTULO_CURTO: Record<EstadoVeiculo, string> = {
  movimento: 'Movimento',
  parado: 'Parado',
  desligado: 'Desligado',
  semsinal: 'Sem sinal',
}

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Tela cheia do rastreamento: barra no topo com a logo, mapa ocupando o resto
// e, por cima dele, a lista de veículos (busca + filtro por estado). Clicar
// num veículo da lista ou do mapa centraliza e abre o balão.
export default function PainelMapa({ pontos }: { pontos: PontoMapa[] }) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<EstadoVeiculo | 'todos'>('todos')
  const [selecionado, setSelecionado] = useState<string | null>(null)
  // null = ainda no padrão (aberta só em tela grande, via CSS, pra não cobrir o mapa no celular).
  const [listaAberta, setListaAberta] = useState<boolean | null>(null)
  const [telaCheia, setTelaCheia] = useState(false)

  useEffect(() => {
    const aoMudar = () => setTelaCheia(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', aoMudar)
    return () => document.removeEventListener('fullscreenchange', aoMudar)
  }, [])

  const contagem = useMemo(() => {
    const c: Record<EstadoVeiculo, number> = { movimento: 0, parado: 0, desligado: 0, semsinal: 0 }
    for (const p of pontos) c[p.estado]++
    return c
  }, [pontos])

  const visiveis = useMemo(() => {
    const q = normalizar(busca.trim())
    return pontos.filter(
      (p) =>
        (filtro === 'todos' || p.estado === filtro) &&
        (!q || normalizar(p.placa).includes(q) || normalizar(p.modelo).includes(q)),
    )
  }, [pontos, busca, filtro])

  // Se o veículo escolhido sumiu do filtro, vale como sem seleção.
  const selecao = selecionado && visiveis.some((p) => p.uuid === selecionado) ? selecionado : null

  function alternarTelaCheia() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }

  const blocos: [EstadoVeiculo | 'todos', string, number, string | null][] = [
    ['todos', 'Todos', pontos.length, null],
    ...ORDEM.map((e): [EstadoVeiculo, string, number, string] => [e, ROTULO_CURTO[e], contagem[e], ESTADOS[e].cor]),
  ]

  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <Link
          href="/dashboard/rastreamento"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <IconArrowLeft size={14} aria-hidden="true" />
          Voltar
        </Link>
        <h1 className="flex items-center">
          <span className="sr-only">Mapa de rastreamento</span>
          <Image src={LOGO_LIBERTY} alt="Liberty Car" priority className="h-8 w-auto" />
        </h1>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-neutral-500 sm:block">
            Mapa de rastreamento · {pontos.length} {pontos.length === 1 ? 'veículo' : 'veículos'}
          </p>
          <button
            type="button"
            onClick={alternarTelaCheia}
            aria-label={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
            title={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            {telaCheia ? <IconMinimize size={18} aria-hidden="true" /> : <IconMaximize size={18} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <MapaRastreamento
          pontos={visiveis}
          selecionado={selecao}
          onSelecionar={setSelecionado}
          enquadrarChave={`${filtro}|${busca}`}
          className="absolute inset-0 rounded-none border-0"
        />

        {/* Lista de veículos por cima do mapa (canto esquerdo). */}
        <aside
          className={`absolute bottom-3 left-3 top-3 z-[1001] w-[min(21rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl ${
            listaAberta === null ? 'hidden md:flex' : listaAberta ? 'flex' : 'hidden'
          }`}
        >
          <div className="shrink-0 space-y-3 border-b border-neutral-200 p-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <IconSearch
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar placa ou modelo"
                  className="h-9 w-full rounded-lg border border-neutral-200 bg-white pl-8 pr-2 text-sm text-neutral-900 outline-none focus:border-liberty"
                />
              </div>
              <button
                type="button"
                onClick={() => setListaAberta(false)}
                aria-label="Recolher lista"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <IconChevronLeft size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {blocos.map(([chave, rotulo, qtd, cor]) => {
                const ativo = filtro === chave
                return (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => setFiltro(ativo || chave === 'todos' ? 'todos' : chave)}
                    aria-pressed={ativo}
                    className={`flex flex-col items-center rounded-lg border px-1 py-1.5 transition-colors ${
                      ativo
                        ? 'border-liberty bg-liberty/10 text-neutral-900'
                        : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                  >
                    <span className="flex items-center gap-1 text-base font-black leading-none">
                      {cor && <span className="h-2 w-2 rounded-full" style={{ background: cor }} aria-hidden="true" />}
                      {qtd}
                    </span>
                    <span className="mt-1 text-[9px] font-bold uppercase leading-none tracking-tight">{rotulo}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <ul className="min-h-0 flex-1 divide-y divide-neutral-200 overflow-y-auto">
            {visiveis.length === 0 && (
              <li className="p-4 text-center text-sm text-neutral-500">Nenhum veículo encontrado.</li>
            )}
            {visiveis.map((p) => (
              <li key={p.uuid}>
                <button
                  type="button"
                  onClick={() => setSelecionado(selecao === p.uuid ? null : p.uuid)}
                  className={`block w-full px-3 py-2.5 text-left transition-colors hover:bg-neutral-50 ${
                    selecao === p.uuid ? 'bg-liberty/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-bold tracking-tight text-neutral-950">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: ESTADOS[p.estado].cor }}
                        aria-hidden="true"
                      />
                      {p.placa || 'Sem placa'}
                    </span>
                    <span className="text-xs text-neutral-500">{Math.round(p.velocidade)} km/h</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">{p.modelo}</p>
                  <p className="mt-0.5 truncate text-xs text-neutral-800">{p.endereco || 'Endereço indisponível'}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {ESTADOS[p.estado].rotulo} · {p.ultimoSinal}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <button
          type="button"
          onClick={() => setListaAberta(true)}
          className={`absolute left-3 top-3 z-[1001] items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-neutral-900 shadow-lg hover:bg-neutral-50 ${
            listaAberta === null ? 'inline-flex md:hidden' : listaAberta ? 'hidden' : 'inline-flex'
          }`}
        >
          <IconList size={16} aria-hidden="true" />
          Veículos
        </button>
      </div>
    </div>
  )
}

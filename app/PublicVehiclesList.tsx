'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { IconSearch, IconCar, IconArrowsSort, IconArrowRight } from '@tabler/icons-react'
import LoadingBar from './components/LoadingBar'
import { Veiculo } from './dashboard/veiculos/actions'

interface PublicVehiclesListProps {
  veiculos: Veiculo[]
}

export default function PublicVehiclesList({ veiculos }: PublicVehiclesListProps) {
  const [search, setSearch] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('Todas')
  const [selectedCambio, setSelectedCambio] = useState('Todos')
  const [sortBy, setSortBy] = useState('recente')
  const [showInitialLoading, setShowInitialLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setShowInitialLoading(false), 400)
    return () => clearTimeout(t)
  }, [])

  const brands = useMemo(() => {
    const list = veiculos.map(v => v.marca)
    return ['Todas', ...Array.from(new Set(list))]
  }, [veiculos])

  const filteredAndSorted = useMemo(() => {
    let result = [...veiculos]
    if (search.trim() !== '') {
      const q = search.toLowerCase()
      result = result.filter(
        v =>
          v.modelo.toLowerCase().includes(q) ||
          v.marca.toLowerCase().includes(q) ||
          (v.descricao && v.descricao.toLowerCase().includes(q))
      )
    }
    if (selectedBrand !== 'Todas') {
      result = result.filter(v => v.marca === selectedBrand)
    }
    if (selectedCambio !== 'Todos') {
      result = result.filter(v => v.cambio.toLowerCase() === selectedCambio.toLowerCase())
    }
    if (sortBy === 'preco-cresc') {
      result.sort((a, b) => a.preco - b.preco)
    } else if (sortBy === 'preco-decresc') {
      result.sort((a, b) => b.preco - a.preco)
    } else if (sortBy === 'ano-novo') {
      result.sort((a, b) => b.ano - a.ano)
    } else {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return result
  }, [veiculos, search, selectedBrand, selectedCambio, sortBy])

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  return (
    <div className="space-y-6">
      {showInitialLoading && <LoadingBar className="h-1" />}

      {/* Barra de Filtros e Busca */}
      <div className="rounded-2xl border border-[var(--color-line)] glass p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)]">
              <IconSearch size={18} stroke={2} />
            </span>
            <input
              type="text"
              placeholder="Buscar por marca, modelo, opcionais..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-2)] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[var(--color-text-mute)] focus:border-[var(--color-neon)] focus:bg-[var(--color-bg-3)] transition-all"
            />
          </div>

          <div className="relative">
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-2)] px-3.5 py-2.5 text-sm text-white focus:border-[var(--color-neon)] transition-colors cursor-pointer appearance-none"
            >
              <option value="Todas">Marcas: Todas</option>
              {brands.filter(b => b !== 'Todas').map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)] pointer-events-none">
              <IconArrowsSort size={16} stroke={2} />
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-2)] pl-9 pr-3.5 py-2.5 text-sm text-white focus:border-[var(--color-neon)] transition-colors cursor-pointer appearance-none"
            >
              <option value="recente">Mais Recentes</option>
              <option value="preco-cresc">Menor Preço</option>
              <option value="preco-decresc">Maior Preço</option>
              <option value="ano-novo">Mais Novos (Ano)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--color-line)] flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[var(--color-text-lo)] mr-2">Câmbio</span>
          {['Todos', 'Manual', 'Automatico', 'CVT'].map((c) => {
            const active = (c === 'Todos' && selectedCambio === 'Todos') || (c !== 'Todos' && selectedCambio.toLowerCase() === c.toLowerCase())
            return (
              <button
                key={c}
                onClick={() => setSelectedCambio(c)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-[var(--color-neon)] text-[#001018] shadow-[0_0_14px_-4px_rgba(0,212,255,0.7)]'
                    : 'bg-[var(--color-bg-2)] text-[var(--color-text-md)] hover:bg-[var(--color-bg-3)] border border-[var(--color-line)]'
                }`}
              >
                {c === 'Automatico' ? 'Automático' : c}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid de Veículos */}
      {filteredAndSorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-line)] glass p-16 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-[var(--color-bg-2)] flex items-center justify-center border border-[var(--color-line)]">
            <IconCar size={26} stroke={1.5} className="text-[var(--color-text-lo)]" />
          </div>
          <h3 className="text-base font-bold text-white">Nenhum veículo encontrado</h3>
          <p className="text-sm text-[var(--color-text-lo)] mt-1">Experimente mudar seus filtros ou termos de busca.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSorted.map((v, idx) => (
            <div
              key={v.id}
              style={{ animationDelay: `${idx * 40}ms` }}
              className="group relative rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-1)] overflow-hidden hover:border-[var(--color-neon)]/50 transition-all duration-300 flex flex-col hover:-translate-y-1 hover:shadow-[0_12px_30px_-12px_rgba(0,212,255,0.25)] animate-[fade-up_0.5s_ease-out_both]"
            >
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                   style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.06), transparent 60%)' }} />

              <div className="relative">
                <div className="relative aspect-16/10 bg-[var(--color-bg-2)] overflow-hidden">
                  {v.fotos && v.fotos.length > 0 ? (
                    <Image
                      src={v.fotos[0]}
                      alt={`${v.marca} ${v.modelo}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <IconCar size={48} stroke={1.2} className="text-[var(--color-text-mute)]" />
                    </div>
                  )}
                  {v.localizacao && (
                    <span className="absolute top-3 left-3 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 border border-white/10">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-neon)] mr-1.5 align-middle" />
                      {v.localizacao === 'bauru' ? 'Bauru/SP' : 'Jaú/SP'}
                    </span>
                  )}
                  {v.fotos && v.fotos.length > 1 && (
                    <span className="absolute top-3 right-3 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 border border-white/10">
                      +{v.fotos.length - 1} fotos
                    </span>
                  )}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--color-neon-soft)]">
                      {v.marca}
                    </span>
                    <h4 className="text-lg font-bold text-white leading-snug truncate mt-0.5">
                      {v.modelo}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-[var(--color-text-md)]">
                  <span>{v.ano}</span>
                  <span className="text-[var(--color-text-mute)]">•</span>
                  {v.quilometragem != null ? (
                    <span>{v.quilometragem.toLocaleString('pt-BR')} km</span>
                  ) : (
                    <span>Km não inf.</span>
                  )}
                  <span className="text-[var(--color-text-mute)]">•</span>
                  <span className="uppercase">{v.cambio}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-[var(--color-bg-2)] border border-[var(--color-line)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-md)] uppercase tracking-wide">
                    {v.combustivel}
                  </span>
                  {v.cor && (
                    <span className="rounded-md bg-[var(--color-bg-2)] border border-[var(--color-line)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-md)] uppercase tracking-wide">
                      {v.cor}
                    </span>
                  )}
                </div>

                <div className="mt-auto pt-5 flex items-center justify-between border-t border-[var(--color-line)]">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--color-text-lo)]">Preço</p>
                    <p className="text-lg font-black text-white">
                      {formatCurrency(v.preco)}
                    </p>
                  </div>

                  <Link
                    href={`/veiculos/${v.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-neon)] hover:bg-[var(--color-neon-soft)] text-[#001018] px-3.5 py-2 text-xs font-extrabold transition-all shadow-[0_0_14px_-4px_rgba(0,212,255,0.6)] cursor-pointer"
                  >
                    Ver Detalhes
                    <IconArrowRight size={12} stroke={3} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

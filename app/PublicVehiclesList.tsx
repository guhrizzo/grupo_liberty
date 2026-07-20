'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { IconSearch, IconCar } from '@tabler/icons-react'
import LoadingBar from './components/LoadingBar'
import { Veiculo } from './dashboard/veiculos/actions'

interface PublicVehiclesListProps {
  veiculos: Veiculo[]
}

export default function PublicVehiclesList({ veiculos }: PublicVehiclesListProps) {
  const [search, setSearch] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('Todas')
  const [selectedCambio, setSelectedCambio] = useState('Todos')
  const [sortBy, setSortBy] = useState('recente') // 'recente' | 'preco-cresc' | 'preco-decresc' | 'ano-novo'
  const [showInitialLoading, setShowInitialLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setShowInitialLoading(false), 400)
    return () => clearTimeout(t)
  }, [])

  // Marcas únicas presentes nos veículos
  const brands = useMemo(() => {
    const list = veiculos.map(v => v.marca)
    return ['Todas', ...Array.from(new Set(list))]
  }, [veiculos])

  // Filtragem e ordenação dos veículos
  const filteredAndSorted = useMemo(() => {
    let result = [...veiculos]

    // Filtro de busca
    if (search.trim() !== '') {
      const q = search.toLowerCase()
      result = result.filter(
        v =>
          v.modelo.toLowerCase().includes(q) ||
          v.marca.toLowerCase().includes(q) ||
          (v.descricao && v.descricao.toLowerCase().includes(q))
      )
    }

    // Filtro de Marca
    if (selectedBrand !== 'Todas') {
      result = result.filter(v => v.marca === selectedBrand)
    }

    // Filtro de Câmbio
    if (selectedCambio !== 'Todos') {
      result = result.filter(v => v.cambio.toLowerCase() === selectedCambio.toLowerCase())
    }

    // Ordenação
    if (sortBy === 'preco-cresc') {
      result.sort((a, b) => a.preco - b.preco)
    } else if (sortBy === 'preco-decresc') {
      result.sort((a, b) => b.preco - a.preco)
    } else if (sortBy === 'ano-novo') {
      result.sort((a, b) => b.ano - a.ano)
    } else {
      // recente (created_at desc)
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    return result
  }, [veiculos, search, selectedBrand, selectedCambio, sortBy])

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  return (
    <div className="space-y-8">
      {showInitialLoading && <LoadingBar className="h-1" />}

      {/* Barra de Filtros e Busca */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
        <div className="grid gap-4 md:grid-cols-4">
          {/* Campo de Busca */}
          <div className="relative md:col-span-2">
            <span className="absolute left-3.5 top-3 text-neutral-400">
              <IconSearch size={18} stroke={2} />
            </span>
            <input
              type="text"
              placeholder="Buscar por marca, modelo, opcionais..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 pl-10 pr-4 py-2.5 text-sm focus:border-neutral-900 focus:bg-white focus:outline-hidden transition-all"
            />
          </div>

          {/* Filtro por Marca */}
          <div>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors cursor-pointer"
            >
              <option value="Todas">Marcas: Todas</option>
              {brands.filter(b => b !== 'Todas').map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>

          {/* Ordenação */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors cursor-pointer"
            >
              <option value="recente">Mais Recentes</option>
              <option value="preco-cresc">Menor Preço</option>
              <option value="preco-decresc">Maior Preço</option>
              <option value="ano-novo">Mais Novos (Ano)</option>
            </select>
          </div>
        </div>

        {/* Filtros Rápidos (Câmbio) */}
        <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider mr-2">Câmbio:</span>
          {['Todos', 'Manual', 'Automatico', 'CVT'].map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCambio(c)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                (c === 'Todos' && selectedCambio === 'Todos') || (c !== 'Todos' && selectedCambio.toLowerCase() === c.toLowerCase())
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {c === 'Automatico' ? 'Automático' : c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Veículos */}
      {filteredAndSorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-16 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center">
            <IconCar size={24} stroke={1.5} className="text-neutral-400" />
          </div>
          <h3 className="text-base font-bold text-neutral-950">Nenhum veículo encontrado</h3>
          <p className="text-sm text-neutral-500 mt-1">Experimente mudar seus filtros ou termos de busca.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSorted.map((v) => (
            <div
              key={v.id}
              className="group rounded-2xl border border-neutral-200 bg-white shadow-xs overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Thumbnail */}
                <div className="relative aspect-16/10 bg-neutral-100 overflow-hidden">
                  {v.fotos && v.fotos.length > 0 ? (
                    <Image
                      src={v.fotos[0]}
                      alt={`${v.marca} ${v.modelo}`}
                      fill
                      className="object-cover group-hover:scale-102 transition-transform duration-500"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <IconCar size={48} stroke={1.5} className="text-neutral-300" />
                    </div>
                  )}
                  {v.fotos && v.fotos.length > 1 && (
                    <span className="absolute top-3 right-3 rounded-full bg-neutral-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5">
                      +{v.fotos.length - 1} fotos
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
                        {v.marca}
                      </span>
                      <h4 className="text-lg font-bold text-neutral-900 leading-snug truncate mt-0.5">
                        {v.modelo}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-neutral-500">
                    <span>{v.ano}</span>
                    <span className="text-neutral-300">•</span>
                    {v.quilometragem != null ? (
                      <span>{v.quilometragem.toLocaleString('pt-BR')} km</span>
                    ) : (
                      <span>Km não inf.</span>
                    )}
                    <span className="text-neutral-300">•</span>
                    <span className="uppercase">{v.cambio}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-neutral-50 border border-neutral-200/80 px-2 py-0.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wide">
                      {v.combustivel}
                    </span>
                    {v.cor && (
                      <span className="rounded-md bg-neutral-50 border border-neutral-200/80 px-2 py-0.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wide">
                        {v.cor}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Ações / Preço */}
              <div className="px-5 pb-5 pt-3 border-t border-neutral-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Preço</p>
                  <p className="text-lg font-black text-neutral-950">
                    {formatCurrency(v.preco)}
                  </p>
                </div>

                <Link
                  href={`/veiculos/${v.id}`}
                  className="rounded-xl bg-neutral-950 hover:bg-neutral-850 text-white px-4 py-2.5 text-xs font-bold transition-all shadow-xs hover:shadow-md cursor-pointer"
                >
                  Ver Detalhes
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

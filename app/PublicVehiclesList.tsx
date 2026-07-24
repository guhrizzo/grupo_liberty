'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { IconSearch, IconCar, IconArrowRight, IconMapPin } from '@tabler/icons-react'
import LoadingBar from './components/LoadingBar'
import ShareButton from './components/ShareButton'
import { Button, ChipFilter, EmptyState, Input, Select } from './components/ui'
import { useDebounce } from '@/utils/useDebounce'
import { Veiculo } from './dashboard/veiculos/actions'

interface PublicVehiclesListProps {
  veiculos: Veiculo[]
}

type CambioFilter = 'Todos' | 'Manual' | 'Automatico' | 'CVT'
type SortBy = 'recente' | 'preco-cresc' | 'preco-decresc' | 'ano-novo'

export default function PublicVehiclesList({ veiculos }: PublicVehiclesListProps) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 200)
  const [selectedBrand, setSelectedBrand] = useState('Todas')
  const [cambio, setCambio] = useState<CambioFilter>('Todos')
  const [sortBy, setSortBy] = useState<SortBy>('recente')
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
    if (debouncedSearch.trim() !== '') {
      const q = debouncedSearch.toLowerCase()
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
    if (cambio !== 'Todos') {
      result = result.filter(v => v.cambio.toLowerCase() === cambio.toLowerCase())
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
  }, [veiculos, debouncedSearch, selectedBrand, cambio, sortBy])

  const totalCount = veiculos.length
  const filteredCount = filteredAndSorted.length
  const hasFilters =
    debouncedSearch.trim() !== '' || selectedBrand !== 'Todas' || cambio !== 'Todos'

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  if (totalCount === 0) {
    return (
      <EmptyState
        size="lg"
        icon={<IconCar size={32} stroke={1.4} />}
        title="Nenhum veículo disponível no momento"
        description="Nosso estoque está sendo atualizado. Volte em breve para conferir as novidades."
        action={
          <Link href="/">
            <Button variant="secondary" size="sm">Atualizar página</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      {showInitialLoading && <LoadingBar className="h-1" />}

      {/* Barra de Filtros e Busca */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-6">
            <Input
              id="vehicle-search"
              type="search"
              placeholder="Buscar por marca, modelo, opcionais..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<IconSearch size={18} stroke={2} />}
              autoComplete="off"
            />
          </div>

          <div className="md:col-span-3">
            <Select
              id="vehicle-brand"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              aria-label="Filtrar por marca"
            >
              <option value="Todas">Todas as marcas</option>
              {brands.filter(b => b !== 'Todas').map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </Select>
          </div>

          <div className="md:col-span-3">
            <Select
              id="vehicle-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              aria-label="Ordenar veículos"
            >
              <option value="recente">Mais recentes</option>
              <option value="preco-cresc">Menor preço</option>
              <option value="preco-decresc">Maior preço</option>
              <option value="ano-novo">Mais novos (ano)</option>
            </Select>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-200">
          <ChipFilter<CambioFilter>
            label="Câmbio"
            value={cambio}
            onChange={setCambio}
            options={[
              { value: 'Todos', label: 'Todos' },
              { value: 'Manual', label: 'Manual' },
              { value: 'Automatico', label: 'Automático' },
              { value: 'CVT', label: 'CVT' },
            ]}
          />
        </div>
      </div>

      {/* Contador de resultados */}
      {hasFilters && (
        <p className="text-xs font-semibold text-neutral-500 px-1">
          Mostrando <span className="text-liberty font-bold">{filteredCount}</span> de {totalCount} veículos
        </p>
      )}

      {/* Grid de Veículos */}
      {filteredAndSorted.length === 0 ? (
        <EmptyState
          icon={<IconCar size={32} stroke={1.4} />}
          title="Nenhum veículo encontrado"
          description="Tente ajustar os filtros ou os termos da busca para ver mais resultados."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch('')
                setSelectedBrand('Todas')
                setCambio('Todos')
                setSortBy('recente')
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSorted.map((v, idx) => (
            <div
              key={v.id}
              style={{ animationDelay: `${idx * 40}ms` }}
              className="group relative rounded-2xl border border-neutral-200 bg-white overflow-hidden liberty-card-hover hover:-translate-y-1 animate-[fade-up_0.5s_ease-out_both]"
            >
              <div className="relative">
                <div className="relative aspect-16/10 bg-neutral-100 overflow-hidden">
                  {v.fotos && v.fotos.length > 0 ? (
                    <Image
                      src={v.fotos[0]}
                      alt={`${v.marca} ${v.modelo}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-neutral-400">
                      <IconCar size={48} stroke={1.2} />
                    </div>
                  )}
                  {v.localizacao && (
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-md bg-liberty/10 backdrop-blur-sm text-liberty-deep text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 border border-liberty/20">
                      <IconMapPin size={11} stroke={2.5} />
                      {v.localizacao === 'bauru' ? 'Bauru/SP' : 'Jaú/SP'}
                    </span>
                  )}
                  {v.fotos && v.fotos.length > 1 && (
                    <span className="absolute top-3 right-3 rounded-md bg-white/90 backdrop-blur-sm text-neutral-700 text-[10px] font-bold px-2 py-1 border border-neutral-200">
                      +{v.fotos.length - 1} fotos
                    </span>
                  )}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-liberty">
                      {v.marca}
                    </span>
                    <h4 className="text-lg font-bold text-neutral-900 leading-snug truncate mt-0.5">
                      {v.modelo}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-neutral-600">
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
                  <span className="rounded-md bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-700 uppercase tracking-wide">
                    {v.combustivel}
                  </span>
                  {v.cor && (
                    <span className="rounded-md bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-700 uppercase tracking-wide">
                      {v.cor}
                    </span>
                  )}
                </div>

                <div className="mt-auto pt-5 flex items-center justify-between gap-3 border-t border-neutral-200">
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">Preço</p>
                    <p className="text-lg font-black text-neutral-900 truncate">
                      {formatCurrency(v.preco)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <ShareButton
                      url={`/veiculos/${v.id}`}
                      title={`${v.marca} ${v.modelo} ${v.ano}`}
                      text={`${v.marca} ${v.modelo} ${v.ano} por ${formatCurrency(v.preco)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 hover:border-liberty hover:text-liberty text-neutral-700 px-3 py-2 text-xs font-bold transition-all cursor-pointer bg-white"
                    />
                    <Link href={`/veiculos/${v.id}`}>
                      <Button
                        variant="liberty"
                        size="sm"
                        rightIcon={<IconArrowRight size={12} stroke={3} />}
                      >
                        Ver Detalhes
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

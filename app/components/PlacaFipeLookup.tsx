'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  IconSearch,
  IconShieldCheck,
  IconCalendar,
  IconGasStation,
  IconPalette,
  IconMapPin,
  IconAlertCircle,
  IconRefresh,
  IconCurrencyDollar,
  IconBarcode,
  IconPlus,
  IconLoader2,
} from '@tabler/icons-react'
import { Button, Select } from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'
import { maskPlate } from '@/utils/masks'

export interface PlacaResult {
  placa: string
  marca: string
  modelo: string
  anoFabricacao: string
  anoModelo: string
  cor?: string
  combustivel?: string
  municipio?: string
  uf?: string
  valorFipe?: number
  codigoFipe?: string
  referenciaFipe?: string
}

interface FipeItem {
  codigo: string
  nome: string
}

interface FipeValorResponse {
  TipoVeiculo: number
  Valor: string
  Marca: string
  Modelo: string
  AnoModelo: number
  Combustivel: string
  CodigoFipe: string
  MesReferencia: string
  SiglaCombustivel: string
}

type Mode = 'placa' | 'manual'
type Status = 'idle' | 'loading' | 'success' | 'error'

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
const FIPE_BASE_URL = 'https://parallelum.com.br/fipe/api/v1/carros'

export default function PlacaFipeLookup({
  apiEndpoint = '/api/consulta-placa',
}: {
  apiEndpoint?: string
}) {
  const [mode, setMode] = useState<Mode>('placa')
  const [placa, setPlaca] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<PlacaResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Estados FIPE Manual Real (Parallelum API)
  const [marcas, setMarcas] = useState<FipeItem[]>([])
  const [modelos, setModelos] = useState<FipeItem[]>([])
  const [anos, setAnos] = useState<FipeItem[]>([])

  const [selectedMarca, setSelectedMarca] = useState('')
  const [selectedModelo, setSelectedModelo] = useState('')
  const [selectedAno, setSelectedAno] = useState('')

  const [loadingMarcas, setLoadingMarcas] = useState(false)
  const [loadingModelos, setLoadingModelos] = useState(false)
  const [loadingAnos, setLoadingAnos] = useState(false)

  const rawPlacaClean = placa.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const isValidPlaca = PLACA_REGEX.test(rawPlacaClean)

  // Carregar Marcas da API FIPE real
  useEffect(() => {
    if (mode === 'manual' && marcas.length === 0) {
      setLoadingMarcas(true)
      fetch(`${FIPE_BASE_URL}/marcas`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setMarcas(data)
        })
        .catch(() => setErrorMessage('Erro ao carregar marcas da FIPE.'))
        .finally(() => setLoadingMarcas(false))
    }
  }, [mode, marcas.length])

  // Carregar Modelos da Marca selecionada
  const handleMarcaChange = (marcaCodigo: string) => {
    setSelectedMarca(marcaCodigo)
    setSelectedModelo('')
    setSelectedAno('')
    setModelos([])
    setAnos([])

    if (!marcaCodigo) return

    setLoadingModelos(true)
    fetch(`${FIPE_BASE_URL}/marcas/${marcaCodigo}/modelos`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.modelos)) {
          setModelos(data.modelos)
        }
      })
      .catch(() => setErrorMessage('Erro ao carregar modelos da marca.'))
      .finally(() => setLoadingModelos(false))
  }

  // Carregar Anos do Modelo selecionado
  const handleModeloChange = (modeloCodigo: string) => {
    setSelectedModelo(modeloCodigo)
    setSelectedAno('')
    setAnos([])

    if (!modeloCodigo || !selectedMarca) return

    setLoadingAnos(true)
    fetch(`${FIPE_BASE_URL}/marcas/${selectedMarca}/modelos/${modeloCodigo}/anos`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAnos(data)
      })
      .catch(() => setErrorMessage('Erro ao carregar anos do modelo.'))
      .finally(() => setLoadingAnos(false))
  }

  // Buscar valor FIPE oficial em tempo real
  const handleSearchManualReal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMarca || !selectedModelo || !selectedAno) return

    setStatus('loading')
    setErrorMessage('')
    setResult(null)

    try {
      const res = await fetch(
        `${FIPE_BASE_URL}/marcas/${selectedMarca}/modelos/${selectedModelo}/anos/${selectedAno}`
      )

      if (!res.ok) {
        throw new Error('Não foi possível obter o valor FIPE deste modelo.')
      }

      const data: FipeValorResponse = await res.json()

      // Parse do valor em R$ (ex: "R$ 89.500,00" -> 89500)
      const rawValor = data.Valor.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
      const numericValor = parseFloat(rawValor) || 0

      setResult({
        placa: 'CONSULTA',
        marca: data.Marca,
        modelo: data.Modelo,
        anoFabricacao: String(data.AnoModelo),
        anoModelo: String(data.AnoModelo),
        combustivel: data.Combustivel,
        cor: 'Padrão FIPE',
        valorFipe: numericValor,
        codigoFipe: data.CodigoFipe,
        referenciaFipe: data.MesReferencia,
      })
      setStatus('success')
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao consultar a FIPE.')
      setStatus('error')
    }
  }

  const handlePlacaChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
    setPlaca(val)
  }, [])

  const handleSearchPlaca = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!isValidPlaca || status === 'loading') return

      setStatus('loading')
      setErrorMessage('')
      setResult(null)

      try {
        const res = await fetch(`${apiEndpoint}?placa=${rawPlacaClean}`)

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(
            errData.error || 'Não encontramos registro para a placa informada.'
          )
        }

        const data: PlacaResult = await res.json()
        setResult(data)
        setStatus('success')
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Erro ao realizar consulta.'
        )
        setStatus('error')
      }
    },
    [apiEndpoint, isValidPlaca, rawPlacaClean, status]
  )

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Card principal com tabs */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Consulta Tabela FIPE & Veículo</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Consulte dados de veículos por placa ou a avaliação oficial FIPE em tempo real.
            </p>
          </div>

          {/* Abas */}
          <div className="inline-flex rounded-xl bg-neutral-100 p-1 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => { setMode('placa'); setStatus('idle'); setResult(null) }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                mode === 'placa'
                  ? 'bg-white text-neutral-950 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Por Placa
            </button>
            <button
              type="button"
              onClick={() => { setMode('manual'); setStatus('idle'); setResult(null) }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                mode === 'manual'
                  ? 'bg-white text-neutral-950 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Tabela FIPE Oficial
            </button>
          </div>
        </div>

        {/* Formulário Por Placa */}
        {mode === 'placa' && (
          <form onSubmit={handleSearchPlaca} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                Placa do Veículo (Mercosul ou Tradicional)
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                    <IconBarcode size={20} />
                  </div>
                  <input
                    type="text"
                    value={maskPlate(placa)}
                    onChange={handlePlacaChange}
                    placeholder="ABC-1D23"
                    maxLength={8}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-11 pr-4 py-2.5 text-base font-extrabold uppercase tracking-widest text-neutral-900 focus:border-neutral-950 focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
                <Button
                  type="submit"
                  variant="liberty"
                  disabled={!isValidPlaca || status === 'loading'}
                  leftIcon={<IconSearch size={16} stroke={2.5} />}
                  className="shrink-0 py-2.5 px-6"
                >
                  {status === 'loading' ? 'Consultando...' : 'Buscar Placa'}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">
                Digite os 7 caracteres da placa sem traço (ex: ABC1D23 ou ABC1234).
              </p>
            </div>
          </form>
        )}

        {/* Formulário Por Marca/Modelo/Ano (Tabela FIPE Real) */}
        {mode === 'manual' && (
          <form onSubmit={handleSearchManualReal} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Seletor Marca */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Marca {loadingMarcas && <IconLoader2 size={12} className="inline animate-spin text-neutral-400 ml-1" />}
                </label>
                <select
                  value={selectedMarca}
                  onChange={(e) => handleMarcaChange(e.target.value)}
                  disabled={loadingMarcas}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs text-neutral-900 focus:border-neutral-950 focus:bg-white focus:outline-none"
                >
                  <option value="">Selecione a marca...</option>
                  {marcas.map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seletor Modelo */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Modelo {loadingModelos && <IconLoader2 size={12} className="inline animate-spin text-neutral-400 ml-1" />}
                </label>
                <select
                  value={selectedModelo}
                  onChange={(e) => handleModeloChange(e.target.value)}
                  disabled={!selectedMarca || loadingModelos}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs text-neutral-900 focus:border-neutral-950 focus:bg-white focus:outline-none disabled:opacity-50"
                >
                  <option value="">Selecione o modelo...</option>
                  {modelos.map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seletor Ano */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Ano Modelo {loadingAnos && <IconLoader2 size={12} className="inline animate-spin text-neutral-400 ml-1" />}
                </label>
                <select
                  value={selectedAno}
                  onChange={(e) => setSelectedAno(e.target.value)}
                  disabled={!selectedModelo || loadingAnos}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs text-neutral-900 focus:border-neutral-950 focus:bg-white focus:outline-none disabled:opacity-50"
                >
                  <option value="">Selecione o ano...</option>
                  {anos.map((a) => (
                    <option key={a.codigo} value={a.codigo}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="liberty"
                disabled={!selectedMarca || !selectedModelo || !selectedAno || status === 'loading'}
                leftIcon={<IconSearch size={16} stroke={2.5} />}
              >
                {status === 'loading' ? 'Consultando FIPE...' : 'Consultar Valor FIPE'}
              </Button>
            </div>
          </form>
        )}

        {/* Estado de Erro */}
        {status === 'error' && (
          <div className="mt-5 rounded-xl bg-rose-50 border border-rose-200 p-4 flex items-center gap-3 text-rose-800 text-sm">
            <IconAlertCircle size={20} className="shrink-0 text-rose-600" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}
      </div>

      {/* Resultado da Consulta */}
      {status === 'success' && result && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <IconShieldCheck size={24} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Dados FIPE Oficial
                </span>
                <h3 className="text-xl font-extrabold text-neutral-950 mt-1">
                  {result.marca} {result.modelo}
                </h3>
              </div>
            </div>

            {result.placa !== 'CONSULTA' && (
              <span className="rounded-lg bg-neutral-950 text-white font-mono font-extrabold px-3 py-1.5 text-sm tracking-widest self-start sm:self-auto border-2 border-neutral-800">
                {result.placa}
              </span>
            )}
          </div>

          {/* Valor FIPE Destaque */}
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-900/70 flex items-center gap-1.5">
                <IconCurrencyDollar size={16} /> Valor FIPE Oficial de Mercado
              </p>
              <p className="text-3xl font-black text-amber-950 mt-1">
                {typeof result.valorFipe === 'number'
                  ? formatCurrency(result.valorFipe)
                  : 'Não informado'}
              </p>
              {result.referenciaFipe && (
                <p className="text-xs text-amber-900/60 mt-0.5">
                  Mês de referência: {result.referenciaFipe}
                </p>
              )}
            </div>

            {result.codigoFipe && (
              <div className="bg-white/80 backdrop-blur-xs rounded-lg px-3 py-2 border border-amber-200/50 text-right">
                <p className="text-[10px] font-bold text-amber-900/60 uppercase">Código FIPE</p>
                <p className="text-xs font-mono font-bold text-neutral-900">{result.codigoFipe}</p>
              </div>
            )}
          </div>

          {/* Grid de Especificações */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
              <span className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1">
                <IconCalendar size={12} /> Ano
              </span>
              <p className="text-sm font-bold text-neutral-900 mt-1">
                {result.anoFabricacao}
                {result.anoModelo && result.anoModelo !== result.anoFabricacao ? `/${result.anoModelo}` : ''}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
              <span className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1">
                <IconGasStation size={12} /> Combustível
              </span>
              <p className="text-sm font-bold text-neutral-900 mt-1">
                {result.combustivel || 'Flex'}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
              <span className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1">
                <IconPalette size={12} /> Cor
              </span>
              <p className="text-sm font-bold text-neutral-900 mt-1">
                {result.cor || 'Não informada'}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
              <span className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1">
                <IconMapPin size={12} /> Estado/UF
              </span>
              <p className="text-sm font-bold text-neutral-900 mt-1">
                {result.municipio && result.uf ? `${result.municipio}/${result.uf}` : result.uf || 'SP'}
              </p>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => { setStatus('idle'); setResult(null); setPlaca('') }}
              className="text-xs font-bold text-neutral-500 hover:text-neutral-800 flex items-center gap-1.5 cursor-pointer py-2"
            >
              <IconRefresh size={14} /> Nova Consulta
            </button>

            <Link
              href={`/dashboard/veiculos?marca=${encodeURIComponent(result.marca)}&modelo=${encodeURIComponent(result.modelo)}&ano=${result.anoFabricacao}&fipe=${result.valorFipe || ''}&placa=${result.placa !== 'CONSULTA' ? result.placa : ''}`}
            >
              <Button
                variant="liberty"
                leftIcon={<IconPlus size={16} stroke={2.5} />}
                className="w-full sm:w-auto"
              >
                Cadastrar Veículo com estes Dados
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

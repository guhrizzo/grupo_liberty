'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  IconSearch,
  IconShieldCheck,
  IconShieldX,
  IconCalendar,
  IconGasStation,
  IconPalette,
  IconMapPin,
  IconAlertCircle,
  IconAlertTriangle,
  IconRefresh,
  IconCurrencyDollar,
  IconBarcode,
  IconPlus,
  IconLoader2,
  IconCar,
  IconId,
  IconTrendingDown,
  IconClock,
  IconDatabase,
} from '@tabler/icons-react'
import { Button, Select } from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'
import { maskPlate } from '@/utils/masks'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface PlacaResult {
  placa: string
  marca: string
  modelo: string
  marcaModelo?: string
  anoFabricacao: string
  anoModelo: string
  cor?: string
  combustivel?: string
  municipio?: string
  uf?: string
  especie?: string
  tipo?: string
  rouboFurto?: string
  chassi?: string
  renavam?: string
  valorFipe?: number
  codigoFipe?: string
  referenciaFipe?: string
  historicoPrecFipe?: { valor: string; mesReferencia: string }[]
  logo?: string
  fromCache?: boolean
  cachedAt?: string
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
type Status = 'idle' | 'loading' | 'success' | 'error' | 'no_token'

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
const FIPE_BASE_URL = 'https://parallelum.com.br/fipe/api/v1/carros'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cacheAge(cachedAt?: string): string {
  if (!cachedAt) return ''
  const diff = Math.floor((Date.now() - new Date(cachedAt).getTime()) / 60000)
  if (diff < 60) return `${diff}min atrás`
  const h = Math.floor(diff / 60)
  return `${h}h atrás`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlacaFipeLookup({
  apiEndpoint = '/api/consulta-placa',
  onImport,
}: {
  apiEndpoint?: string
  /** Callback chamado ao clicar em "Importar dados" — recebe o resultado */
  onImport?: (result: PlacaResult) => void
}) {
  const [mode, setMode] = useState<Mode>('placa')
  const [placa, setPlaca] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<PlacaResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  // ─── Estados FIPE Manual (Parallelum API) ──────────────────────────────

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

  // ─── FIPE Manual: carregar marcas ──────────────────────────────────────

  useEffect(() => {
    if (mode === 'manual' && marcas.length === 0) {
      setLoadingMarcas(true)
      fetch(`${FIPE_BASE_URL}/marcas`)
        .then((res) => res.json())
        .then((data) => { if (Array.isArray(data)) setMarcas(data) })
        .catch(() => setErrorMessage('Erro ao carregar marcas da FIPE.'))
        .finally(() => setLoadingMarcas(false))
    }
  }, [mode, marcas.length])

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
      .then((data) => { if (data && Array.isArray(data.modelos)) setModelos(data.modelos) })
      .catch(() => setErrorMessage('Erro ao carregar modelos da marca.'))
      .finally(() => setLoadingModelos(false))
  }

  const handleModeloChange = (modeloCodigo: string) => {
    setSelectedModelo(modeloCodigo)
    setSelectedAno('')
    setAnos([])
    if (!modeloCodigo || !selectedMarca) return
    setLoadingAnos(true)
    fetch(`${FIPE_BASE_URL}/marcas/${selectedMarca}/modelos/${modeloCodigo}/anos`)
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setAnos(data) })
      .catch(() => setErrorMessage('Erro ao carregar anos do modelo.'))
      .finally(() => setLoadingAnos(false))
  }

  // ─── FIPE Manual: buscar valor ─────────────────────────────────────────

  const handleSearchManualReal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMarca || !selectedModelo || !selectedAno) return

    setStatus('loading')
    setErrorMessage('')
    setResult(null)

    try {
      const res = await fetch(
        `${FIPE_BASE_URL}/marcas/${selectedMarca}/modelos/${selectedModelo}/anos/${selectedAno}`,
      )
      if (!res.ok) throw new Error('Não foi possível obter o valor FIPE deste modelo.')
      const data: FipeValorResponse = await res.json()
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

  // ─── Busca por placa ───────────────────────────────────────────────────

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
          if (errData.error === 'token_missing') {
            setStatus('no_token')
            return
          }
          throw new Error(errData.error || 'Não encontramos registro para a placa informada.')
        }

        const data: PlacaResult = await res.json()
        setResult(data)
        setStatus('success')
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Erro ao realizar consulta.')
        setStatus('error')
      }
    },
    [apiEndpoint, isValidPlaca, rawPlacaClean, status],
  )

  // ─── Reset ─────────────────────────────────────────────────────────────

  const handleReset = () => {
    setStatus('idle')
    setResult(null)
    setPlaca('')
  }

  // ─── Render ────────────────────────────────────────────────────────────

  const isRouboFurto = result?.rouboFurto && result.rouboFurto !== 'NAO' && result.rouboFurto !== ''

  return (
    <div className="mx-auto max-w-2xl space-y-6">

      {/* ─── Card principal ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Consulta Tabela FIPE &amp; Veículo</h2>
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

        {/* ─── Formulário Por Placa ─────────────────────────────────── */}
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
                  leftIcon={status === 'loading' ? <IconLoader2 size={16} className="animate-spin" /> : <IconSearch size={16} stroke={2.5} />}
                  className="shrink-0 py-2.5 px-6"
                >
                  {status === 'loading' ? 'Consultando...' : 'Buscar Placa'}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">
                Digite os 7 caracteres da placa sem traço (ex: ABC1D23 ou ABC1234). Via <span className="font-semibold">Sistema Puxa Placa</span>.
              </p>
            </div>
          </form>
        )}

        {/* ─── Formulário Manual FIPE ───────────────────────────────── */}
        {mode === 'manual' && (
          <form onSubmit={handleSearchManualReal} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                id="selectMarca"
                label={`Marca${loadingMarcas ? ' (Carregando...)' : ''}`}
                value={selectedMarca}
                onChange={(e) => handleMarcaChange(e.target.value)}
                disabled={loadingMarcas}
              >
                <option value="">Selecione a marca...</option>
                {marcas.map((m) => (
                  <option key={m.codigo} value={m.codigo}>{m.nome}</option>
                ))}
              </Select>

              <Select
                id="selectModelo"
                label={`Modelo${loadingModelos ? ' (Carregando...)' : ''}`}
                value={selectedModelo}
                onChange={(e) => handleModeloChange(e.target.value)}
                disabled={!selectedMarca || loadingModelos}
              >
                <option value="">Selecione o modelo...</option>
                {modelos.map((m) => (
                  <option key={m.codigo} value={m.codigo}>{m.nome}</option>
                ))}
              </Select>

              <Select
                id="selectAno"
                label={`Ano Modelo${loadingAnos ? ' (Carregando...)' : ''}`}
                value={selectedAno}
                onChange={(e) => setSelectedAno(e.target.value)}
                disabled={!selectedModelo || loadingAnos}
              >
                <option value="">Selecione o ano...</option>
                {anos.map((a) => (
                  <option key={a.codigo} value={a.codigo}>{a.nome}</option>
                ))}
              </Select>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="liberty"
                disabled={!selectedMarca || !selectedModelo || !selectedAno || status === 'loading'}
                leftIcon={status === 'loading' ? <IconLoader2 size={16} className="animate-spin" /> : <IconSearch size={16} stroke={2.5} />}
              >
                {status === 'loading' ? 'Consultando FIPE...' : 'Consultar Valor FIPE'}
              </Button>
            </div>
          </form>
        )}

        {/* ─── Token não configurado ────────────────────────────────── */}
        {status === 'no_token' && (
          <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3 text-amber-800 text-sm">
            <span className="shrink-0 text-xl">🔑</span>
            <div>
              <p className="font-bold">Token do Puxa Placa não configurado</p>
              <p className="text-xs mt-0.5 text-amber-700">
                Configure a variável <code className="bg-amber-100 px-1 rounded">PUXA_PLACA_TOKEN</code> no{' '}
                <code className="bg-amber-100 px-1 rounded">.env.local</code> para ativar a consulta por placa.
              </p>
            </div>
          </div>
        )}

        {/* ─── Erro ────────────────────────────────────────────────── */}
        {status === 'error' && (
          <div className="mt-5 rounded-xl bg-rose-50 border border-rose-200 p-4 flex items-center gap-3 text-rose-800 text-sm">
            <IconAlertCircle size={20} className="shrink-0 text-rose-600" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}
      </div>

      {/* ─── Resultado ─────────────────────────────────────────────────── */}
      {status === 'success' && result && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs space-y-6 animate-in fade-in zoom-in-95 duration-300">

          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <IconShieldCheck size={24} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Dados Veiculares
                </span>
                <h3 className="text-xl font-extrabold text-neutral-950 mt-1">
                  {result.marcaModelo || `${result.marca} ${result.modelo}`}
                </h3>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              {result.placa !== 'CONSULTA' && (
                <span className="rounded-lg bg-neutral-950 text-white font-mono font-extrabold px-3 py-1.5 text-sm tracking-widest border-2 border-neutral-800">
                  {result.placa}
                </span>
              )}
              {result.fromCache && result.cachedAt && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-400">
                  <IconDatabase size={11} />
                  Cache · {cacheAge(result.cachedAt)}
                </span>
              )}
            </div>
          </div>

          {/* ─── Alerta de Roubo / Furto ─────────────────────────── */}
          {isRouboFurto && (
            <div className="rounded-xl bg-rose-50 border border-rose-300 p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <IconShieldX size={22} className="text-rose-600" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-rose-800">⚠️ Alerta: Veículo com ocorrência de roubo/furto</p>
                <p className="text-xs text-rose-700 mt-0.5">
                  Status retornado: <span className="font-mono font-bold">{result.rouboFurto}</span>. Proceda com cautela.
                </p>
              </div>
            </div>
          )}

          {/* ─── Valor FIPE ──────────────────────────────────────── */}
          {result.valorFipe !== undefined && result.valorFipe > 0 && (
            <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-900/70 flex items-center gap-1.5">
                  <IconCurrencyDollar size={16} /> Valor FIPE Oficial de Mercado
                </p>
                <p className="text-3xl font-black text-amber-950 mt-1">
                  {formatCurrency(result.valorFipe)}
                </p>
                {result.referenciaFipe && (
                  <p className="text-xs text-amber-900/60 mt-0.5 flex items-center gap-1">
                    <IconClock size={11} /> Referência: {result.referenciaFipe}
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
          )}

          {/* ─── Dados Básicos ───────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-400 mb-3 flex items-center gap-1.5">
              <IconCar size={12} /> Dados do Veículo
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { icon: <IconCalendar size={12} />, label: 'Ano', value: result.anoFabricacao !== result.anoModelo ? `${result.anoFabricacao}/${result.anoModelo}` : result.anoFabricacao },
                { icon: <IconGasStation size={12} />, label: 'Combustível', value: result.combustivel || '—' },
                { icon: <IconPalette size={12} />, label: 'Cor', value: result.cor || '—' },
                { icon: <IconMapPin size={12} />, label: 'Município', value: result.municipio && result.uf ? `${result.municipio}/${result.uf}` : result.uf || '—' },
                ...(result.especie ? [{ icon: <IconCar size={12} />, label: 'Espécie', value: result.especie }] : []),
                ...(result.tipo ? [{ icon: <IconCar size={12} />, label: 'Tipo', value: result.tipo }] : []),
              ].map(({ icon, label, value }) => (
                <div key={label} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                  <span className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1">
                    {icon} {label}
                  </span>
                  <p className="text-sm font-bold text-neutral-900 mt-1">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Dados de Identificação ──────────────────────────── */}
          {(result.chassi || result.renavam) && (
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-400 mb-3 flex items-center gap-1.5">
                <IconId size={12} /> Identificação
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.chassi && (
                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                    <span className="text-[10px] font-bold uppercase text-neutral-400">Chassi</span>
                    <p className="text-sm font-mono font-bold text-neutral-900 mt-1 break-all">{result.chassi}</p>
                  </div>
                )}
                {result.renavam && (
                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                    <span className="text-[10px] font-bold uppercase text-neutral-400">RENAVAM</span>
                    <p className="text-sm font-mono font-bold text-neutral-900 mt-1">{result.renavam}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Histórico de Preços FIPE ────────────────────────── */}
          {result.historicoPrecFipe && result.historicoPrecFipe.length > 0 && (
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-400 mb-3 flex items-center gap-1.5">
                <IconTrendingDown size={12} /> Histórico FIPE
              </p>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 divide-y divide-neutral-100">
                {result.historicoPrecFipe.slice(0, 6).map((h, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 first:pt-0 last:pb-0">
                    <span className="text-xs text-neutral-500">{h.mesReferencia}</span>
                    <span className="text-xs font-bold text-neutral-800">{h.valor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Ações ───────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-bold text-neutral-500 hover:text-neutral-800 flex items-center gap-1.5 cursor-pointer py-2"
            >
              <IconRefresh size={14} /> Nova Consulta
            </button>

            <div className="flex gap-3 w-full sm:w-auto">
              {onImport && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onImport(result)}
                  className="flex-1 sm:flex-none"
                >
                  Importar dados
                </Button>
              )}
              <Link
                href={`/dashboard/veiculos?marca=${encodeURIComponent(result.marca)}&modelo=${encodeURIComponent(result.modelo)}&ano=${result.anoFabricacao}&fipe=${result.valorFipe || ''}&placa=${result.placa !== 'CONSULTA' ? result.placa : ''}&renavam=${result.renavam || ''}&cor=${encodeURIComponent(result.cor || '')}&combustivel=${encodeURIComponent(result.combustivel || '')}`}
              >
                <Button
                  variant="liberty"
                  leftIcon={<IconPlus size={16} stroke={2.5} />}
                  className="w-full sm:w-auto"
                >
                  Cadastrar Veículo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  createVehicle,
  deleteVehicle,
  uploadVehiclePhotos,
  type Veiculo,
} from './actions'

// ─── Types ───────────────────────────────────────────────────────────────────

interface VeiculosClientProps {
  currentUser: any
  veiculos: Veiculo[]
}

interface PhotoPreview {
  file: File
  url: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function VeiculosClient({ currentUser, veiculos }: VeiculosClientProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentRole = currentUser?.user_metadata?.role

  // Estado do formulário
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Campos do veículo
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [ano, setAno] = useState('')
  const [cor, setCor] = useState('')
  const [quilometragem, setQuilometragem] = useState('')
  const [preco, setPreco] = useState('')
  const [cambio, setCambio] = useState('manual')
  const [combustivel, setCombustivel] = useState('flex')
  const [placa, setPlaca] = useState('')
  const [descricao, setDescricao] = useState('')

  // Fotos
  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const [uploadProgress, setUploadProgress] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const MAX_PHOTOS = 10

  // ─── Photo handling ──────────────────────────────────────────────────────

  const addPhotos = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    const remaining = MAX_PHOTOS - photos.length
    const toAdd = newFiles.slice(0, remaining)

    const previews: PhotoPreview[] = toAdd.map(file => ({
      file,
      url: URL.createObjectURL(file),
    }))

    setPhotos(prev => [...prev, ...previews])
  }, [photos.length])

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const copy = [...prev]
      URL.revokeObjectURL(copy[index].url)
      copy.splice(index, 1)
      return copy
    })
  }

  // ─── Drag & Drop ────────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files?.length) {
      addPhotos(e.dataTransfer.files)
    }
  }

  // ─── Form Submit ─────────────────────────────────────────────────────────

  const resetForm = () => {
    setMarca('')
    setModelo('')
    setAno('')
    setCor('')
    setQuilometragem('')
    setPreco('')
    setCambio('manual')
    setCombustivel('flex')
    setPlaca('')
    setDescricao('')
    photos.forEach(p => URL.revokeObjectURL(p.url))
    setPhotos([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      // 1. Upload das fotos
      let photoUrls: string[] = []
      if (photos.length > 0) {
        setUploadProgress(true)
        const photoFormData = new FormData()
        photos.forEach(p => photoFormData.append('photos', p.file))

        const uploadResult = await uploadVehiclePhotos(photoFormData)
        setUploadProgress(false)

        if (uploadResult.error) {
          setMessage({ type: 'error', text: uploadResult.error })
          setLoading(false)
          return
        }
        photoUrls = uploadResult.urls || []
      }

      // 2. Criar veículo
      const formData = new FormData()
      formData.append('marca', marca)
      formData.append('modelo', modelo)
      formData.append('ano', ano)
      formData.append('cor', cor)
      formData.append('quilometragem', quilometragem)
      formData.append('preco', preco)
      formData.append('cambio', cambio)
      formData.append('combustivel', combustivel)
      formData.append('placa', placa)
      formData.append('descricao', descricao)
      formData.append('fotos', JSON.stringify(photoUrls))

      const result = await createVehicle(formData)

      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: result.success || 'Veículo cadastrado!' })
        resetForm()
        setShowForm(false)
        router.refresh()
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro inesperado.' })
    } finally {
      setLoading(false)
      setUploadProgress(false)
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteLoading(true)
    try {
      const result = await deleteVehicle(deleteId)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: result.success || 'Removido!' })
        router.refresh()
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao deletar.' })
    } finally {
      setDeleteId(null)
      setDeleteLoading(false)
    }
  }

  // ─── Helpers de formatação ───────────────────────────────────────────────

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const formatKm = (value: number) =>
    new Intl.NumberFormat('pt-BR').format(value) + ' km'

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Cabeçalho */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Link href="/dashboard" className="hover:text-black hover:underline transition-all">
                Dashboard
              </Link>
              <span>/</span>
              <span className="font-medium text-neutral-900">Veículos</span>
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950">
              Gerenciar Veículos
            </h1>
          </div>

          {currentRole === 'admin' && (
            <button
              onClick={() => { setShowForm(!showForm); setMessage(null) }}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-medium px-5 py-2.5 transition-colors shadow-xs cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {showForm ? 'Cancelar' : 'Novo Veículo'}
            </button>
          )}
        </div>

        {/* Mensagem */}
        {message && (
          <div
            className={`mb-6 rounded-lg p-4 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Formulário de Cadastro */}
        {showForm && currentRole === 'admin' && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs mb-8">
            <h2 className="text-lg font-semibold text-neutral-900 mb-6">
              Cadastrar Novo Veículo
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Linha 1: Marca, Modelo, Ano */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="marca" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Marca *
                  </label>
                  <input
                    id="marca"
                    type="text"
                    required
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    placeholder="Ex: Toyota"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="modelo" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Modelo *
                  </label>
                  <input
                    id="modelo"
                    type="text"
                    required
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    placeholder="Ex: Corolla XEi"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="ano" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Ano *
                  </label>
                  <input
                    id="ano"
                    type="number"
                    required
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    value={ano}
                    onChange={(e) => setAno(e.target.value)}
                    placeholder="2024"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors"
                  />
                </div>
              </div>

              {/* Linha 2: Cor, Quilometragem, Preço */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="cor" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Cor
                  </label>
                  <input
                    id="cor"
                    type="text"
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                    placeholder="Ex: Prata"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="quilometragem" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Quilometragem
                  </label>
                  <input
                    id="quilometragem"
                    type="number"
                    min="0"
                    value={quilometragem}
                    onChange={(e) => setQuilometragem(e.target.value)}
                    placeholder="Ex: 45000"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="preco" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Preço (R$) *
                  </label>
                  <input
                    id="preco"
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                    placeholder="Ex: 120000"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors"
                  />
                </div>
              </div>

              {/* Linha 3: Câmbio, Combustível, Placa */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="cambio" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Câmbio
                  </label>
                  <select
                    id="cambio"
                    value={cambio}
                    onChange={(e) => setCambio(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:border-neutral-900 focus:outline-hidden transition-colors"
                  >
                    <option value="manual">Manual</option>
                    <option value="automatico">Automático</option>
                    <option value="cvt">CVT</option>
                    <option value="automatizado">Automatizado</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="combustivel" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Combustível
                  </label>
                  <select
                    id="combustivel"
                    value={combustivel}
                    onChange={(e) => setCombustivel(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:border-neutral-900 focus:outline-hidden transition-colors"
                  >
                    <option value="flex">Flex</option>
                    <option value="gasolina">Gasolina</option>
                    <option value="etanol">Etanol</option>
                    <option value="diesel">Diesel</option>
                    <option value="eletrico">Elétrico</option>
                    <option value="hibrido">Híbrido</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="placa" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Placa
                  </label>
                  <input
                    id="placa"
                    type="text"
                    value={placa}
                    onChange={(e) => setPlaca(e.target.value)}
                    placeholder="ABC-1D23"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label htmlFor="descricao" className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Descrição
                </label>
                <textarea
                  id="descricao"
                  rows={3}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Detalhes sobre o veículo, opcionais, revisões, etc."
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors resize-none"
                />
              </div>

              {/* Upload de Fotos */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
                  Fotos ({photos.length}/{MAX_PHOTOS})
                </label>

                {/* Área de Drop */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-all ${
                    isDragging
                      ? 'border-neutral-900 bg-neutral-100'
                      : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
                  } ${photos.length >= MAX_PHOTOS ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) addPhotos(e.target.files)
                      e.target.value = ''
                    }}
                  />
                  <svg className="mx-auto mb-2 text-neutral-400" width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="text-sm text-neutral-600 font-medium">
                    Arraste as fotos aqui ou <span className="text-neutral-950 underline">clique para selecionar</span>
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    JPG, PNG ou WebP • Máximo {MAX_PHOTOS} fotos
                  </p>
                </div>

                {/* Preview das Fotos */}
                {photos.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {photos.map((photo, index) => (
                      <div key={index} className="group relative aspect-square rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
                        <Image
                          src={photo.url}
                          alt={`Foto ${index + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removePhoto(index) }}
                          className="absolute top-1 right-1 rounded-full bg-black/60 hover:bg-black/80 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                        {index === 0 && (
                          <span className="absolute bottom-1 left-1 rounded bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wider">
                            Capa
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botão Submit */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm() }}
                  className="rounded-lg border border-neutral-200 hover:bg-neutral-100 px-5 py-2.5 text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white font-medium px-6 py-2.5 text-sm transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {uploadProgress ? 'Enviando fotos...' : loading ? 'Salvando...' : 'Cadastrar Veículo'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Aviso para não-admin */}
        {currentRole !== 'admin' && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs mb-8">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-5 text-amber-800">
              <p className="font-semibold mb-1">Acesso Restrito</p>
              <p className="text-sm">
                Apenas administradores podem cadastrar e gerenciar veículos.
              </p>
            </div>
          </div>
        )}

        {/* Lista de Veículos */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
            Veículos Cadastrados ({veiculos.length})
          </h3>

          {veiculos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-neutral-400">
                  <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M5 17H3v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-neutral-500">Nenhum veículo cadastrado ainda</p>
              <p className="text-xs text-neutral-400 mt-1">
                {currentRole === 'admin' ? 'Clique em "Novo Veículo" para começar.' : 'Aguarde um administrador cadastrar veículos.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {veiculos.map((v) => (
                <div
                  key={v.id}
                  className="group rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-16/10 bg-neutral-100">
                    {v.fotos?.length > 0 ? (
                      <Image
                        src={v.fotos[0]}
                        alt={`${v.marca} ${v.modelo}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-neutral-300">
                          <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M5 17H3v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                    {v.fotos?.length > 1 && (
                      <span className="absolute top-2 right-2 rounded-full bg-black/60 text-white text-[10px] font-bold px-2 py-0.5">
                        +{v.fotos.length - 1} fotos
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-neutral-900 truncate">
                          {v.marca} {v.modelo}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                          <span>{v.ano}</span>
                          {v.cor && (
                            <>
                              <span className="text-neutral-300">•</span>
                              <span>{v.cor}</span>
                            </>
                          )}
                          {v.quilometragem != null && (
                            <>
                              <span className="text-neutral-300">•</span>
                              <span>{formatKm(v.quilometragem)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
                        {v.cambio}
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
                        {v.combustivel}
                      </span>
                    </div>

                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-lg font-bold text-neutral-950">
                          {formatCurrency(v.preco)}
                        </p>

                        <div className="flex gap-2">
                          <Link
                            href={`/veiculos/${v.id}`}
                            target="_blank"
                            className="rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Link
                          </Link>
                          {currentRole === 'admin' && (
                            <button
                              onClick={() => setDeleteId(v.id)}
                              className="rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-neutral-900">Confirmar Exclusão</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Tem certeza que deseja remover este veículo? Esta ação não pode ser desfeita. As fotos também serão removidas.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleteLoading}
                className="rounded-lg border border-neutral-200 hover:bg-neutral-100 px-4 py-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-sm font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {deleteLoading ? 'Removendo...' : 'Sim, Remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

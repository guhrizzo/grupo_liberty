'use client'

import { useState, useRef, useCallback, useTransition, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IconPlus, IconUpload, IconX, IconCar, IconCash } from '@tabler/icons-react'
import LoadingBar from '../../components/LoadingBar'
import {
  Breadcrumb,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Select,
  Textarea,
  useToast,
} from '../../components/ui'
import { formatCurrency, formatKm } from '@/utils/format'
import { maskCPFCNPJ, maskPhone, maskPlate, maskRenavam, maskMoney, parseMoney, onlyDigits } from '@/utils/masks'
import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
  uploadVehiclePhotos,
  type Veiculo,
  type LocalizacaoVeiculo,
  type VeiculoFieldErrors,
} from './actions'

// ─── Types ───────────────────────────────────────────────────────────────────

interface VeiculosClientProps {
  currentUser: any
  veiculos: Veiculo[]
}

interface PhotoPreview {
  file?: File
  url: string
  isExisting?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Botão "X" discreto dentro do input (mobile-friendly). Aparece só quando há valor.
 * Usa `rightAdornment` do <Input />, que já reserva `pr-12` no campo.
 */
function ClearMoneyButton({
  value,
  onClear,
  label,
}: {
  value: string
  onClear: () => void
  label: string
}) {
  if (!value) return null
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={`Limpar ${label}`}
      title="Limpar"
      className="flex h-9 w-9 min-w-[36px] items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 active:bg-neutral-200 transition-colors cursor-pointer"
    >
      <IconX size={14} stroke={2.5} />
    </button>
  )
}

export default function VeiculosClient({ currentUser, veiculos }: VeiculosClientProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentRole = currentUser?.role

  // Estado do formulário
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<VeiculoFieldErrors>({})

  // Cliente
  const [nomeCliente, setNomeCliente] = useState('')
  const [cpfCliente, setCpfCliente] = useState('')
  const [enderecoCliente, setEnderecoCliente] = useState('')
  const [telefoneCliente, setTelefoneCliente] = useState('')

  // Campos do veículo
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [ano, setAno] = useState('')
  const [cor, setCor] = useState('')
  const [quilometragem, setQuilometragem] = useState('')
  const [preco, setPreco] = useState('')
  const [precoComDesconto, setPrecoComDesconto] = useState('')
  const [tabelaFipe, setTabelaFipe] = useState('')
  const [cambio, setCambio] = useState('manual')
  const [combustivel, setCombustivel] = useState('flex')
  const [placa, setPlaca] = useState('')
  const [renavam, setRenavam] = useState('')
  const [descricao, setDescricao] = useState('')
  const [localizacaoSelect, setLocalizacaoSelect] = useState<'jau' | 'bauru' | 'outro'>('jau')
  const [outraCidade, setOutraCidade] = useState('')
  const [finalidade, setFinalidade] = useState<'venda' | 'pessoal'>('venda')
  const [abaAtiva, setAbaAtiva] = useState<'venda' | 'pessoal'>('venda')
  const [filtroCidade, setFiltroCidade] = useState<string>('')
  const [filtroBusca, setFiltroBusca] = useState<string>('')

  // Financiamento
  const [banco, setBanco] = useState('')
  const [parcelasRestantes, setParcelasRestantes] = useState('')
  const [valorParcela, setValorParcela] = useState('')
  const [custoAcumulado, setCustoAcumulado] = useState('')

  // Acessória
  const [telefoneAcessoria, setTelefoneAcessoria] = useState('')

  // Débitos do veículo
  const [debitos, setDebitos] = useState('')
  const [sellerName, setSellerName] = useState('')
  const [sellerCpf, setSellerCpf] = useState('')
  const [sellerBirthDate, setSellerBirthDate] = useState('')
  const [sellerCity, setSellerCity] = useState('')
  const [isVehicleInSellersName, setIsVehicleInSellersName] = useState<'yes' | 'no' | ''>('')
  const [registeredOwnerName, setRegisteredOwnerName] = useState('')



  // Fotos
  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const [uploadProgress, setUploadProgress] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  // Reorder drag state
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deletePending, startDeleteTransition] = useTransition()

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
      if (!copy[index].isExisting) {
        URL.revokeObjectURL(copy[index].url)
      }
      copy.splice(index, 1)
      return copy
    })
  }

  // ─── Photo reorder (drag within grid) ───────────────────────────────────

  const handlePhotoDragStart = (e: React.DragEvent, index: number) => {
    dragIndexRef.current = index
    e.dataTransfer.effectAllowed = 'move'
    // Prevent the drop-zone handler from triggering
    e.stopPropagation()
  }

  const handlePhotoDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
      setDragOverIndex(index)
    }
  }

  const handlePhotoDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    const fromIndex = dragIndexRef.current
    if (fromIndex === null || fromIndex === dropIndex) {
      dragIndexRef.current = null
      setDragOverIndex(null)
      return
    }
    setPhotos(prev => {
      const copy = [...prev]
      const [moved] = copy.splice(fromIndex, 1)
      copy.splice(dropIndex, 0, moved)
      return copy
    })
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  const handlePhotoDragEnd = () => {
    dragIndexRef.current = null
    setDragOverIndex(null)
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
    setEditingId(null)
    setNomeCliente('')
    setCpfCliente('')
    setEnderecoCliente('')
    setTelefoneCliente('')
    setMarca('')
    setModelo('')
    setAno('')
    setCor('')
    setQuilometragem('')
    setPrecoComDesconto('')
    setTabelaFipe('')
    setCambio('manual')
    setCombustivel('flex')
    setPlaca('')
    setRenavam('')
    setDescricao('')
    setLocalizacaoSelect('jau')
    setOutraCidade('')
    setFinalidade('venda')
    setBanco('')
    setParcelasRestantes('')
    setValorParcela('')
    setCustoAcumulado('')
    setTelefoneAcessoria('')
    setDebitos('')
    setSellerName('')
    setSellerCpf('')
    setSellerBirthDate('')
    setSellerCity('')
    setIsVehicleInSellersName('')
    setRegisteredOwnerName('')
    setFieldErrors({})
    photos.forEach(p => {
      if (!p.isExisting) URL.revokeObjectURL(p.url)
    })
    setPhotos([])
  }

  const handleEdit = useCallback((veiculo: Veiculo) => {
    setEditingId(veiculo.id)
    setShowForm(true)
    setMessage(null)
    setFieldErrors({})

    setCpfCliente(veiculo.cpfCliente || '')
    setTelefoneCliente(veiculo.telefoneCliente || '')
    setMarca(veiculo.marca)
    setModelo(veiculo.modelo)
    setAno(String(veiculo.ano))
    setCor(veiculo.cor || '')
    setQuilometragem(veiculo.quilometragem !== null ? String(veiculo.quilometragem) : '')
    setPreco(veiculo.preco ? formatCurrency(veiculo.preco).replace('R$', '').trim() : '')
    setPrecoComDesconto(veiculo.precoComDesconto ? formatCurrency(veiculo.precoComDesconto).replace('R$', '').trim() : '')
    setTabelaFipe(veiculo.tabelaFipe ? formatCurrency(veiculo.tabelaFipe).replace('R$', '').trim() : '')
    setCambio(veiculo.cambio || 'manual')
    setCombustivel(veiculo.combustivel || 'flex')
    setPlaca(veiculo.placa || '')
    setRenavam(veiculo.renavam || '')
    setDescricao(veiculo.descricao || '')
    
    if (veiculo.localizacao === 'Jaú/SP') setLocalizacaoSelect('jau')
    else if (veiculo.localizacao === 'Bauru/SP') setLocalizacaoSelect('bauru')
    else {
      setLocalizacaoSelect('outro')
      setOutraCidade(veiculo.localizacao)
    }

    setFinalidade(veiculo.finalidade || 'venda')
    setParcelasRestantes(veiculo.parcelasRestantes !== null ? String(veiculo.parcelasRestantes) : '')
    setValorParcela(veiculo.valorParcela ? formatCurrency(veiculo.valorParcela).replace('R$', '').trim() : '')
    setCustoAcumulado(veiculo.custoAcumulado ? formatCurrency(veiculo.custoAcumulado).replace('R$', '').trim() : '')
    setTelefoneAcessoria(veiculo.telefoneAcessoria || '')
    setDebitos(veiculo.debitos ? formatCurrency(veiculo.debitos).replace('R$', '').trim() : '')
    setSellerName(veiculo.sellerName || '')
    setSellerCpf(veiculo.sellerCpf || '')
    setSellerBirthDate(veiculo.sellerBirthDate || '')
    setSellerCity(veiculo.sellerCity || '')
    setIsVehicleInSellersName(veiculo.isVehicleInSellersName !== undefined && veiculo.isVehicleInSellersName !== null ? (veiculo.isVehicleInSellersName ? 'yes' : 'no') : '')
    setRegisteredOwnerName(veiculo.registeredOwnerName || '')

    const loadedPhotos = (veiculo.fotos || []).map(url => ({
      url,
      isExisting: true
    }))
    setPhotos(loadedPhotos)

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setFieldErrors({})

    try {
      // 1. Upload das fotos NOVAS
      const newPhotos = photos.filter(p => !p.isExisting)
      let photoUrls: string[] = []

      if (newPhotos.length > 0) {
        setUploadProgress(true)
        const photoFormData = new FormData()
        newPhotos.forEach(p => photoFormData.append('photos', p.file!))

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
      // Cliente
      formData.append('nomeCliente', nomeCliente)
      formData.append('cpfCliente', onlyDigits(cpfCliente))
      formData.append('enderecoCliente', enderecoCliente)
      formData.append('telefoneCliente', onlyDigits(telefoneCliente))
      // Veículo
      formData.append('marca', marca)
      formData.append('modelo', modelo)
      formData.append('ano', ano)
      formData.append('cor', cor)
      formData.append('quilometragem', quilometragem)
      formData.append('preco', preco ? String(parseMoney(preco) || 0) : '')
      formData.append('precoComDesconto', precoComDesconto ? String(parseMoney(precoComDesconto) || 0) : '')
      formData.append('tabelaFipe', tabelaFipe ? String(parseMoney(tabelaFipe) || '') : '')
      formData.append('cambio', cambio)
      formData.append('combustivel', combustivel)
      formData.append('placa', placa.toUpperCase().replace(/[^A-Z0-9]/g, ''))
      formData.append('renavam', onlyDigits(renavam))
      const localizacaoValor = localizacaoSelect === 'outro' ? (outraCidade.trim() || 'Jaú/SP') : (localizacaoSelect === 'bauru' ? 'Bauru/SP' : 'Jaú/SP')
      formData.append('descricao', descricao)
      formData.append('localizacao', localizacaoValor)
      formData.append('finalidade', finalidade)

      let newPhotoIndex = 0
      const fotosFinalStr = JSON.stringify(photos.map(p => {
        if (p.isExisting) return p.url
        return photoUrls[newPhotoIndex++]
      }))
      formData.append('fotos', fotosFinalStr)

      // Financiamento
      formData.append('banco', banco)
      formData.append('parcelasRestantes', parcelasRestantes)
      formData.append('valorParcela', valorParcela ? String(parseMoney(valorParcela) || 0) : '')
      formData.append('custoAcumulado', custoAcumulado ? String(parseMoney(custoAcumulado) || 0) : '')
      // Acessória
      formData.append('telefoneAcessoria', onlyDigits(telefoneAcessoria))
      // Débitos
      formData.append('debitos', debitos ? String(parseMoney(debitos) || 0) : '')
      formData.append('sellerName', sellerName)
      formData.append('sellerCpf', sellerCpf)
      formData.append('sellerBirthDate', sellerBirthDate)
      formData.append('sellerCity', sellerCity)
      if (isVehicleInSellersName) {
        formData.append('isVehicleInSellersName', isVehicleInSellersName === 'yes' ? 'true' : 'false')
      }
      formData.append('registeredOwnerName', registeredOwnerName)

      let result
      if (editingId) {
        result = await updateVehicle(editingId, formData)
      } else {
        result = await createVehicle(formData)
      }

      if (result.error) {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: result.success || (editingId ? 'Veículo atualizado!' : 'Veículo cadastrado!') })
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

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) return '—'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const cidadesDisponiveis = useMemo(() => {
    const set = new Set<string>()
    veiculos.forEach((v) => {
      if (v.localizacao) set.add(v.localizacao)
    })
    return Array.from(set)
  }, [veiculos])

  const totalVenda = useMemo(() => veiculos.filter(v => (v.finalidade || 'venda') === 'venda').length, [veiculos])
  const totalPessoal = useMemo(() => veiculos.filter(v => v.finalidade === 'pessoal').length, [veiculos])

  const veiculosFiltrados = useMemo(() => {
    return veiculos.filter((v) => {
      const vFinalidade = v.finalidade || 'venda'
      if (vFinalidade !== abaAtiva) return false
      if (filtroCidade && v.localizacao !== filtroCidade) return false
      if (!filtroBusca.trim()) return true
      const q = filtroBusca.toLowerCase()
      return (
        v.marca.toLowerCase().includes(q) ||
        v.modelo.toLowerCase().includes(q) ||
        (v.placa && v.placa.toLowerCase().includes(q))
      )
    })
  }, [veiculos, abaAtiva, filtroCidade, filtroBusca])

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Breadcrumb
              items={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Veículos' },
              ]}
            />
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950">
              Gerenciar Veículos
            </h1>
          </div>

          {currentRole === 'admin' && (
            <Button
              variant={showForm ? 'secondary' : 'liberty'}
              leftIcon={!showForm ? <IconPlus size={16} stroke={2.5} /> : undefined}
              onClick={() => {
                if (showForm) {
                  resetForm()
                  setShowForm(false)
                } else {
                  setFinalidade(abaAtiva)
                  setShowForm(true)
                  setMessage(null)
                }
              }}
            >
              {showForm ? 'Cancelar' : 'Novo Veículo'}
            </Button>
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

        {/* Formulário de Cadastro / Edição */}
        {showForm && currentRole === 'admin' && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs mb-8">
            <h2 className="text-lg font-semibold text-neutral-900 mb-6">
              {editingId ? 'Editar Veículo' : 'Cadastrar Novo Veículo'}
            </h2>

            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-10">

              {/* ─── Cliente ────────────────────────────────────────── */}
              {/* 
              <div>
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                  Cliente
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    id="nomeCliente"
                    label="Nome"
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    placeholder="Nome do cliente"
                    autoComplete="off"
                  />

                  <Input
                    id="cpfCliente"
                    label="CPF"
                    value={cpfCliente}
                    onChange={(e) => setCpfCliente(maskCPFCNPJ(e.target.value))}
                    placeholder="000.000.000-00"
                    autoComplete="off"
                    inputMode="numeric"
                    mask="cpfCnpj"
                    error={fieldErrors.cpfCliente}
                  />

                  <Input
                    id="enderecoCliente"
                    label="Endereço"
                    value={enderecoCliente}
                    onChange={(e) => setEnderecoCliente(e.target.value)}
                    placeholder="Endereço do cliente"
                    autoComplete="off"
                    containerClassName="sm:col-span-2"
                  />

                  <Input
                    id="telefoneCliente"
                    label="Telefone"
                    value={telefoneCliente}
                    onChange={(e) => setTelefoneCliente(maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    autoComplete="off"
                    inputMode="tel"
                    mask="phone"
                    error={fieldErrors.telefoneCliente}
                    containerClassName="sm:col-span-2"
                  />
                </div>
              </div>
              */}



              {/* ─── Veículo ────────────────────────────────────────── */}
              <div>
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                  Veículo
                </h3>

                {/* Linha 1: Marca, Modelo, Ano */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    id="marca"
                    label="Marca *"
                    required
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    placeholder="Ex: Toyota"
                    autoComplete="off"
                    error={fieldErrors.marca}
                  />
                  <Input
                    id="modelo"
                    label="Modelo *"
                    required
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    placeholder="Ex: Corolla XEi"
                    autoComplete="off"
                    error={fieldErrors.modelo}
                  />
                  <Input
                    id="ano"
                    label="Ano *"
                    type="number"
                    required
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    value={ano}
                    onChange={(e) => setAno(e.target.value)}
                    placeholder="2024"
                    inputMode="numeric"
                    error={fieldErrors.ano}
                  />
                </div>

                {/* Linha 2: Cor, Quilometragem, Tabela FIPE */}
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3 mt-6">
                  <Input
                    id="cor"
                    label="Cor"
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                    placeholder="Ex: Prata"
                    autoComplete="off"
                  />
                  <Input
                    id="quilometragem"
                    label="Quilometragem"
                    type="number"
                    min="0"
                    value={quilometragem}
                    onChange={(e) => setQuilometragem(e.target.value)}
                    placeholder="Ex: 45000"
                    inputMode="numeric"
                    error={fieldErrors.quilometragem}
                  />
                  <Input
                    id="tabelaFipe"
                    label="Tabela FIPE (R$)"
                    type="text"
                    inputMode="decimal"
                    value={tabelaFipe}
                    onChange={(e) => setTabelaFipe(maskMoney(e.target.value))}
                    placeholder="R$ 0,00"
                    leftIcon={<IconCash size={14} />}
                    error={fieldErrors.tabelaFipe}
                    rightAdornment={
                      tabelaFipe ? (
                        <ClearMoneyButton
                          value={tabelaFipe}
                          onClear={() => setTabelaFipe('')}
                          label="Tabela FIPE"
                        />
                      ) : undefined
                    }
                  />
                </div>

                {/* Finalidade — switch acima do Valor da Venda */}
                <div className="mt-6 flex items-center gap-3">
                  <span className="text-sm font-medium text-neutral-700">Finalidade</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={finalidade === 'venda'}
                    aria-label={`Finalidade do veículo. Atual: ${finalidade === 'venda' ? 'Para Venda' : 'Pessoal'}.`}
                    onClick={() => {
                      const next = finalidade === 'venda' ? 'pessoal' : 'venda'
                      setFinalidade(next)
                      if (next === 'pessoal') setPrecoComDesconto('')
                    }}
                    className={[
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
                      'transition-colors duration-200 ease-out',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-liberty/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                      finalidade === 'venda' ? 'bg-emerald-500' : 'bg-neutral-300',
                    ].join(' ')}
                  >
                    <span
                      aria-hidden="true"
                      className={[
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0',
                        'transition-transform duration-200 ease-out',
                        finalidade === 'venda' ? 'translate-x-5' : 'translate-x-0.5',
                      ].join(' ')}
                    />
                  </button>
                  <span
                    className={[
                      'rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border',
                      finalidade === 'venda'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-purple-100 text-purple-800 border-purple-200',
                    ].join(' ')}
                  >
                    {finalidade === 'venda' ? 'Para Venda' : 'Pessoal'}
                  </span>
                </div>

                {/* Linha 3: Valor da Venda, Câmbio, Combustível */}
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3 mt-6">
                  <Input
                    id="preco"
                    label={`Valor da venda (R$)${finalidade === 'venda' ? ' *' : ''}`}
                    type="text"
                    inputMode="decimal"
                    required={finalidade === 'venda'}
                    value={preco}
                    onChange={(e) => setPreco(maskMoney(e.target.value))}
                    placeholder={finalidade === 'pessoal' ? 'Opcional' : 'R$ 0,00'}
                    leftIcon={<IconCash size={14} />}
                    error={fieldErrors.preco}
                    rightAdornment={
                      preco ? (
                        <ClearMoneyButton
                          value={preco}
                          onClear={() => setPreco('')}
                          label="Valor da venda"
                        />
                      ) : undefined
                    }
                  />
                  <Select
                    id="cambio"
                    label="Câmbio"
                    value={cambio}
                    onChange={(e) => setCambio(e.target.value)}
                  >
                    <option value="manual">Manual</option>
                    <option value="automatico">Automático</option>
                    <option value="cvt">CVT</option>
                    <option value="automatizado">Automatizado</option>
                  </Select>
                  <Select
                    id="combustivel"
                    label="Combustível"
                    value={combustivel}
                    onChange={(e) => setCombustivel(e.target.value)}
                  >
                    <option value="flex">Flex</option>
                    <option value="gasolina">Gasolina</option>
                    <option value="etanol">Etanol</option>
                    <option value="diesel">Diesel</option>
                    <option value="eletrico">Elétrico</option>
                    <option value="hibrido">Híbrido</option>
                  </Select>
                </div>

                {/* Linha 3.5: Preço com desconto (Para) — apenas para veículos de venda */}
                {finalidade === 'venda' && (
                  <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 mt-6">
                    <Input
                      id="precoComDesconto"
                      label="Preço com desconto — opcional"
                      type="text"
                      inputMode="decimal"
                      value={precoComDesconto}
                      onChange={(e) => setPrecoComDesconto(maskMoney(e.target.value))}
                      placeholder="R$ 0,00"
                      leftIcon={<IconCash size={14} />}
                      error={fieldErrors.precoComDesconto}
                      rightAdornment={
                        precoComDesconto ? (
                          <ClearMoneyButton
                            value={precoComDesconto}
                            onClear={() => setPrecoComDesconto('')}
                            label="Preço com desconto"
                          />
                        ) : undefined
                      }
                    />
                    <p className="self-center text-xs text-neutral-500 leading-snug">
                      Preencha para exibir o preço antigo riscado e o percentual de desconto
                      na vitrine pública. Deixe vazio para não destacar.
                    </p>
                  </div>
                )}

                {/* Linha 4: Placa, Renavam, Unidade, Finalidade */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
                  <Input
                    id="placa"
                    label="Placa"
                    value={placa}
                    onChange={(e) => setPlaca(maskPlate(e.target.value))}
                    placeholder="ABC-1D23"
                    autoComplete="off"
                    error={fieldErrors.placa}
                  />
                  <Input
                    id="renavam"
                    label="Renavam"
                    value={renavam}
                    onChange={(e) => setRenavam(maskRenavam(e.target.value))}
                    placeholder="00000000000"
                    autoComplete="off"
                    inputMode="numeric"
                    error={fieldErrors.renavam}
                  />
                  <Select
                    id="localizacao"
                    label="Unidade / Cidade *"
                    required
                    value={localizacaoSelect}
                    onChange={(e) => setLocalizacaoSelect(e.target.value as 'jau' | 'bauru' | 'outro')}
                  >
                    <option value="jau">Jaú/SP</option>
                    <option value="bauru">Bauru/SP</option>
                    <option value="outro">Outra cidade...</option>
                  </Select>
                </div>

                {localizacaoSelect === 'outro' && (
                  <div className="mt-4 max-w-md">
                    <Input
                      id="outraCidade"
                      label="Nome da Cidade *"
                      required
                      value={outraCidade}
                      onChange={(e) => setOutraCidade(e.target.value)}
                      placeholder="Ex: São Carlos/SP, Botucatu/SP"
                    />
                  </div>
                )}

                {/* Descrição */}
                <Textarea
                  id="descricao"
                  label="Descrição"
                  rows={3}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Detalhes sobre o veículo, opcionais, revisões, etc."
                  containerClassName="mt-4"
                />
              </div>

              {/* ─── Financiamento ──────────────────────────────────── */}
              <div>
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                  Financiamento
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    id="banco"
                    label="Banco"
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                    placeholder="Ex: Santander"
                    autoComplete="off"
                  />
                  <Input
                    id="parcelasRestantes"
                    label="Parcelas restantes"
                    type="number"
                    min="0"
                    value={parcelasRestantes}
                    onChange={(e) => setParcelasRestantes(e.target.value)}
                    placeholder="Ex: 24"
                    inputMode="numeric"
                    error={fieldErrors.parcelasRestantes}
                  />
                  <Input
                    id="valorParcela"
                    label="Valor da parcela (R$)"
                    type="text"
                    inputMode="decimal"
                    value={valorParcela}
                    onChange={(e) => setValorParcela(maskMoney(e.target.value))}
                    placeholder="R$ 0,00"
                    leftIcon={<IconCash size={14} />}
                    error={fieldErrors.valorParcela}
                    rightAdornment={
                      valorParcela ? (
                        <ClearMoneyButton
                          value={valorParcela}
                          onClear={() => setValorParcela('')}
                          label="Valor da parcela"
                        />
                      ) : undefined
                    }
                  />
                  <Input
                    id="custoAcumulado"
                    label="Custo acumulado (R$)"
                    type="text"
                    inputMode="decimal"
                    value={custoAcumulado}
                    onChange={(e) => setCustoAcumulado(maskMoney(e.target.value))}
                    placeholder="R$ 0,00"
                    leftIcon={<IconCash size={14} />}
                    error={fieldErrors.custoAcumulado}
                    rightAdornment={
                      custoAcumulado ? (
                        <ClearMoneyButton
                          value={custoAcumulado}
                          onClear={() => setCustoAcumulado('')}
                          label="Custo acumulado"
                        />
                      ) : undefined
                    }
                  />
                </div>
              </div>

              {/* ─── Acessória ──────────────────────────────────────── */}
              <div>
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                  Acessória
                </h3>
                <div className="grid gap-4">
                  <Input
                    id="telefoneAcessoria"
                    label="Telefone da acessória"
                    value={telefoneAcessoria}
                    onChange={(e) => setTelefoneAcessoria(maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    autoComplete="off"
                    inputMode="tel"
                    mask="phone"
                    error={fieldErrors.telefoneAcessoria}
                  />
                </div>
              </div>

              {/* ─── Débitos do Veículo ─────────────────────────────── */}
              <div>
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                  Débitos do Veículo
                </h3>
                <Textarea
                  id="debitos"
                  label="Débitos"
                  rows={3}
                  value={debitos}
                  onChange={(e) => setDebitos(e.target.value)}
                  placeholder="IPVA, multas, etc."
                  error={fieldErrors.debitos}
                />
              </div>

              {/* ─── Dados do Vendedor (apenas para veículos pessoais) ──────────── */}
              {finalidade === 'pessoal' && (
                <div>
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                    Dados do Vendedor
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      id="sellerName"
                      label="Nome do vendedor"
                      value={sellerName}
                      onChange={(e) => setSellerName(e.target.value)}
                      placeholder="Nome completo"
                      autoComplete="off"
                    />
                    <Input
                      id="sellerCpf"
                      label="CPF do vendedor"
                      value={sellerCpf}
                      onChange={(e) => setSellerCpf(maskCPFCNPJ(e.target.value))}
                      placeholder="000.000.000-00"
                      autoComplete="off"
                      inputMode="numeric"
                    />
                    <Input
                      id="sellerBirthDate"
                      label="Data de nascimento"
                      value={sellerBirthDate}
                      onChange={(e) => setSellerBirthDate(e.target.value)}
                      type="date"
                      autoComplete="off"
                    />
                    <Input
                      id="sellerCity"
                      label="Cidade"
                      value={sellerCity}
                      onChange={(e) => setSellerCity(e.target.value)}
                      placeholder="Ex: Jaú/SP"
                      autoComplete="off"
                    />
                  </div>

                  {/* Veículo no nome do vendedor? */}
                  <div className="mt-4">
                    <p className="block text-xs font-semibold text-neutral-700 mb-2">
                      O veículo está no nome do vendedor?
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setIsVehicleInSellersName('yes')}
                        className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-[background-color,border-color,color] duration-200 cursor-pointer ${
                          isVehicleInSellersName === 'yes'
                            ? 'border-liberty bg-liberty/10 text-liberty-deep'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsVehicleInSellersName('no')}
                        className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-[background-color,border-color,color] duration-200 cursor-pointer ${
                          isVehicleInSellersName === 'no'
                            ? 'border-red-400 bg-red-50 text-red-600'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        Não
                      </button>
                    </div>

                    {isVehicleInSellersName === 'no' && (
                      <div className="mt-3">
                        <Input
                          id="registeredOwnerName"
                          label="Nome de quem está registrado o veículo"
                          value={registeredOwnerName}
                          onChange={(e) => setRegisteredOwnerName(e.target.value)}
                          placeholder="Nome completo do proprietário registrado"
                          autoComplete="off"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Upload de Fotos ────────────────────────────────── */}
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
                  className={`relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-[background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
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
                  <IconUpload className="mx-auto mb-2 text-neutral-400" size={32} stroke={1.5} />
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
                      <div
                        key={photo.url}
                        draggable
                        onDragStart={(e) => handlePhotoDragStart(e, index)}
                        onDragOver={(e) => handlePhotoDragOver(e, index)}
                        onDrop={(e) => handlePhotoDrop(e, index)}
                        onDragEnd={handlePhotoDragEnd}
                        className={`group relative aspect-square rounded-lg overflow-hidden border-2 bg-neutral-100 transition-[border-color,box-shadow,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-grab active:cursor-grabbing select-none ${
                          dragOverIndex === index
                            ? 'border-neutral-900 scale-105 shadow-lg'
                            : dragIndexRef.current === index
                            ? 'border-dashed border-neutral-400 opacity-50'
                            : 'border-neutral-200'
                        }`}
                      >
                        <Image
                          src={photo.url}
                          alt={`Foto ${index + 1}`}
                          fill
                          className="object-cover pointer-events-none"
                          unoptimized
                        />
                        {/* Drag handle hint */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="bg-black/40 rounded-md p-1.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                              <path d="M9 3h1M9 9h1M9 15h1M9 21h1M15 3h1M15 9h1M15 15h1M15 21h1" strokeLinecap="round"/>
                            </svg>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removePhoto(index) }}
                          className="absolute top-1 right-1 rounded-full bg-black/60 hover:bg-black/80 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                        >
                          <IconX size={12} stroke={2.5} />
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
                {photos.length > 1 && (
                  <p className="mt-2 text-[11px] text-neutral-400 flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 3h1M9 9h1M9 15h1M9 21h1M15 3h1M15 9h1M15 15h1M15 21h1" strokeLinecap="round"/></svg>
                    Arraste as fotos para reordenar. A primeira imagem será a capa.
                  </p>
                )}
              </div>

              {/* Botão Submit */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm() }}
                  className="rounded-lg border border-neutral-200 hover:bg-neutral-100 px-5 py-2.5 text-sm font-medium transition-ui cursor-pointer"
                >
                  Cancelar
                </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white font-medium px-6 py-2.5 text-sm transition-ui shadow-xs disabled:opacity-50 cursor-pointer"
        >
          {uploadProgress ? 'Enviando fotos...' : loading ? 'Salvando...' : 'Cadastrar Veículo'}
        </button>
      </div>
      {loading && <LoadingBar className="h-0.5" />}
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

        {/* ─── Abas de Finalidade ─────────────────────────────── */}
        <div className="border-b border-neutral-200 mb-6">
          <nav className="-mb-px flex gap-0">
            <button
              type="button"
              onClick={() => { setAbaAtiva('venda'); setFiltroBusca(''); setFiltroCidade('') }}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors duration-200 cursor-pointer ${
                abaAtiva === 'venda'
                  ? 'border-neutral-950 text-neutral-950'
                  : 'border-transparent text-neutral-400 hover:text-neutral-700 hover:border-neutral-300'
              }`}
            >
              <span>Para Venda</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                abaAtiva === 'venda' ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-500'
              }`}>
                {totalVenda}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setAbaAtiva('pessoal'); setFiltroBusca(''); setFiltroCidade('') }}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors duration-200 cursor-pointer ${
                abaAtiva === 'pessoal'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-neutral-400 hover:text-neutral-700 hover:border-neutral-300'
              }`}
            >
              <span>Pessoal</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                abaAtiva === 'pessoal' ? 'bg-purple-600 text-white' : 'bg-neutral-100 text-neutral-500'
              }`}>
                {totalPessoal}
              </span>
            </button>
          </nav>
        </div>

        {/* Lista de Veículos */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
              {abaAtiva === 'venda' ? 'Veículos para Venda' : 'Veículos Pessoais'} ({veiculosFiltrados.length})
            </h3>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Input
                placeholder="Buscar por marca, modelo ou placa..."
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
                containerClassName="w-full sm:w-64"
              />
              <Select
                value={filtroCidade}
                onChange={(e) => setFiltroCidade(e.target.value)}
                containerClassName="w-full sm:w-44"
              >
                <option value="">Todas as cidades</option>
                {cidadesDisponiveis.map((cidade) => (
                  <option key={cidade} value={cidade}>
                    {cidade}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {veiculosFiltrados.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center">
                <IconCar size={24} stroke={1.5} className="text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-500">
                {veiculos.length === 0
                  ? 'Nenhum veículo cadastrado ainda'
                  : 'Nenhum veículo encontrado com os filtros atuais'}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {currentRole === 'admin'
                  ? 'Clique em "Novo Veículo" para começar ou ajuste a busca.'
                  : 'Aguarde um administrador cadastrar veículos.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {veiculosFiltrados.map((v) => (
                <div
                  key={v.id}
                  className="group rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden hover:shadow-lg hover:shadow-neutral-900/5 hover:-translate-y-1 hover:border-neutral-300 transition-[box-shadow,border-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-neutral-100">
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
                      <IconCar size={40} stroke={1.5} className="text-neutral-300" />
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
                      {v.finalidade === 'pessoal' ? (
                        <span className="rounded-full bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          Pessoal
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          Para Venda
                        </span>
                      )}
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
                        {v.cambio}
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
                        {v.combustivel}
                      </span>
                      <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        {v.localizacao || 'Jaú/SP'}
                      </span>
                    </div>

                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-lg font-bold text-neutral-950">
                          {formatCurrency(v.preco)}
                        </p>

                        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                          <Link
                            href={`/veiculos/${v.id}`}
                            target="_blank"
                            className="w-full text-center rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 px-3 py-2 text-xs font-semibold transition-[background-color,color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer sm:w-auto"
                          >
                            Link
                          </Link>
                          {currentRole === 'admin' && (
                            <>
                              <button
                                onClick={() => handleEdit(v)}
                                className="w-full rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 px-3 py-2 text-xs font-semibold transition-[background-color,color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer sm:w-auto"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => setDeleteId(v.id)}
                                className="w-full rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 px-3 py-2 text-xs font-semibold transition-[background-color,color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer sm:w-auto"
                              >
                                Remover
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                  </div>
                </div>
              ))}
            </div>
          )}
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
                className="rounded-lg border border-neutral-200 hover:bg-neutral-100 px-4 py-2 text-sm font-medium transition-[background-color,color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
          <button
            onClick={() => {
              startDeleteTransition(async () => {
                await handleDelete()
              })
            }}
            disabled={deleteLoading || deletePending}
            className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-sm font-semibold transition-[background-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {deleteLoading || deletePending ? 'Removendo...' : 'Sim, Remover'}
          </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
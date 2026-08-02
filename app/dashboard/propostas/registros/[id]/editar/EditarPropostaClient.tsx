'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  IconUser,
  IconMail,
  IconPhone,
  IconCoin,
  IconArrowLeft,
  IconCar,
  IconTool,
  IconTrash,
  IconPlus,
  IconCalendar,
  IconHash,
  IconReceipt,
  IconAlertTriangle,
  IconCalculator,
  IconDeviceFloppy,
} from '@tabler/icons-react'
import { Breadcrumb, useToast, Input, Select, BancoAutocomplete } from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'
import { parseMoney, onlyDigits, maskPlate, maskPhone, maskCPFCNPJ, maskMoney, moneyFromNumber } from '@/utils/masks'
import { validarCPF } from '@/utils/validadorCpf'
import { getBancoByNome } from '@/constants/bancos'
import type { CreatePropostaInput } from '../../../actions'
import { updatePropostaRegistrada, type PropostaRegistradaEditavel } from '../../actions'

interface EditarPropostaClientProps {
  proposta: PropostaRegistradaEditavel
}

interface FormData {
  nome: string
  cpf: string
  telefone: string
  email: string
  cliente_data: string
  numero_contrato: string

  veiculo_marca: string
  veiculo_modelo: string
  veiculo_ano: string
  veiculo_placa: string
  veiculo_valor_fipe: string
  valor_estimado_divida: string

  valor_ipva: string
  valor_licenciamento: string
  valor_multas: string

  valor_parcela: string
  parcelas_totais: string
  parcelas_pagas: string
  parcelas_atrasadas: string
  banco: string

  pecas: Array<{ nome: string; valor: string }>

  valor_proposta: string
  status: 'pendente' | 'aceito' | 'recusado'
}

function FormattedMoneyHint({ value }: { value: string }) {
  const num = value.trim() ? parseMoney(value) : null
  if (num == null || num <= 0) return null
  return <p className="mt-1 text-[11px] font-semibold text-liberty-deep">{formatCurrency(num)}</p>
}

function buildInitialFormData(p: PropostaRegistradaEditavel): FormData {
  return {
    nome: p.nome,
    cpf: maskCPFCNPJ(p.cpfDigits),
    telefone: p.telefone,
    email: p.email,
    cliente_data: p.cliente_data ?? '',
    numero_contrato: p.numero_contrato ?? '',

    veiculo_marca: p.veiculo_marca,
    veiculo_modelo: p.veiculo_modelo,
    veiculo_ano: p.veiculo_ano != null ? String(p.veiculo_ano) : '',
    veiculo_placa: p.veiculo_placa ?? '',
    veiculo_valor_fipe: moneyFromNumber(p.veiculo_valor_fipe),
    valor_estimado_divida: moneyFromNumber(p.valor_estimado_divida),

    valor_ipva: moneyFromNumber(p.valor_ipva),
    valor_licenciamento: moneyFromNumber(p.valor_licenciamento),
    valor_multas: moneyFromNumber(p.valor_multas),

    valor_parcela: moneyFromNumber(p.valor_parcela),
    parcelas_totais: p.parcelas_totais != null ? String(p.parcelas_totais) : '',
    parcelas_pagas: p.parcelas_pagas != null ? String(p.parcelas_pagas) : '',
    parcelas_atrasadas: p.parcelas_atrasadas != null ? String(p.parcelas_atrasadas) : '',
    banco: p.banco ?? '',

    pecas: (p.pecas_conserto ?? []).map((peca) => ({
      nome: peca.nome,
      valor: moneyFromNumber(peca.valor),
    })),

    valor_proposta: moneyFromNumber(p.valor),
    status: p.status,
  }
}

export default function EditarPropostaClient({ proposta }: EditarPropostaClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<FormData>(() => buildInitialFormData(proposta))
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [dividaEditadaManualmente, setDividaEditadaManualmente] = useState(false)

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    setFormErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const valorPropostaNum = formData.valor_proposta.trim() ? parseMoney(formData.valor_proposta) : null

  const totalPecas = useMemo(() => {
    return formData.pecas.reduce((acc, p) => {
      if (!p.nome.trim()) return acc
      const v = p.valor.trim() ? parseMoney(p.valor) : 0
      return acc + v
    }, 0)
  }, [formData.pecas])

  // Mesma fórmula da tela "Nova proposta": metade da FIPE − quitação estimada
  // da dívida em aberto (parcelas restantes × valor da parcela) × (1 − % de
  // quitação do banco selecionado).
  const parcelasEmAberto = Math.max(
    0,
    (Number(formData.parcelas_totais) || 0) - (Number(formData.parcelas_pagas) || 0),
  )
  const valorParcelaNum = formData.valor_parcela.trim() ? parseMoney(formData.valor_parcela) : 0
  const dividaTotal = parcelasEmAberto * valorParcelaNum
  const bancoInfo = getBancoByNome(formData.banco)
  const quitacaoPercent = bancoInfo?.descontoPercent ?? null
  const quitacaoEstimada = quitacaoPercent != null ? dividaTotal * (1 - quitacaoPercent / 100) : null
  const valorFipe = formData.veiculo_valor_fipe.trim() ? parseMoney(formData.veiculo_valor_fipe) : 0
  const valorBruto = quitacaoEstimada != null ? valorFipe / 2 - quitacaoEstimada : null
  const propostaPreviaValor = valorBruto != null ? Math.max(0, valorBruto) : null

  const dividaEstimadaCalculada =
    (formData.valor_ipva.trim() ? parseMoney(formData.valor_ipva) : 0) +
    (formData.valor_licenciamento.trim() ? parseMoney(formData.valor_licenciamento) : 0) +
    (formData.valor_multas.trim() ? parseMoney(formData.valor_multas) : 0) +
    dividaTotal +
    totalPecas

  const comissaoVendedor = useMemo(() => {
    if (valorPropostaNum == null || propostaPreviaValor == null) return null
    return 300 + (propostaPreviaValor - valorPropostaNum) * 0.06
  }, [valorPropostaNum, propostaPreviaValor])

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {}

    const nomeTrim = formData.nome.trim()
    if (!nomeTrim || nomeTrim.length < 2) errors.nome = 'Informe o nome completo do cliente.'

    const cpfDigits = onlyDigits(formData.cpf)
    if (!cpfDigits) errors.cpf = 'Informe o CPF.'
    else if (!validarCPF(cpfDigits)) errors.cpf = 'CPF inválido.'

    const telDigits = onlyDigits(formData.telefone)
    if (!telDigits || telDigits.length < 10) errors.telefone = 'Informe um telefone com DDD.'

    const emailTrim = formData.email.trim()
    if (!emailTrim || !emailTrim.includes('@') || !emailTrim.includes('.')) {
      errors.email = 'Informe um e-mail válido.'
    }

    if (!formData.veiculo_marca.trim()) errors.veiculo_marca = 'Informe a marca.'
    if (!formData.veiculo_modelo.trim()) errors.veiculo_modelo = 'Informe o modelo.'

    if (valorPropostaNum != null && propostaPreviaValor != null && valorPropostaNum > propostaPreviaValor) {
      errors.valor_proposta = 'O valor da proposta não pode ser maior que a proposta prévia.'
    }

    const pecasInvalidas = formData.pecas.filter((p) => !p.nome.trim() && p.valor.trim())
    if (pecasInvalidas.length > 0) {
      toast.error('Preencha o nome de todas as peças com valor.', 'Formulário incompleto')
      return false
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      toast.error('Confira os campos destacados antes de continuar.', 'Formulário incompleto')
      return false
    }

    setFormErrors({})
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setSaving(true)
    try {
      const payload: CreatePropostaInput = {
        nome: formData.nome.trim(),
        cpf: onlyDigits(formData.cpf),
        telefone: formData.telefone.trim(),
        email: formData.email.trim(),
        cliente_data: formData.cliente_data || null,
        numero_contrato: formData.numero_contrato.trim() || null,

        veiculo_marca: formData.veiculo_marca.trim(),
        veiculo_modelo: formData.veiculo_modelo.trim(),
        veiculo_ano: formData.veiculo_ano.trim() ? Number(formData.veiculo_ano) : null,
        veiculo_placa: formData.veiculo_placa.trim(),
        veiculo_valor_fipe: formData.veiculo_valor_fipe.trim()
          ? parseMoney(formData.veiculo_valor_fipe)
          : null,
        valor_estimado_divida: formData.valor_estimado_divida.trim()
          ? parseMoney(formData.valor_estimado_divida)
          : null,

        valor_ipva: formData.valor_ipva.trim() ? parseMoney(formData.valor_ipva) : null,
        valor_licenciamento: formData.valor_licenciamento.trim()
          ? parseMoney(formData.valor_licenciamento)
          : null,
        valor_multas: formData.valor_multas.trim() ? parseMoney(formData.valor_multas) : null,

        valor_parcela: formData.valor_parcela.trim() ? parseMoney(formData.valor_parcela) : null,
        parcelas_totais: formData.parcelas_totais.trim() ? Number(formData.parcelas_totais) : null,
        parcelas_pagas: formData.parcelas_pagas.trim() ? Number(formData.parcelas_pagas) : null,
        parcelas_atrasadas: formData.parcelas_atrasadas.trim()
          ? Number(formData.parcelas_atrasadas)
          : null,
        banco: formData.banco.trim() || null,

        pecasConserto: formData.pecas.map((p) => ({
          nome: p.nome.trim(),
          valor: p.valor.trim() ? parseMoney(p.valor) : 0,
        })),

        valor: valorPropostaNum,
        proposta_previa: propostaPreviaValor,
        status: formData.status,
      }

      const res = await updatePropostaRegistrada(proposta.id, payload)
      if (res.error || !res.success) {
        toast.error(res.error || 'Não foi possível salvar', 'Erro ao salvar')
        return
      }
      toast.success(res.success, 'Proposta atualizada')
      router.push('/dashboard/propostas/registros')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado.'
      toast.error(message, 'Erro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 pb-28 md:space-y-6 md:pb-0">
      <header className="space-y-3">
        <div className="hidden md:block">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Propostas', href: '/dashboard/propostas' },
              { label: 'Registros', href: '/dashboard/propostas/registros' },
              { label: 'Editar' },
            ]}
          />
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight text-neutral-950 md:text-3xl">
              Editar proposta
            </h1>
            <p className="mt-0.5 text-xs text-neutral-500 md:mt-1 md:text-sm">{proposta.nome}</p>
          </div>
          <Link
            href="/dashboard/propostas/registros"
            aria-label="Voltar para Registros"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer md:px-4"
          >
            <IconArrowLeft size={14} stroke={2.5} />
            <span className="hidden sm:inline">Voltar</span>
          </Link>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-liberty/30 bg-liberty/5 p-4 shadow-xs">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-liberty/15 text-liberty-deep">
            <IconCoin size={20} stroke={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-liberty-deep/70">
              Comissão do vendedor
            </p>
            <p className="text-xl font-black leading-tight text-liberty-deep sm:text-2xl">
              {comissaoVendedor != null ? formatCurrency(comissaoVendedor) : '—'}
            </p>
          </div>
        </div>
        <p className="hidden max-w-[240px] shrink-0 text-right text-[11px] text-neutral-500 sm:block">
          R$ 300 fixos + 6% sobre a diferença entre a proposta prévia e o valor da proposta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
        {/* Cliente */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs md:p-6">
          <h3 className="mb-4 text-sm font-bold text-neutral-950">Dados do cliente</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome completo"
              value={formData.nome}
              onChange={(e) => setField('nome', e.target.value)}
              error={formErrors.nome}
              leftIcon={<IconUser size={14} />}
              required
            />
            <Input
              label="CPF"
              value={formData.cpf}
              inputMode="numeric"
              onChange={(e) => setField('cpf', maskCPFCNPJ(e.target.value))}
              error={formErrors.cpf}
              required
            />
            <Input
              label="Telefone / WhatsApp"
              value={formData.telefone}
              inputMode="tel"
              onChange={(e) => setField('telefone', maskPhone(e.target.value))}
              error={formErrors.telefone}
              leftIcon={<IconPhone size={14} />}
              required
            />
            <Input
              label="E-mail"
              type="email"
              value={formData.email}
              onChange={(e) => setField('email', e.target.value)}
              error={formErrors.email}
              leftIcon={<IconMail size={14} />}
              required
            />
            <Input
              label="Data da proposta"
              type="date"
              value={formData.cliente_data}
              onChange={(e) => setField('cliente_data', e.target.value)}
              leftIcon={<IconCalendar size={14} />}
            />
            <Input
              label="Número do Contrato"
              value={formData.numero_contrato}
              onChange={(e) => setField('numero_contrato', e.target.value)}
              leftIcon={<IconHash size={14} />}
            />
          </div>
        </div>

        {/* Veículo */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs md:p-6">
          <h3 className="mb-4 text-sm font-bold text-neutral-950">Veículo</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Marca"
              value={formData.veiculo_marca}
              onChange={(e) => setField('veiculo_marca', e.target.value)}
              error={formErrors.veiculo_marca}
              leftIcon={<IconCar size={14} />}
              required
            />
            <Input
              label="Modelo"
              value={formData.veiculo_modelo}
              onChange={(e) => setField('veiculo_modelo', e.target.value)}
              error={formErrors.veiculo_modelo}
              required
            />
            <Input
              label="Placa"
              value={formData.veiculo_placa}
              onChange={(e) => setField('veiculo_placa', maskPlate(e.target.value))}
              leftIcon={<IconReceipt size={14} />}
            />
            <Input
              label="Ano do Veículo"
              type="number"
              inputMode="numeric"
              value={formData.veiculo_ano}
              onChange={(e) => setField('veiculo_ano', e.target.value)}
            />
            <div>
              <Input
                label="Valor FIPE"
                placeholder="0,00"
                value={formData.veiculo_valor_fipe}
                inputMode="numeric"
                onChange={(e) => setField('veiculo_valor_fipe', maskMoney(e.target.value))}
                leftIcon={<IconCoin size={14} />}
              />
              <FormattedMoneyHint value={formData.veiculo_valor_fipe} />
            </div>
          </div>
        </div>

        {/* Pendências */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs md:p-6">
          <h3 className="mb-4 text-sm font-bold text-neutral-950">Pendências / Débitos</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Input
                label="Valor do IPVA"
                placeholder="0,00"
                value={formData.valor_ipva}
                inputMode="numeric"
                onChange={(e) => setField('valor_ipva', maskMoney(e.target.value))}
                leftIcon={<IconReceipt size={14} />}
              />
              <FormattedMoneyHint value={formData.valor_ipva} />
            </div>
            <div>
              <Input
                label="Valor do Licenciamento"
                placeholder="0,00"
                value={formData.valor_licenciamento}
                inputMode="numeric"
                onChange={(e) => setField('valor_licenciamento', maskMoney(e.target.value))}
                leftIcon={<IconReceipt size={14} />}
              />
              <FormattedMoneyHint value={formData.valor_licenciamento} />
            </div>
            <div>
              <Input
                label="Valor das Multas"
                placeholder="0,00"
                value={formData.valor_multas}
                inputMode="numeric"
                onChange={(e) => setField('valor_multas', maskMoney(e.target.value))}
                leftIcon={<IconAlertTriangle size={14} />}
              />
              <FormattedMoneyHint value={formData.valor_multas} />
            </div>
          </div>
        </div>

        {/* Parcelas */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs md:p-6">
          <h3 className="mb-4 text-sm font-bold text-neutral-950">Parcelas do Financiamento</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <BancoAutocomplete value={formData.banco} onChange={(v) => setField('banco', v)} />
            <Input
              label="Valor das parcelas"
              placeholder="0,00"
              value={formData.valor_parcela}
              inputMode="numeric"
              onChange={(e) => setField('valor_parcela', maskMoney(e.target.value))}
              leftIcon={<IconCoin size={14} />}
            />
            <Input
              label="Parcelas totais"
              type="number"
              inputMode="numeric"
              value={formData.parcelas_totais}
              onChange={(e) => setField('parcelas_totais', e.target.value)}
            />
            <Input
              label="Parcelas pagas"
              type="number"
              inputMode="numeric"
              value={formData.parcelas_pagas}
              onChange={(e) => setField('parcelas_pagas', e.target.value)}
            />
            <Input
              label="Parcelas atrasadas"
              type="number"
              inputMode="numeric"
              value={formData.parcelas_atrasadas}
              onChange={(e) => setField('parcelas_atrasadas', e.target.value)}
            />
          </div>
        </div>

        {/* Peças */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs md:p-6">
          <h3 className="mb-4 text-sm font-bold text-neutral-950">Peças que exigem reparo</h3>
          <div className="space-y-2">
            {formData.pecas.map((p, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center"
              >
                <div className="relative flex-1">
                  <span
                    aria-hidden
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                  >
                    <IconTool size={13} />
                  </span>
                  <input
                    type="text"
                    value={p.nome}
                    onChange={(e) => {
                      const novo = [...formData.pecas]
                      novo[idx] = { ...novo[idx], nome: e.target.value }
                      setField('pecas', novo)
                    }}
                    placeholder="Nome da peça"
                    className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
                <div className="relative w-full sm:w-40">
                  <span
                    aria-hidden
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                  >
                    <IconCoin size={13} />
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={p.valor}
                    onChange={(e) => {
                      const novo = [...formData.pecas]
                      novo[idx] = { ...novo[idx], valor: maskMoney(e.target.value) }
                      setField('pecas', novo)
                    }}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setField('pecas', formData.pecas.filter((_, i) => i !== idx))}
                  aria-label="Remover peça"
                  className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-ui cursor-pointer"
                >
                  <IconTrash size={13} stroke={2.5} />
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setField('pecas', [...formData.pecas, { nome: '', valor: '' }])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:border-liberty/40 hover:bg-liberty/5 hover:text-liberty-deep transition-ui cursor-pointer"
              >
                <IconPlus size={12} stroke={2.5} />
                Adicionar peça
              </button>
              {formData.pecas.length > 0 && (
                <span className="text-[11px] font-semibold text-neutral-600">
                  Total estimado:{' '}
                  <strong className="text-liberty-deep">{formatCurrency(totalPecas)}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Valor estimado da dívida */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs md:p-6">
          <div className="max-w-md">
            <Input
              label="Valor estimado da dívida"
              placeholder="0,00"
              value={formData.valor_estimado_divida}
              inputMode="numeric"
              onChange={(e) => {
                setDividaEditadaManualmente(true)
                setField('valor_estimado_divida', maskMoney(e.target.value))
              }}
              leftIcon={<IconCalculator size={18} />}
              className="py-3.5 text-base"
              hint={
                dividaEditadaManualmente
                  ? 'Ajustado manualmente.'
                  : 'Calculado automaticamente: IPVA + licenciamento + multas + saldo das parcelas restantes + peças.'
              }
            />
            <FormattedMoneyHint value={formData.valor_estimado_divida} />
            {!dividaEditadaManualmente && (
              <button
                type="button"
                onClick={() => setField('valor_estimado_divida', moneyFromNumber(dividaEstimadaCalculada))}
                className="mt-2 text-[11px] font-bold text-liberty-deep hover:underline cursor-pointer"
              >
                Recalcular automaticamente
              </button>
            )}
          </div>
        </div>

        {/* Proposta Prévia (somente leitura) */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs md:p-6">
          <h3 className="mb-4 text-sm font-bold text-neutral-950">Proposta Prévia (calculada)</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3 text-xs text-neutral-700">
              <div className="flex items-center justify-between gap-2">
                <span>1/2 Valor FIPE</span>
                <span className="font-semibold">{formatCurrency(valorFipe / 2)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Dívida em aberto ({parcelasEmAberto} parcelas restantes × parcela)</span>
                <span className="font-semibold">{formatCurrency(dividaTotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>
                  % Quitação do banco{bancoInfo ? ` — ${bancoInfo.nome}` : ''}
                </span>
                <span className="font-semibold">{quitacaoPercent != null ? `${quitacaoPercent}%` : '—'}</span>
              </div>
              {!bancoInfo && (
                <p className="flex items-start gap-1.5 pt-1 text-amber-700">
                  <IconAlertTriangle size={12} className="mt-0.5 shrink-0" stroke={2.2} />
                  Selecione um banco da lista para calcular a % de quitação.
                </p>
              )}
            </div>
            <div className="rounded-lg border border-liberty/20 bg-liberty/5 p-4 text-xs text-neutral-700">
              <p className="font-bold text-liberty-deep">Valor da Proposta Prévia</p>
              <p className="mt-1 text-2xl font-bold text-liberty-deep">
                {propostaPreviaValor != null ? formatCurrency(propostaPreviaValor) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Proposta */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs md:p-6">
          <h3 className="mb-4 text-sm font-bold text-neutral-950">Valor da Proposta e Status</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Input
                label="Valor da Proposta"
                placeholder="0,00"
                value={formData.valor_proposta}
                inputMode="numeric"
                onChange={(e) => setField('valor_proposta', maskMoney(e.target.value))}
                error={formErrors.valor_proposta}
                leftIcon={<IconCoin size={14} />}
                required
              />
              <FormattedMoneyHint value={formData.valor_proposta} />
            </div>
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setField('status', e.target.value as FormData['status'])}
              options={[
                { value: 'pendente', label: 'Pendente' },
                { value: 'aceito', label: 'Aceito' },
                { value: 'recusado', label: 'Recusado' },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse items-center justify-end gap-3 sm:flex-row">
          <Link
            href="/dashboard/propostas/registros"
            className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-center text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer sm:w-auto"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-liberty px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer hover:bg-liberty-deep disabled:opacity-50 sm:w-auto"
          >
            {saving ? (
              <>
                <svg className="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Salvando...
              </>
            ) : (
              <>
                <IconDeviceFloppy size={14} stroke={2.5} />
                Salvar alterações
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

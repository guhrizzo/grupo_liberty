'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { IconCar, IconPencil, IconShieldCheck } from '@tabler/icons-react'
import { Button, EmptyState, Input, Modal, Select, Textarea, useToast } from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'
import { maskMoney, moneyFromNumber, parseMoney } from '@/utils/masks'
import { salvarSeguro } from './actions'
import { SEGURO_OBS_MAX, SEGURO_STATUS, type SeguroStatus, type VeiculoSeguro } from './types'

const COR_STATUS: Record<SeguroStatus, string> = {
  pendente: 'bg-amber-100 text-amber-800',
  cancelado: 'bg-emerald-100 text-emerald-700',
  inexistente: 'bg-neutral-100 text-neutral-600',
}

function nomeVeiculo(v: VeiculoSeguro) {
  return `${v.marca} ${v.modelo} ${v.ano}${v.placa ? ` · ${v.placa}` : ''}`
}

export default function SegurosClient({ seguros }: { seguros: VeiculoSeguro[] }) {
  const [status, setStatus] = useState<SeguroStatus | ''>('')
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<VeiculoSeguro | null>(null)
  const router = useRouter()

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return seguros.filter(
      (s) => (!status || s.status === status) && (!termo || nomeVeiculo(s).toLowerCase().includes(termo)),
    )
  }, [seguros, status, busca])

  const totais = useMemo(
    () => ({
      previsto: lista.reduce((t, s) => t + s.valorPrevisto, 0),
      cancelado: lista.reduce((t, s) => t + s.valorCancelado, 0),
    }),
    [lista],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          aria-label="Buscar veículo"
          placeholder="Buscar por marca, modelo ou placa"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          containerClassName="w-full sm:w-80"
        />
        <Select
          aria-label="Filtrar por situação"
          value={status}
          onChange={(e) => setStatus(e.target.value as SeguroStatus | '')}
          containerClassName="w-full sm:w-56"
          options={[{ value: '', label: 'Todas as situações' }, ...SEGURO_STATUS]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Reembolso previsto</p>
          <p className="mt-1 text-xl font-black text-neutral-900">{formatCurrency(totais.previsto)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Realmente cancelado</p>
          <p className="mt-1 text-xl font-black text-liberty-deep">{formatCurrency(totais.cancelado)}</p>
        </div>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={<IconShieldCheck size={24} stroke={1.5} />}
          title="Nenhum veículo encontrado"
          description="Ajuste a busca ou o filtro de situação."
        />
      ) : (
        <ul className="space-y-3">
          {lista.map((s) => (
            <li
              key={s.veiculoId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                  {s.foto ? (
                    <Image src={s.foto} alt={nomeVeiculo(s)} fill className="object-cover" sizes="64px" />
                  ) : (
                    <IconCar size={20} stroke={1.5} className="absolute inset-0 m-auto text-neutral-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-neutral-900">{nomeVeiculo(s)}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${COR_STATUS[s.status]}`}
                    >
                      {SEGURO_STATUS.find((o) => o.value === s.status)?.label}
                    </span>
                    {s.status !== 'inexistente' && <span>Previsto: {formatCurrency(s.valorPrevisto)}</span>}
                    {s.status === 'cancelado' && (
                      <span>
                        · Cancelado: <b className="text-liberty-deep">{formatCurrency(s.valorCancelado)}</b>
                      </span>
                    )}
                  </p>
                  {s.observacao && <p className="mt-1 text-xs text-neutral-600">{s.observacao}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditando(s)}
                aria-label={`Editar seguro de ${nomeVeiculo(s)}`}
                className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
              >
                <IconPencil size={14} stroke={2.5} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <SeguroModal
          key={editando.veiculoId}
          seguro={editando}
          onClose={() => setEditando(null)}
          onDone={() => {
            setEditando(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function SeguroModal({
  seguro,
  onClose,
  onDone,
}: {
  seguro: VeiculoSeguro
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [status, setStatus] = useState<SeguroStatus>(seguro.status)
  const [previsto, setPrevisto] = useState(seguro.valorPrevisto ? moneyFromNumber(seguro.valorPrevisto) : '')
  const [cancelado, setCancelado] = useState(seguro.valorCancelado ? moneyFromNumber(seguro.valorCancelado) : '')
  const [observacao, setObservacao] = useState(seguro.observacao)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (status === 'cancelado' && parseMoney(cancelado) <= 0) {
      return void toast.error('Informe o valor realmente cancelado.')
    }
    setSalvando(true)
    try {
      const res = await salvarSeguro({
        veiculoId: seguro.veiculoId,
        status,
        valorPrevisto: parseMoney(previsto),
        valorCancelado: parseMoney(cancelado),
        observacao,
      })
      if (res.error) return void toast.error(res.error, 'Não foi possível salvar')
      toast.success(res.success || 'Seguro atualizado.')
      onDone()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={() => !salvando && onClose()} title={`Seguro · ${nomeVeiculo(seguro)}`}>
      <div className="mt-4 space-y-4">
        <Select
          label="Situação"
          value={status}
          onChange={(e) => setStatus(e.target.value as SeguroStatus)}
          options={SEGURO_STATUS}
        />
        {status !== 'inexistente' && (
          <Input
            label="Valor previsto de reembolso (R$)"
            type="text"
            inputMode="decimal"
            value={previsto}
            onChange={(e) => setPrevisto(maskMoney(e.target.value))}
            placeholder="R$ 0,00"
          />
        )}
        {status === 'cancelado' && (
          <Input
            label="Valor realmente cancelado (R$)"
            type="text"
            inputMode="decimal"
            value={cancelado}
            onChange={(e) => setCancelado(maskMoney(e.target.value))}
            placeholder="R$ 0,00"
          />
        )}
        <Textarea
          label="Observação (opcional)"
          value={observacao}
          maxLength={SEGURO_OBS_MAX}
          onChange={(e) => setObservacao(e.target.value)}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" variant="liberty" loading={salvando} onClick={salvar}>
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

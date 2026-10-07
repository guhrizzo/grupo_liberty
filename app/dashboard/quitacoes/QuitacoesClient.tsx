'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconCash, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { Button, ConfirmDialog, EmptyState, Input, Modal, Select, Textarea, useToast } from '@/app/components/ui'
import { formatCurrency, formatDate } from '@/utils/format'
import { maskMoney, moneyFromNumber, parseMoney } from '@/utils/masks'
import { atualizarQuitacao, criarQuitacao, excluirQuitacao } from './actions'
import { QUITACAO_OBS_MAX, type Quitacao, type VeiculoQuitacaoOpcao } from './types'

interface Props {
  quitacoes: Quitacao[]
  veiculos: VeiculoQuitacaoOpcao[]
  veiculoInicial: string
}

function nomeVeiculo(v: VeiculoQuitacaoOpcao | undefined) {
  if (!v) return 'Veículo removido'
  return `${v.marca} ${v.modelo} ${v.ano}${v.placa ? ` · ${v.placa}` : ''}`
}

function hojeIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function QuitacoesClient({ quitacoes, veiculos, veiculoInicial }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [filtroVeiculo, setFiltroVeiculo] = useState(veiculos.some((v) => v.id === veiculoInicial) ? veiculoInicial : '')
  const [editando, setEditando] = useState<Quitacao | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<Quitacao | null>(null)
  const [apagando, setApagando] = useState(false)

  const porId = useMemo(() => new Map(veiculos.map((v) => [v.id, v])), [veiculos])

  // A lista já vem da mais recente para a mais antiga: a primeira de cada veículo é a "atual".
  const ultimaPorVeiculo = useMemo(() => {
    const m = new Map<string, string>()
    for (const q of quitacoes) if (!m.has(q.veiculoId)) m.set(q.veiculoId, q.id)
    return m
  }, [quitacoes])

  const lista = useMemo(
    () => (filtroVeiculo ? quitacoes.filter((q) => q.veiculoId === filtroVeiculo) : quitacoes),
    [quitacoes, filtroVeiculo],
  )

  const veiculosComQuitacao = useMemo(() => {
    const ids = new Set(quitacoes.map((q) => q.veiculoId))
    return veiculos.filter((v) => ids.has(v.id))
  }, [quitacoes, veiculos])

  async function excluir() {
    if (!excluindo) return
    setApagando(true)
    try {
      const res = await excluirQuitacao(excluindo.id)
      if (res.error) toast.error(res.error, 'Não foi possível excluir')
      else {
        toast.success(res.success || 'Quitação excluída.')
        router.refresh()
      }
    } finally {
      setApagando(false)
      setExcluindo(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select
          aria-label="Filtrar por veículo"
          value={filtroVeiculo}
          onChange={(e) => setFiltroVeiculo(e.target.value)}
          containerClassName="w-full sm:w-80"
          options={[
            { value: '', label: 'Todos os veículos' },
            ...veiculosComQuitacao.map((v) => ({ value: v.id, label: nomeVeiculo(v) })),
          ]}
        />
        <Button type="button" variant="liberty" onClick={() => setEditando('novo')}>
          <IconPlus size={16} stroke={2.5} />
          Registrar quitação
        </Button>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={<IconCash size={24} stroke={1.5} />}
          title="Nenhuma quitação registrada"
          description="Registre o valor de quitação negociado com o banco e a data. O histórico de cada veículo fica aqui."
        />
      ) : (
        <ul className="space-y-3">
          {lista.map((q) => (
            <li key={q.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-neutral-900">{nomeVeiculo(porId.get(q.veiculoId))}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <span>Negociada em {formatDate(q.data)}</span>
                    <span>· por {q.criadoPorNome}</span>
                    {ultimaPorVeiculo.get(q.veiculoId) === q.id && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                        Atual
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-liberty-deep">{formatCurrency(q.valor)}</span>
                  <button
                    type="button"
                    onClick={() => setEditando(q)}
                    aria-label="Editar quitação"
                    className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    <IconPencil size={14} stroke={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcluindo(q)}
                    aria-label="Excluir quitação"
                    className="inline-flex items-center rounded-lg border border-rose-200 bg-white px-2.5 py-2 text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    <IconTrash size={14} stroke={2.5} />
                  </button>
                </div>
              </div>
              {q.observacao && <p className="mt-2 text-sm text-neutral-600">{q.observacao}</p>}
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <QuitacaoModal
          key={editando === 'novo' ? 'novo' : editando.id}
          quitacao={editando === 'novo' ? null : editando}
          veiculos={veiculos}
          veiculoPadrao={filtroVeiculo}
          onClose={() => setEditando(null)}
          onDone={() => {
            setEditando(null)
            router.refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={excluindo != null}
        onClose={() => !apagando && setExcluindo(null)}
        onConfirm={excluir}
        title="Excluir quitação"
        description="O registro some do histórico. Se for a atual, a anterior passa a aparecer na aba Veículos."
        confirmLabel="Excluir"
        tone="danger"
        loading={apagando}
      />
    </div>
  )
}

function QuitacaoModal({
  quitacao,
  veiculos,
  veiculoPadrao,
  onClose,
  onDone,
}: {
  quitacao: Quitacao | null
  veiculos: VeiculoQuitacaoOpcao[]
  veiculoPadrao: string
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [veiculoId, setVeiculoId] = useState(quitacao?.veiculoId ?? veiculoPadrao)
  const [valor, setValor] = useState(quitacao ? moneyFromNumber(quitacao.valor) : '')
  const [data, setData] = useState(quitacao?.data ?? hojeIso())
  const [observacao, setObservacao] = useState(quitacao?.observacao ?? '')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!veiculoId) return void toast.error('Escolha o veículo.')
    const numero = parseMoney(valor)
    if (numero <= 0) return void toast.error('Informe o valor da quitação.')
    if (!data) return void toast.error('Informe a data da negociação.')
    setSalvando(true)
    try {
      const input = { veiculoId, valor: numero, data, observacao }
      const res = quitacao ? await atualizarQuitacao(quitacao.id, input) : await criarQuitacao(input)
      if (res.error) return void toast.error(res.error, 'Não foi possível salvar')
      toast.success(res.success || 'Quitação salva.')
      onDone()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={() => !salvando && onClose()} title={quitacao ? 'Editar quitação' : 'Registrar quitação'}>
      <div className="mt-4 space-y-4">
        <Select
          label="Veículo"
          value={veiculoId}
          onChange={(e) => setVeiculoId(e.target.value)}
          disabled={quitacao != null}
          options={[
            { value: '', label: 'Selecione o veículo' },
            ...veiculos.map((v) => ({ value: v.id, label: nomeVeiculo(v) })),
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Valor negociado (R$)"
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(maskMoney(e.target.value))}
            placeholder="R$ 0,00"
          />
          <Input label="Data da negociação" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <Textarea
          label="Observação (opcional)"
          value={observacao}
          maxLength={QUITACAO_OBS_MAX}
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

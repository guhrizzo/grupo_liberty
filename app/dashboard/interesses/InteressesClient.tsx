'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconBrandWhatsapp, IconHeartHandshake, IconPencil, IconPhone, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react'
import { Button, ConfirmDialog, EmptyState, Input, Modal, Select, Textarea, useToast } from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'
import { maskMoney, maskPhone, moneyFromNumber, onlyDigits, parseMoney } from '@/utils/masks'
import { CAMBIO_OPCOES, COMBUSTIVEL_OPCOES } from '@/utils/veiculos/opcoes'
import { atualizarInteresse, criarInteresse, definirStatusInteresse, excluirInteresse } from './actions'
import { veiculoCasaComInteresse } from './match'
import {
  INTERESSE_OBS_MAX,
  INTERESSE_STATUS,
  INTERESSE_STATUS_LABEL,
  type Interesse,
  type InteresseStatus,
  type VeiculoEstoqueResumo,
} from './types'

interface Props {
  interesses: Interesse[]
  estoque: VeiculoEstoqueResumo[]
}

const STATUS_ESTILO: Record<InteresseStatus, { ativo: string; selo: string }> = {
  ativo: { ativo: 'bg-emerald-600 text-white', selo: 'bg-emerald-100 text-emerald-700' },
  atendido: { ativo: 'bg-sky-600 text-white', selo: 'bg-sky-100 text-sky-700' },
  cancelado: { ativo: 'bg-neutral-500 text-white', selo: 'bg-neutral-200 text-neutral-600' },
}

/** "Honda Civic · 2018–2022 · até R$ 90.000 · Automático · Flex · Preto" */
function resumoPedido(i: Interesse): string {
  const anos =
    i.anoMin && i.anoMax ? `${i.anoMin}–${i.anoMax}` : i.anoMin ? `a partir de ${i.anoMin}` : i.anoMax ? `até ${i.anoMax}` : ''
  const cambio = CAMBIO_OPCOES.find((o) => o.value === i.cambio)?.label
  const comb = COMBUSTIVEL_OPCOES.find((o) => o.value === i.combustivel)?.label
  return [
    [i.marca, i.modelo].filter(Boolean).join(' ') || 'Qualquer modelo',
    anos,
    i.precoMax ? `até ${formatCurrency(i.precoMax)}` : '',
    cambio,
    comb,
    i.cor,
  ]
    .filter(Boolean)
    .join(' · ')
}

export default function InteressesClient({ interesses, estoque }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<InteresseStatus | 'todos'>('ativo')
  const [editando, setEditando] = useState<Interesse | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<Interesse | null>(null)
  const [apagando, setApagando] = useState(false)
  const [alterandoId, setAlterandoId] = useState<string | null>(null)

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return interesses.filter((i) => {
      if (statusFiltro !== 'todos' && i.status !== statusFiltro) return false
      if (!q) return true
      return [i.clienteNome, i.marca, i.modelo, i.clienteTelefone].some((t) => t.toLowerCase().includes(q))
    })
  }, [interesses, busca, statusFiltro])

  const contagem = useMemo(() => {
    const c: Record<InteresseStatus, number> = { ativo: 0, atendido: 0, cancelado: 0 }
    for (const i of interesses) c[i.status]++
    return c
  }, [interesses])

  async function trocarStatus(i: Interesse, status: InteresseStatus) {
    if (status === i.status) return
    setAlterandoId(i.id)
    try {
      const res = await definirStatusInteresse(i.id, status)
      if (res.error) toast.error(res.error, 'Não foi possível alterar')
      else router.refresh()
    } finally {
      setAlterandoId(null)
    }
  }

  async function excluir() {
    if (!excluindo) return
    setApagando(true)
    try {
      const res = await excluirInteresse(excluindo.id)
      if (res.error) toast.error(res.error, 'Não foi possível excluir')
      else {
        toast.success(res.success || 'Interesse excluído.')
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
        <div className="relative w-full sm:w-80">
          <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, marca ou modelo..."
            className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none"
          />
        </div>
        <Button type="button" variant="liberty" onClick={() => setEditando('novo')}>
          <IconPlus size={16} stroke={2.5} />
          Novo interesse
        </Button>
      </div>

      <div role="group" aria-label="Filtrar por status" className="inline-flex max-w-full overflow-x-auto rounded-lg bg-neutral-100 p-1">
        {(['ativo', 'atendido', 'cancelado', 'todos'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFiltro(s)}
            aria-pressed={statusFiltro === s}
            className={`shrink-0 rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
              statusFiltro === s ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {s === 'todos' ? `Todos (${interesses.length})` : `${INTERESSE_STATUS_LABEL[s]}s (${contagem[s]})`}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={<IconHeartHandshake size={24} stroke={1.5} />}
          title="Nenhum interesse encontrado"
          description={
            interesses.length === 0
              ? 'Registre o carro que um cliente quer. Quando um veículo que combina entrar, o painel avisa.'
              : 'Nenhum interesse com esse filtro.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtrados.map((i) => {
            const casam = i.status === 'ativo' ? estoque.filter((v) => veiculoCasaComInteresse(i, v)) : []
            const tel = onlyDigits(i.clienteTelefone)
            return (
              <li key={i.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="flex flex-wrap items-center gap-2 text-base font-bold text-neutral-900">
                      {i.clienteNome}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${STATUS_ESTILO[i.status].selo}`}
                      >
                        {INTERESSE_STATUS_LABEL[i.status]}
                      </span>
                    </h3>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                      <a href={`tel:+55${tel}`} className="inline-flex items-center gap-1 font-semibold text-neutral-800">
                        <IconPhone size={13} className="text-neutral-400" />
                        {i.clienteTelefone}
                      </a>
                      <a
                        href={`https://wa.me/55${tel}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                      >
                        <IconBrandWhatsapp size={14} />
                        WhatsApp
                      </a>
                      <span className="text-neutral-400">registrado por {i.criadoPorNome}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditando(i)}
                      aria-label="Editar interesse"
                      className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                    >
                      <IconPencil size={14} stroke={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcluindo(i)}
                      aria-label="Excluir interesse"
                      className="inline-flex items-center rounded-lg border border-rose-200 bg-white px-2.5 py-2 text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <IconTrash size={14} stroke={2.5} />
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-sm font-semibold text-neutral-800">{resumoPedido(i)}</p>
                {i.observacao && <p className="mt-1 text-sm text-neutral-600">{i.observacao}</p>}

                {i.status === 'ativo' && (
                  <div
                    className={`mt-3 rounded-lg border p-3 text-xs ${
                      casam.length > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-neutral-200 bg-neutral-50 text-neutral-500'
                    }`}
                  >
                    {casam.length === 0 ? (
                      'Nenhum veículo do estoque combina com esse pedido por enquanto.'
                    ) : (
                      <>
                        <p className="font-bold">
                          {casam.length} veículo{casam.length === 1 ? '' : 's'} no estoque combina{casam.length === 1 ? '' : 'm'}:
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {casam.map((v) => (
                            <li key={v.id}>
                              {v.marca} {v.modelo} {v.ano}
                              {v.preco != null ? ` · ${formatCurrency(v.preco)}` : ''}
                              {v.placa ? ` · ${v.placa}` : ''}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}

                <div
                  role="group"
                  aria-label={`Status do interesse de ${i.clienteNome}`}
                  className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 sm:inline-grid sm:w-auto"
                >
                  {INTERESSE_STATUS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={alterandoId === i.id}
                      onClick={() => trocarStatus(i, s)}
                      aria-pressed={i.status === s}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                        i.status === s ? STATUS_ESTILO[s].ativo : 'text-neutral-600 hover:bg-white'
                      }`}
                    >
                      {INTERESSE_STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editando && (
        <InteresseModal
          key={editando === 'novo' ? 'novo' : editando.id}
          interesse={editando === 'novo' ? null : editando}
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
        title="Excluir interesse"
        description="O pedido do cliente é removido. Para guardar o histórico, prefira marcar como Atendido ou Cancelado."
        confirmLabel="Excluir"
        tone="danger"
        loading={apagando}
      />
    </div>
  )
}

function InteresseModal({
  interesse,
  onClose,
  onDone,
}: {
  interesse: Interesse | null
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [clienteNome, setClienteNome] = useState(interesse?.clienteNome ?? '')
  const [clienteTelefone, setClienteTelefone] = useState(interesse?.clienteTelefone ?? '')
  const [marca, setMarca] = useState(interesse?.marca ?? '')
  const [modelo, setModelo] = useState(interesse?.modelo ?? '')
  const [anoMin, setAnoMin] = useState(interesse?.anoMin ? String(interesse.anoMin) : '')
  const [anoMax, setAnoMax] = useState(interesse?.anoMax ? String(interesse.anoMax) : '')
  const [precoMax, setPrecoMax] = useState(interesse?.precoMax ? moneyFromNumber(interesse.precoMax) : '')
  const [cambio, setCambio] = useState(interesse?.cambio ?? '')
  const [combustivel, setCombustivel] = useState(interesse?.combustivel ?? '')
  const [cor, setCor] = useState(interesse?.cor ?? '')
  const [observacao, setObservacao] = useState(interesse?.observacao ?? '')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    try {
      const input = {
        clienteNome,
        clienteTelefone,
        marca,
        modelo,
        anoMin: anoMin ? Number(anoMin) : null,
        anoMax: anoMax ? Number(anoMax) : null,
        precoMax: precoMax ? parseMoney(precoMax) : null,
        cambio,
        combustivel,
        cor,
        observacao,
        status: interesse?.status ?? ('ativo' as InteresseStatus),
      }
      const res = interesse ? await atualizarInteresse(interesse.id, input) : await criarInteresse(input)
      if (res.error) return void toast.error(res.error, 'Não foi possível salvar')
      toast.success(res.success || 'Interesse salvo.')
      onDone()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={() => !salvando && onClose()} title={interesse ? 'Editar interesse' : 'Novo interesse'} size="lg">
      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nome do cliente" value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
          <Input
            label="Telefone"
            type="tel"
            inputMode="tel"
            value={clienteTelefone}
            onChange={(e) => setClienteTelefone(maskPhone(e.target.value))}
            placeholder="(00) 00000-0000"
          />
        </div>

        <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">O que procura (vazio = tanto faz)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Marca" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex.: Honda" />
          <Input label="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex.: Civic" />
          <Input
            label="Ano a partir de"
            type="text"
            inputMode="numeric"
            value={anoMin}
            onChange={(e) => setAnoMin(onlyDigits(e.target.value).slice(0, 4))}
            placeholder="2018"
          />
          <Input
            label="Ano até"
            type="text"
            inputMode="numeric"
            value={anoMax}
            onChange={(e) => setAnoMax(onlyDigits(e.target.value).slice(0, 4))}
            placeholder="2023"
          />
          <Input
            label="Preço máximo (R$)"
            type="text"
            inputMode="decimal"
            value={precoMax}
            onChange={(e) => setPrecoMax(maskMoney(e.target.value))}
            placeholder="R$ 0,00"
          />
          <Input label="Cor" value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Ex.: Preto" />
          <Select label="Câmbio" value={cambio} onChange={(e) => setCambio(e.target.value)}>
            <option value="">Tanto faz</option>
            {CAMBIO_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select label="Combustível" value={combustivel} onChange={(e) => setCombustivel(e.target.value)}>
            <option value="">Tanto faz</option>
            {COMBUSTIVEL_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <Textarea
          label="Observação (opcional)"
          value={observacao}
          maxLength={INTERESSE_OBS_MAX}
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

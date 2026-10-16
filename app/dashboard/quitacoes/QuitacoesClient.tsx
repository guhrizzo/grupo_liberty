'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  IconCar,
  IconCash,
  IconCheck,
  IconChevronDown,
  IconListDetails,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUserEdit,
} from '@tabler/icons-react'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FiltrosAtivos,
  Input,
  Modal,
  Textarea,
  useToast,
} from '@/app/components/ui'
import { casaBusca } from '@/utils/busca'
import { formatCurrency, formatDate } from '@/utils/format'
import { maskCPFCNPJ, maskMoney, moneyFromNumber, parseMoney } from '@/utils/masks'
import {
  atualizarQuitacao,
  criarQuitacao,
  criarQuitacoesLote,
  criarVeiculoTerceiro,
  definirQuitado,
  excluirQuitacao,
  excluirVeiculoTerceiro,
  salvarFicha,
} from './actions'
import {
  QUITACAO_OBS_MAX,
  type FichaQuitacao,
  type Quitacao,
  type VeiculoQuitacaoOpcao,
} from './types'

interface Props {
  quitacoes: Quitacao[]
  veiculos: VeiculoQuitacaoOpcao[]
  fichas: Record<string, FichaQuitacao>
  veiculoInicial: string
}

type Situacao = '' | 'nao-quitado' | 'quitado'

function nomeVeiculo(v: VeiculoQuitacaoOpcao | undefined) {
  if (!v) return 'Veículo removido'
  return `${v.marca} ${v.modelo} ${v.ano}${v.placa ? ` · ${v.placa}` : ''}`
}

function hojeIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Idade em anos completos a partir de YYYY-MM-DD; null se a data for inválida. */
function calcularIdade(nascimento: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return null
  const [a, m, d] = nascimento.split('-').map(Number)
  const hoje = new Date()
  let idade = hoje.getFullYear() - a
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) idade -= 1
  return idade >= 0 ? idade : null
}

function FotoVeiculo({ v }: { v: VeiculoQuitacaoOpcao | undefined }) {
  return (
    <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
      {v?.foto ? (
        <Image src={v.foto} alt={nomeVeiculo(v)} fill className="object-cover" sizes="64px" />
      ) : (
        <IconCar size={20} stroke={1.5} className="absolute inset-0 m-auto text-neutral-300" />
      )}
    </div>
  )
}

export default function QuitacoesClient({ quitacoes, veiculos, fichas, veiculoInicial }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<Situacao>('')
  const [abertos, setAbertos] = useState<Set<string>>(
    () => new Set(veiculos.some((v) => v.id === veiculoInicial) ? [veiculoInicial] : []),
  )
  const [atualizando, setAtualizando] = useState<{ veiculoId: string; quitacao: Quitacao | null } | null>(null)
  const [excluindo, setExcluindo] = useState<Quitacao | null>(null)
  const [editandoFicha, setEditandoFicha] = useState<VeiculoQuitacaoOpcao | null>(null)
  const [novoTerceiro, setNovoTerceiro] = useState(false)
  const [removendoTerceiro, setRemovendoTerceiro] = useState<VeiculoQuitacaoOpcao | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [lote, setLote] = useState(false)

  // Histórico de cada veículo, da mais recente para a mais antiga (a primeira é a "atual").
  const historicoPorVeiculo = useMemo(() => {
    const m = new Map<string, Quitacao[]>()
    for (const q of quitacoes) m.set(q.veiculoId, [...(m.get(q.veiculoId) ?? []), q])
    return m
  }, [quitacoes])

  const naoQuitados = useMemo(() => veiculos.filter((v) => !fichas[v.id]?.quitado), [veiculos, fichas])

  const lista = useMemo(
    () =>
      veiculos
        .filter((v) => {
          const quitado = fichas[v.id]?.quitado === true
          if (situacao === 'quitado' && !quitado) return false
          if (situacao === 'nao-quitado' && quitado) return false
          const f = fichas[v.id]
          return casaBusca(busca, [v.marca, v.modelo, `${v.marca} ${v.modelo}`, v.placa, f?.nome, f?.cpf, f?.numeroContrato])
        })
        // Não quitados primeiro; dentro de cada grupo, ordem alfabética.
        .sort(
          (a, b) =>
            Number(fichas[a.id]?.quitado === true) - Number(fichas[b.id]?.quitado === true) ||
            nomeVeiculo(a).localeCompare(nomeVeiculo(b), 'pt-BR'),
        ),
    [veiculos, fichas, busca, situacao],
  )

  const contagem = useMemo(() => {
    const quitados = veiculos.filter((v) => fichas[v.id]?.quitado === true).length
    return { todos: veiculos.length, quitados, naoQuitados: veiculos.length - quitados }
  }, [veiculos, fichas])

  const filtros = [
    ...(busca.trim() ? [{ id: 'busca', label: `Busca: ${busca.trim()}`, onRemove: () => setBusca('') }] : []),
    ...(situacao
      ? [{ id: 'situacao', label: situacao === 'quitado' ? 'Quitados' : 'Não quitados', onRemove: () => setSituacao('') }]
      : []),
  ]

  function alternar(id: string) {
    setAbertos((prev) => {
      const prox = new Set(prev)
      if (!prox.delete(id)) prox.add(id)
      return prox
    })
  }

  async function alternarQuitado(v: VeiculoQuitacaoOpcao, quitado: boolean) {
    setOcupado(true)
    try {
      const res = await definirQuitado(v.id, quitado)
      if (res.error) toast.error(res.error, 'Não foi possível atualizar')
      else {
        toast.success(res.success || 'Situação atualizada.')
        router.refresh()
      }
    } finally {
      setOcupado(false)
    }
  }

  async function excluir() {
    if (!excluindo) return
    setOcupado(true)
    try {
      const res = await excluirQuitacao(excluindo.id)
      if (res.error) toast.error(res.error, 'Não foi possível excluir')
      else {
        toast.success(res.success || 'Quitação excluída.')
        router.refresh()
      }
    } finally {
      setOcupado(false)
      setExcluindo(null)
    }
  }

  async function removerTerceiro() {
    if (!removendoTerceiro) return
    setOcupado(true)
    try {
      const res = await excluirVeiculoTerceiro(removendoTerceiro.id)
      if (res.error) toast.error(res.error, 'Não foi possível remover')
      else {
        toast.success(res.success || 'Veículo removido.')
        router.refresh()
      }
    } finally {
      setOcupado(false)
      setRemovendoTerceiro(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            aria-label="Buscar veículo"
            placeholder="Buscar por modelo, placa, cliente ou contrato"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            containerClassName="w-full sm:w-72"
          />
          <div className="flex gap-1.5" role="group" aria-label="Situação">
            {(
              [
                { id: '', label: `Todos (${contagem.todos})` },
                { id: 'nao-quitado', label: `Não quitados (${contagem.naoQuitados})` },
                { id: 'quitado', label: `Quitados (${contagem.quitados})` },
              ] as const
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={situacao === o.id}
                onClick={() => setSituacao(o.id)}
                className={
                  'rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer ' +
                  (situacao === o.id
                    ? 'bg-neutral-950 text-white'
                    : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50')
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={() => setLote(true)} disabled={naoQuitados.length === 0}>
            <IconListDetails size={16} stroke={2.5} />
            Atualizar valores da semana
          </Button>
          <Button type="button" variant="liberty" onClick={() => setNovoTerceiro(true)}>
            <IconPlus size={16} stroke={2.5} />
            Veículo de terceiro
          </Button>
        </div>
      </div>

      <FiltrosAtivos filtros={filtros} onClear={() => { setBusca(''); setSituacao('') }} />

      {lista.length === 0 ? (
        <EmptyState
          icon={<IconCash size={24} stroke={1.5} />}
          title="Nenhum veículo encontrado"
          description="Ajuste a busca ou o filtro de situação, ou cadastre um veículo de terceiro."
        />
      ) : (
        <ul className="space-y-3">
          {lista.map((v) => {
            const ficha = fichas[v.id]
            const quitado = ficha?.quitado === true
            const historico = historicoPorVeiculo.get(v.id) ?? []
            const atual = historico[0]
            const aberto = abertos.has(v.id)
            const idade = ficha ? calcularIdade(ficha.dataNascimento) : null
            return (
              <li key={v.id} data-veiculo-id={v.id} className="rounded-xl border border-neutral-200 bg-white shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => alternar(v.id)}
                    aria-expanded={aberto}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
                  >
                    <FotoVeiculo v={v} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-neutral-900">{nomeVeiculo(v)}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <span
                          className={
                            'rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ' +
                            (quitado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800')
                          }
                        >
                          {quitado ? 'Quitado' : 'Não quitado'}
                        </span>
                        {v.terceiro && (
                          <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                            Terceiro
                          </span>
                        )}
                        {ficha?.nome && <span>{ficha.nome}</span>}
                        <span>
                          {atual ? `${formatCurrency(atual.valor)} em ${formatDate(atual.data)}` : 'Sem quitação registrada'}
                        </span>
                      </p>
                    </div>
                    <IconChevronDown
                      size={16}
                      className={'ml-auto shrink-0 text-neutral-400 transition-transform ' + (aberto ? 'rotate-180' : '')}
                    />
                  </button>
                  <div className="flex items-center gap-2">
                    {!quitado && (
                      <Button type="button" variant="secondary" onClick={() => setAtualizando({ veiculoId: v.id, quitacao: null })}>
                        <IconCash size={16} stroke={2.5} />
                        Atualizar valor
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => alternarQuitado(v, !quitado)}
                      disabled={ocupado}
                      aria-label={quitado ? 'Voltar para não quitado' : 'Marcar como quitado'}
                      title={quitado ? 'Voltar para não quitado' : 'Marcar como quitado'}
                      className={
                        'inline-flex items-center rounded-lg border px-2.5 py-2 cursor-pointer disabled:opacity-50 ' +
                        (quitado
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50')
                      }
                    >
                      <IconCheck size={16} stroke={2.5} />
                    </button>
                  </div>
                </div>

                {aberto && (
                  <div className="space-y-4 border-t border-neutral-100 p-4">
                    <section>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-neutral-500">
                          Dados para ligar ao banco
                        </h4>
                        <div className="flex gap-2">
                          <Button type="button" variant="secondary" onClick={() => setEditandoFicha(v)}>
                            <IconUserEdit size={16} stroke={2.5} />
                            {ficha && ficha.nome ? 'Editar dados' : 'Preencher dados'}
                          </Button>
                          {v.terceiro && (
                            <button
                              type="button"
                              onClick={() => setRemovendoTerceiro(v)}
                              aria-label="Remover veículo de terceiro"
                              className="inline-flex items-center rounded-lg border border-rose-200 bg-white px-2.5 py-2 text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <IconTrash size={14} stroke={2.5} />
                            </button>
                          )}
                        </div>
                      </div>
                      {ficha && (ficha.nome || ficha.cpf || ficha.numeroContrato) ? (
                        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                          {(
                            [
                              ['Cliente', ficha.nome],
                              ['CPF', ficha.cpf ? maskCPFCNPJ(ficha.cpf) : ''],
                              ['Idade', idade != null ? `${idade} anos (nasc. ${formatDate(ficha.dataNascimento)})` : ''],
                              ['Nome do pai', ficha.nomePai],
                              ['Nome da mãe', ficha.nomeMae],
                              ['Endereço', ficha.endereco],
                              ['Banco', ficha.banco],
                              ['Nº do contrato', ficha.numeroContrato],
                              ['Vencimento da parcela', ficha.vencimentoParcela ? formatDate(ficha.vencimentoParcela) : ''],
                              ['Valor da parcela', ficha.valorParcela > 0 ? formatCurrency(ficha.valorParcela) : ''],
                            ] as const
                          )
                            .filter(([, valor]) => valor)
                            .map(([rotulo, valor]) => (
                              <div key={rotulo} className="flex justify-between gap-3 border-b border-neutral-100 py-1">
                                <dt className="text-neutral-500">{rotulo}</dt>
                                <dd className="text-right font-semibold text-neutral-900">{valor}</dd>
                              </div>
                            ))}
                        </dl>
                      ) : (
                        <p className="text-sm text-neutral-500">
                          Nenhum dado preenchido ainda. Clique em &quot;Preencher dados&quot; para registrar o que é preciso
                          para negociar com o banco.
                        </p>
                      )}
                    </section>

                    <section>
                      <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-neutral-500">
                        Histórico de quitação
                      </h4>
                      {historico.length === 0 ? (
                        <p className="text-sm text-neutral-500">Nenhum valor registrado.</p>
                      ) : (
                        <ul className="divide-y divide-neutral-100">
                          {historico.map((q, i) => (
                            <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                              <div className="min-w-0 text-sm">
                                <span className="font-bold text-liberty-deep">{formatCurrency(q.valor)}</span>{' '}
                                <span className="text-neutral-500">
                                  em {formatDate(q.data)} · por {q.criadoPorNome}
                                </span>
                                {i === 0 && (
                                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                                    Atual
                                  </span>
                                )}
                                {q.observacao && <p className="text-xs text-neutral-600">{q.observacao}</p>}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setAtualizando({ veiculoId: v.id, quitacao: q })}
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
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {atualizando && (
        <QuitacaoModal
          key={atualizando.quitacao?.id ?? `novo-${atualizando.veiculoId}`}
          quitacao={atualizando.quitacao}
          veiculo={veiculos.find((v) => v.id === atualizando.veiculoId)}
          onClose={() => setAtualizando(null)}
          onDone={() => {
            setAtualizando(null)
            router.refresh()
          }}
        />
      )}

      {editandoFicha && (
        <FichaModal
          key={editandoFicha.id}
          veiculo={editandoFicha}
          ficha={fichas[editandoFicha.id]}
          onClose={() => setEditandoFicha(null)}
          onDone={() => {
            setEditandoFicha(null)
            router.refresh()
          }}
        />
      )}

      {novoTerceiro && (
        <TerceiroModal
          onClose={() => setNovoTerceiro(false)}
          onDone={(id) => {
            setNovoTerceiro(false)
            setAbertos((prev) => new Set(prev).add(id))
            router.refresh()
          }}
        />
      )}

      {lote && (
        <LoteModal
          veiculos={naoQuitados}
          ultimaPorVeiculo={new Map([...historicoPorVeiculo].map(([id, h]) => [id, h[0]]))}
          onClose={() => setLote(false)}
          onDone={() => {
            setLote(false)
            router.refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={excluindo != null}
        onClose={() => !ocupado && setExcluindo(null)}
        onConfirm={excluir}
        title="Excluir quitação"
        description="O registro some do histórico. Se for a atual, a anterior passa a ser a atual na aba Veículos."
        confirmLabel="Excluir"
        tone="danger"
        loading={ocupado}
      />

      <ConfirmDialog
        open={removendoTerceiro != null}
        onClose={() => !ocupado && setRemovendoTerceiro(null)}
        onConfirm={removerTerceiro}
        title={`Remover ${removendoTerceiro ? nomeVeiculo(removendoTerceiro) : 'veículo'}?`}
        description="O veículo de terceiro, os dados do cliente e todo o histórico de quitação dele são apagados. Isso não pode ser desfeito."
        confirmLabel="Sim, remover"
        tone="danger"
        loading={ocupado}
      />
    </div>
  )
}

function QuitacaoModal({
  quitacao,
  veiculo,
  onClose,
  onDone,
}: {
  quitacao: Quitacao | null
  veiculo: VeiculoQuitacaoOpcao | undefined
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const veiculoId = veiculo?.id ?? quitacao?.veiculoId ?? ''
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
    <Modal open onClose={() => !salvando && onClose()} title={quitacao ? 'Editar quitação' : 'Atualizar valor da quitação'}>
      <div className="mt-4 space-y-4">
        <p className="text-sm font-semibold text-neutral-700">{nomeVeiculo(veiculo)}</p>
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

/** Atualização semanal: uma linha por veículo, só entram no histórico os que tiverem valor novo. */
function LoteModal({
  veiculos,
  ultimaPorVeiculo,
  onClose,
  onDone,
}: {
  veiculos: VeiculoQuitacaoOpcao[]
  ultimaPorVeiculo: Map<string, Quitacao>
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [data, setData] = useState(hojeIso())
  const [valores, setValores] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  const preenchidos = veiculos.filter((v) => parseMoney(valores[v.id] ?? '') > 0).length

  async function salvar() {
    if (!data) return void toast.error('Informe a data da negociação.')
    const itens = veiculos
      .map((v) => ({ veiculoId: v.id, valor: parseMoney(valores[v.id] ?? '') }))
      .filter((i) => i.valor > 0)
    if (itens.length === 0) return void toast.error('Informe o valor de pelo menos um veículo.')
    setSalvando(true)
    try {
      const res = await criarQuitacoesLote({ data, itens })
      if (res.error) return void toast.error(res.error, 'Não foi possível salvar')
      toast.success(res.success || 'Valores registrados.')
      onDone()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={() => !salvando && onClose()} title="Atualizar valores da semana">
      <div className="mt-4 space-y-4">
        <p className="text-sm text-neutral-500">
          Preencha o novo valor de quitação de cada veículo. Os que ficarem em branco não mudam.
        </p>
        <Input label="Data da negociação" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {veiculos.map((v) => {
            const ultima = ultimaPorVeiculo.get(v.id)
            return (
              <li key={v.id} className="grid items-center gap-2 rounded-lg border border-neutral-200 p-3 sm:grid-cols-2">
                <div className="flex min-w-0 items-center gap-3">
                  <FotoVeiculo v={v} />
                  <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-neutral-900">{nomeVeiculo(v)}</p>
                  <p className="text-xs text-neutral-500">
                    {ultima ? `Último: ${formatCurrency(ultima.valor)} em ${formatDate(ultima.data)}` : 'Sem quitação ainda'}
                  </p>
                  </div>
                </div>
                <Input
                  aria-label={`Novo valor de ${nomeVeiculo(v)}`}
                  type="text"
                  inputMode="decimal"
                  value={valores[v.id] ?? ''}
                  onChange={(e) => setValores((prev) => ({ ...prev, [v.id]: maskMoney(e.target.value) }))}
                  placeholder="Novo valor (R$ 0,00)"
                />
              </li>
            )
          })}
        </ul>
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="text-xs text-neutral-500">
            {preenchidos} {preenchidos === 1 ? 'veículo preenchido' : 'veículos preenchidos'}
          </span>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="button" variant="liberty" loading={salvando} onClick={salvar}>
              Salvar valores
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/** Dados do cliente e do financiamento: o que é preciso à mão para ligar no banco. */
function FichaModal({
  veiculo,
  ficha,
  onClose,
  onDone,
}: {
  veiculo: VeiculoQuitacaoOpcao
  ficha: FichaQuitacao | undefined
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const sug = veiculo.sugestao
  // Sem ficha ainda, parte dos dados já cadastrados no veículo.
  const [nome, setNome] = useState(ficha?.nome ?? sug.nome ?? '')
  const [cpf, setCpf] = useState(maskCPFCNPJ(ficha?.cpf ?? sug.cpf ?? ''))
  const [nomePai, setNomePai] = useState(ficha?.nomePai ?? '')
  const [nomeMae, setNomeMae] = useState(ficha?.nomeMae ?? '')
  const [endereco, setEndereco] = useState(ficha?.endereco ?? sug.endereco ?? '')
  const [dataNascimento, setDataNascimento] = useState(ficha?.dataNascimento ?? '')
  const [banco, setBanco] = useState(ficha?.banco ?? sug.banco ?? '')
  const [numeroContrato, setNumeroContrato] = useState(ficha?.numeroContrato ?? '')
  const [vencimento, setVencimento] = useState(ficha?.vencimentoParcela ?? '')
  const [parcela, setParcela] = useState(() => {
    const v = ficha?.valorParcela || sug.valorParcela || 0
    return v ? moneyFromNumber(v) : ''
  })
  const [salvando, setSalvando] = useState(false)
  const idade = calcularIdade(dataNascimento)

  async function salvar() {
    setSalvando(true)
    try {
      const res = await salvarFicha({
        veiculoId: veiculo.id,
        nome,
        cpf,
        nomePai,
        nomeMae,
        endereco,
        dataNascimento,
        banco,
        numeroContrato,
        vencimentoParcela: vencimento,
        valorParcela: parseMoney(parcela),
      })
      if (res.error) return void toast.error(res.error, 'Não foi possível salvar')
      toast.success(res.success || 'Dados salvos.')
      onDone()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={() => !salvando && onClose()} title={`Dados do cliente · ${nomeVeiculo(veiculo)}`}>
      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nome do cliente" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input
            label="CPF"
            inputMode="numeric"
            value={cpf}
            onChange={(e) => setCpf(maskCPFCNPJ(e.target.value))}
            placeholder="000.000.000-00"
          />
          <Input label="Nome do pai" value={nomePai} onChange={(e) => setNomePai(e.target.value)} />
          <Input label="Nome da mãe" value={nomeMae} onChange={(e) => setNomeMae(e.target.value)} />
          <Input
            label={idade != null ? `Data de nascimento (${idade} anos)` : 'Data de nascimento'}
            type="date"
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
          />
          <Input label="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          <Input label="Banco" value={banco} onChange={(e) => setBanco(e.target.value)} />
          <Input label="Número do contrato" value={numeroContrato} onChange={(e) => setNumeroContrato(e.target.value)} />
          <Input label="Vencimento da parcela" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          <Input
            label="Valor da parcela (R$)"
            inputMode="decimal"
            value={parcela}
            onChange={(e) => setParcela(maskMoney(e.target.value))}
            placeholder="R$ 0,00"
          />
        </div>
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

/** Veículo de fora (cliente que contratou o serviço), cadastrado só para negociar a quitação. */
function TerceiroModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const toast = useToast()
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [ano, setAno] = useState('')
  const [placa, setPlaca] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    try {
      const res = await criarVeiculoTerceiro({ marca, modelo, ano: Number(ano), placa })
      if (res.error || !res.id) return void toast.error(res.error || 'Erro ao cadastrar.', 'Não foi possível salvar')
      toast.success(res.success || 'Veículo cadastrado.')
      onDone(res.id)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={() => !salvando && onClose()} title="Veículo de terceiro">
      <div className="mt-4 space-y-4">
        <p className="text-sm text-neutral-500">
          Carro que não é nosso, de um cliente que contratou o serviço. Fica nesta aba para negociar a quitação.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Marca" value={marca} onChange={(e) => setMarca(e.target.value)} />
          <Input label="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} />
          <Input label="Ano" inputMode="numeric" maxLength={4} value={ano} onChange={(e) => setAno(e.target.value.replace(/\D/g, ''))} />
          <Input label="Placa (opcional)" maxLength={8} value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" variant="liberty" loading={salvando} onClick={salvar}>
            Cadastrar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconCash,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconPencil,
  IconPlus,
  IconTrash,
  IconTrophy,
  IconUsers,
} from '@tabler/icons-react'
import {
  Breadcrumb,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '@/app/components/ui'
import { formatCurrency, formatDate } from '@/utils/format'
import { maskMoney, moneyFromNumber, parseMoney } from '@/utils/masks'
import { deslocarMes, rotuloMes } from '@/app/dashboard/financeiro/periodo'
import { definirBonusPago, excluirMeta, salvarMeta, salvarVendedoresMetas } from './actions'
import {
  META_OBSERVACAO_MAX,
  META_QUANTIDADE_MAX,
  type Meta,
  type MetaFieldErrors,
  type MetaSituacao,
  type VendedorOpcao,
} from './types'

interface MetasClientProps {
  metas: Meta[]
  /** Vendedores da lista das metas. */
  vendedores: VendedorOpcao[]
  /** Usuários com acesso a Propostas que podem entrar na lista (só ADM supremo). */
  candidatos: VendedorOpcao[]
  admSupremo: boolean
  /** Mês exibido (`YYYY-MM`). */
  mes: string
  /** Mês corrente no fuso do negócio — vem do servidor para não divergir. */
  mesAtual: string
}

const CARD =
  'rounded-2xl border border-neutral-200 bg-white shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2'

const SITUACAO: Record<MetaSituacao, { label: string; badge: string; barra: string }> = {
  andamento: {
    label: 'Em andamento',
    badge: 'border-sky-200 bg-sky-50 text-sky-700 adobe-dark:border-sky-400/30 adobe-dark:bg-sky-400/10 adobe-dark:text-sky-300',
    barra: 'bg-liberty adobe-dark:bg-adobe-accent',
  },
  batida: {
    label: 'Meta batida',
    badge:
      'border-emerald-200 bg-emerald-50 text-emerald-700 adobe-dark:border-emerald-400/30 adobe-dark:bg-emerald-400/10 adobe-dark:text-emerald-300',
    barra: 'bg-emerald-500',
  },
  nao_batida: {
    label: 'Não batida',
    badge: 'border-rose-200 bg-rose-50 text-rose-700 adobe-dark:border-rose-400/30 adobe-dark:bg-rose-400/10 adobe-dark:text-rose-300',
    barra: 'bg-rose-400',
  },
}

export default function MetasClient({
  metas,
  vendedores,
  candidatos,
  admSupremo,
  mes,
  mesAtual,
}: MetasClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [, startTransition] = useTransition()
  const [editando, setEditando] = useState<Meta | 'nova' | null>(null)
  const [excluir, setExcluir] = useState<Meta | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [editandoVendedores, setEditandoVendedores] = useState(false)

  const irParaMes = (destino: string) => {
    startTransition(() => router.push(`/dashboard/metas?mes=${destino}`))
  }

  const executar = useCallback(
    async (acao: () => Promise<{ success?: string; error?: string }>, onOk?: () => void) => {
      setOcupado(true)
      try {
        const result = await acao()
        if (result.error) toast.error(result.error)
        else {
          toast.success(result.success || 'Feito.')
          onOk?.()
          router.refresh()
        }
      } finally {
        setOcupado(false)
      }
    },
    [router, toast],
  )

  const resumo = useMemo(
    () => ({
      batidas: metas.filter((m) => m.situacao === 'batida').length,
      fechadas: metas.reduce((acc, m) => acc + m.fechadas, 0),
      valorFechado: metas.reduce((acc, m) => acc + m.valorFechado, 0),
      bonusAPagar: metas
        .filter((m) => m.situacao === 'batida' && !m.bonusPagoEm)
        .reduce((acc, m) => acc + (m.bonus ?? 0), 0),
    }),
    [metas],
  )

  const podeCriar = mes >= mesAtual

  return (
    <div className="space-y-5 pb-28 md:space-y-6 md:pb-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="hidden md:block">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Metas' }]} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-950 md:mt-1 md:text-3xl adobe-dark:text-adobe-text-hi">
            Metas
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 md:mt-1 md:text-sm adobe-dark:text-adobe-text-lo">
            {admSupremo
              ? 'Defina a meta do mês de cada vendedor (em veículos, em R$ ou as duas) e o bônus ao bater.'
              : 'Cada proposta registrada marcada como fechada no mês conta para a sua meta.'}
          </p>
        </div>
        {admSupremo && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              leftIcon={<IconUsers size={16} stroke={2.2} />}
              onClick={() => setEditandoVendedores(true)}
            >
              Vendedores ({vendedores.length})
            </Button>
            {podeCriar && (
              <Button variant="liberty" leftIcon={<IconPlus size={16} stroke={2.5} />} onClick={() => setEditando('nova')}>
                Nova meta
              </Button>
            )}
          </div>
        )}
      </header>

      {admSupremo && vendedores.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 adobe-dark:border-amber-400/30 adobe-dark:bg-amber-400/10 adobe-dark:text-amber-300">
          Nenhum vendedor definido. Clique em &quot;Vendedores&quot; e marque quem participa das metas — só eles
          aparecem em &quot;Quem fechou?&quot; nas propostas registradas.
        </div>
      )}

      {/* Navegação de mês */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => irParaMes(deslocarMes(mes, -1))}
          aria-label="Mês anterior"
          className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-md"
        >
          <IconChevronLeft size={16} stroke={2.5} />
        </button>
        <span className="min-w-44 text-center text-sm font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">
          {rotuloMes(mes)}
        </span>
        <button
          type="button"
          onClick={() => irParaMes(deslocarMes(mes, 1))}
          aria-label="Próximo mês"
          className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-md"
        >
          <IconChevronRight size={16} stroke={2.5} />
        </button>
        {mes !== mesAtual && (
          <button
            type="button"
            onClick={() => irParaMes(mesAtual)}
            className="ml-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-liberty-deep hover:bg-liberty/10 transition-ui cursor-pointer adobe-dark:text-adobe-accent-soft"
          >
            Mês atual
          </button>
        )}
      </div>

      {admSupremo && metas.length > 0 && (
        <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Metas batidas', value: `${resumo.batidas}/${metas.length}` },
            { label: 'Veículos fechados', value: String(resumo.fechadas) },
            { label: 'Valor fechado', value: formatCurrency(resumo.valorFechado) },
            { label: 'Bônus a pagar', value: formatCurrency(resumo.bonusAPagar) },
          ].map((k) => (
            <div key={k.label} className={CARD + ' p-4'}>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 adobe-dark:text-adobe-text-lo">
                {k.label}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-950 adobe-dark:text-adobe-text-hi">{k.value}</p>
            </div>
          ))}
        </section>
      )}

      {metas.length === 0 ? (
        <EmptyState
          icon={<IconTrophy size={24} stroke={1.5} />}
          title={admSupremo ? 'Nenhuma meta neste mês' : 'Você não tem meta neste mês'}
          description={
            admSupremo
              ? podeCriar
                ? 'Crie uma meta escolhendo o vendedor, a meta em veículos e/ou em R$ e o bônus.'
                : 'Não houve metas cadastradas neste mês.'
              : 'Quando a administração definir uma meta para você, ela aparece aqui.'
          }
          action={
            admSupremo && podeCriar ? (
              <Button
                variant="liberty"
                size="sm"
                leftIcon={<IconPlus size={14} stroke={2.5} />}
                onClick={() => setEditando('nova')}
              >
                Nova meta
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {metas.map((m) => (
            <MetaCard
              key={m.id}
              meta={m}
              admSupremo={admSupremo}
              ocupado={ocupado}
              onEditar={() => setEditando(m)}
              onExcluir={() => setExcluir(m)}
              onBonusPago={(pago) => executar(() => definirBonusPago(m.id, pago))}
            />
          ))}
        </div>
      )}

      {admSupremo && editando !== null && (
        <MetaModal
          key={editando === 'nova' ? 'nova' : editando.id}
          meta={editando === 'nova' ? null : editando}
          vendedores={vendedores}
          mesInicial={podeCriar ? mes : mesAtual}
          mesAtual={mesAtual}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null)
            router.refresh()
          }}
        />
      )}

      {admSupremo && editandoVendedores && (
        <VendedoresModal
          candidatos={candidatos}
          selecionadosIniciais={vendedores.map((v) => v.uid)}
          onClose={() => setEditandoVendedores(false)}
          onSaved={() => {
            setEditandoVendedores(false)
            router.refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={excluir !== null}
        onClose={() => !ocupado && setExcluir(null)}
        onConfirm={() => excluir && executar(() => excluirMeta(excluir.id), () => setExcluir(null))}
        title="Excluir meta"
        description={excluir ? `A meta de ${excluir.vendedorNome} em ${rotuloMes(excluir.mes)} será removida. As propostas não são afetadas.` : ''}
        confirmLabel="Excluir"
        tone="danger"
        loading={ocupado}
      />
    </div>
  )
}

// ─── Card da meta ────────────────────────────────────────────────────────────

function MetaCard({
  meta: m,
  admSupremo,
  ocupado,
  onEditar,
  onExcluir,
  onBonusPago,
}: {
  meta: Meta
  admSupremo: boolean
  ocupado: boolean
  onEditar: () => void
  onExcluir: () => void
  onBonusPago: (pago: boolean) => void
}) {
  const [verPropostas, setVerPropostas] = useState(false)
  const s = SITUACAO[m.situacao]

  return (
    <article className={CARD + ' p-5'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-neutral-950 adobe-dark:text-adobe-text-hi">{m.vendedorNome}</h3>
          <span
            className={
              'mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ' +
              s.badge
            }
          >
            {m.situacao === 'batida' && <IconTrophy size={11} stroke={2.5} />}
            {s.label}
          </span>
        </div>
        {admSupremo && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onEditar}
              aria-label="Editar meta"
              className="grid h-8 w-8 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition-ui cursor-pointer adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-md"
            >
              <IconPencil size={14} stroke={2.2} />
            </button>
            <button
              type="button"
              onClick={onExcluir}
              aria-label="Excluir meta"
              className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 transition-ui cursor-pointer adobe-dark:border-rose-400/30 adobe-dark:bg-adobe-bg-2"
            >
              <IconTrash size={14} stroke={2.2} />
            </button>
          </div>
        )}
      </div>

      {/* Barras da meta — uma por alvo; basta bater uma */}
      <div className="mt-4 space-y-4">
        {m.quantidade != null && (
          <BarraMeta
            atual={m.fechadas}
            alvo={m.quantidade}
            barra={s.barra}
            formatar={(n) => String(n)}
            unidade={(n) => (n === 1 ? 'veículo' : 'veículos')}
            situacao={m.situacao}
          />
        )}
        {m.valorMeta != null && (
          <BarraMeta
            atual={m.valorFechado}
            alvo={m.valorMeta}
            barra={s.barra}
            formatar={formatCurrency}
            situacao={m.situacao}
          />
        )}
        {m.quantidade != null && m.valorMeta != null && m.situacao !== 'batida' && (
          <p className="text-[11px] font-semibold text-neutral-500 adobe-dark:text-adobe-text-lo">
            {m.exigirAmbas ? 'Precisa bater as duas metas.' : 'Basta bater uma das duas metas.'}
          </p>
        )}
        {m.situacao === 'batida' && (
          <p className="text-[11px] font-bold text-emerald-700 adobe-dark:text-emerald-300">Meta concluída!</p>
        )}
      </div>

      {/* Bônus */}
      {m.bonus != null && m.bonus > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-liberty/25 bg-liberty/5 px-4 py-3 adobe-dark:border-adobe-accent/25 adobe-dark:bg-adobe-accent/10">
          <div className="flex items-center gap-2">
            <IconCash size={18} className="text-liberty-deep adobe-dark:text-adobe-accent-soft" />
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-liberty-deep/70 adobe-dark:text-adobe-accent-soft">
                Bônus
              </p>
              <p className="text-base font-black text-liberty-deep adobe-dark:text-adobe-accent-soft">{formatCurrency(m.bonus)}</p>
            </div>
          </div>
          {m.bonusPagoEm ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 adobe-dark:bg-emerald-400/15 adobe-dark:text-emerald-300">
                <IconCheck size={12} stroke={3} />
                Pago em {formatDate(m.bonusPagoEm)}
              </span>
              {admSupremo && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => onBonusPago(false)}
                  className="text-[11px] font-semibold text-neutral-500 underline-offset-2 hover:underline cursor-pointer disabled:opacity-50"
                >
                  Desfazer
                </button>
              )}
            </div>
          ) : m.situacao === 'batida' ? (
            admSupremo ? (
              <Button size="sm" variant="liberty" disabled={ocupado} onClick={() => onBonusPago(true)}>
                Marcar bônus como pago
              </Button>
            ) : (
              <span className="text-[11px] font-bold text-emerald-700 adobe-dark:text-emerald-300">Bônus conquistado!</span>
            )
          ) : (
            <span className="text-[11px] font-semibold text-neutral-500 adobe-dark:text-adobe-text-lo">
              {m.situacao === 'nao_batida' ? 'Não conquistado' : 'Ao bater a meta'}
            </span>
          )}
        </div>
      )}

      {m.observacao && (
        <p className="mt-3 whitespace-pre-line text-xs text-neutral-600 adobe-dark:text-adobe-text-md">{m.observacao}</p>
      )}

      {m.propostas.length > 0 && (
        <div className="mt-3 border-t border-neutral-100 pt-3 adobe-dark:border-adobe-line">
          <button
            type="button"
            onClick={() => setVerPropostas((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer adobe-dark:text-adobe-text-md"
          >
            <IconChevronDown size={14} stroke={2.5} className={'transition-transform ' + (verPropostas ? 'rotate-180' : '')} />
            Propostas fechadas ({m.propostas.length})
          </button>
          {verPropostas && (
            <ul className="mt-2 space-y-1.5">
              {m.propostas.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-neutral-800 adobe-dark:text-adobe-text-hi">
                    <span className="font-semibold">{p.cliente}</span>
                    {p.veiculo && <span className="text-neutral-500"> · {p.veiculo}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-500">
                    {p.valorFipe > 0 ? `FIPE ${formatCurrency(p.valorFipe)}` : 'Sem FIPE'} · {formatDate(p.fechadaEm)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  )
}

// ─── Barra de progresso de um alvo ───────────────────────────────────────────

function BarraMeta({
  atual,
  alvo,
  barra,
  formatar,
  unidade,
  situacao,
}: {
  atual: number
  alvo: number
  barra: string
  formatar: (n: number) => string
  /** Sufixo ("veículos"); sem ele, o valor já vem formatado (R$). */
  unidade?: (n: number) => string
  situacao: MetaSituacao
}) {
  const pct = Math.min(100, Math.round((atual / alvo) * 100))
  const falta = Math.max(0, alvo - atual)
  const comUnidade = (n: number) => (unidade ? `${formatar(n)} ${unidade(n)}` : formatar(n))
  // "Faltam 3 veículos", mas "Falta R$ 500,00".
  const plural = !!unidade && falta > 1

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-700 adobe-dark:text-adobe-text-md">
          <span className="text-2xl font-black tabular-nums text-neutral-950 adobe-dark:text-adobe-text-hi">{formatar(atual)}</span>
          <span className="text-neutral-400"> / {formatar(alvo)}</span>
          {unidade && ` ${unidade(alvo)}`}
        </p>
        <span className="text-xs font-bold tabular-nums text-neutral-500 adobe-dark:text-adobe-text-lo">{pct}%</span>
      </div>
      <div
        className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-100 adobe-dark:bg-adobe-bg-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={alvo}
        aria-valuenow={atual}
        aria-label={`${comUnidade(atual)} de ${comUnidade(alvo)}`}
      >
        <div className={'h-full rounded-full transition-[width] duration-700 ' + barra} style={{ width: `${pct}%` }} />
      </div>
      {/* Com a meta batida pela outra barra, o que falta aqui já não importa. */}
      {falta > 0 && situacao !== 'batida' && (
        <p className="mt-1.5 text-[11px] text-neutral-500 adobe-dark:text-adobe-text-lo">
          {situacao === 'nao_batida'
            ? `${plural ? 'Faltaram' : 'Faltou'} ${comUnidade(falta)}.`
            : `${plural ? 'Faltam' : 'Falta'} ${comUnidade(falta)} até o fim do mês.`}
        </p>
      )}
    </div>
  )
}

// ─── Modal criar/editar ──────────────────────────────────────────────────────

function MetaModal({
  meta,
  vendedores,
  mesInicial,
  mesAtual,
  onClose,
  onSaved,
}: {
  meta: Meta | null
  vendedores: VendedorOpcao[]
  mesInicial: string
  mesAtual: string
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [vendedorUid, setVendedorUid] = useState(meta?.vendedorUid ?? '')
  const [mes, setMes] = useState(meta?.mes ?? mesInicial)
  const [quantidade, setQuantidade] = useState(meta?.quantidade != null ? String(meta.quantidade) : '')
  const [valorMeta, setValorMeta] = useState(moneyFromNumber(meta?.valorMeta ?? null))
  const [exigirAmbas, setExigirAmbas] = useState(meta?.exigirAmbas ?? false)
  const temAsDuas = quantidade.trim() !== '' && valorMeta !== ''
  const [bonus, setBonus] = useState(moneyFromNumber(meta?.bonus ?? null))
  const [observacao, setObservacao] = useState(meta?.observacao ?? '')
  const [errors, setErrors] = useState<MetaFieldErrors>({})
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const fd = new FormData()
      if (meta) fd.append('id', meta.id)
      fd.append('vendedorUid', vendedorUid)
      fd.append('mes', mes)
      fd.append('quantidade', quantidade)
      fd.append('valorMeta', valorMeta ? String(parseMoney(valorMeta)) : '')
      fd.append('exigirAmbas', temAsDuas && exigirAmbas ? 'true' : 'false')
      fd.append('bonus', bonus ? String(parseMoney(bonus)) : '')
      fd.append('observacao', observacao)
      const result = await salvarMeta(fd)
      setErrors(result.fieldErrors ?? {})
      if (result.error) {
        if (!result.fieldErrors) toast.error(result.error)
        return
      }
      toast.success(result.success || 'Meta salva.')
      onSaved()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !salvando && onClose()}
      title={meta ? `Editar meta — ${meta.vendedorNome}` : 'Nova meta'}
      description={meta ? rotuloMes(meta.mes) : 'Conta as propostas registradas marcadas como fechadas no mês.'}
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {!meta && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Vendedor"
              value={vendedorUid}
              onChange={(e) => setVendedorUid(e.target.value)}
              options={[
                { value: '', label: 'Selecione o vendedor' },
                ...vendedores.map((v) => ({ value: v.uid, label: v.nome })),
              ]}
              error={errors.vendedorUid}
            />
            <Input
              label="Mês"
              type="month"
              value={mes}
              min={mesAtual}
              onChange={(e) => setMes(e.target.value)}
              error={errors.mes}
              required
              // No iOS o input de mês tem largura mínima própria e vaza do modal.
              className="min-w-0 appearance-none"
            />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Meta em veículos"
            type="number"
            inputMode="numeric"
            min={1}
            max={META_QUANTIDADE_MAX}
            step={1}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder="Ex: 5"
            error={errors.quantidade}
            autoFocus
          />
          <Input
            label="Meta em R$"
            inputMode="numeric"
            value={valorMeta}
            onChange={(e) => setValorMeta(maskMoney(e.target.value))}
            placeholder="0,00"
            hint="Soma do valor FIPE dos veículos."
            error={errors.valorMeta}
          />
        </div>
        {temAsDuas ? (
          <div>
            <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-neutral-700 adobe-dark:text-adobe-text-md">
              Para ganhar o bônus
            </p>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-3">
              {(
                [
                  { valor: false, label: 'Basta bater uma' },
                  { valor: true, label: 'Bater as duas' },
                ] as const
              ).map((opt) => (
                <button
                  key={String(opt.valor)}
                  type="button"
                  aria-pressed={exigirAmbas === opt.valor}
                  onClick={() => setExigirAmbas(opt.valor)}
                  className={
                    'rounded-md px-3 py-2 text-xs font-bold transition-colors cursor-pointer ' +
                    (exigirAmbas === opt.valor
                      ? 'bg-liberty text-white shadow-xs adobe-dark:bg-adobe-accent adobe-dark:text-[#0a1720]'
                      : 'text-neutral-600 hover:bg-white adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-2')
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="-mt-1 text-[11px] text-neutral-500 adobe-dark:text-adobe-text-lo">
            Preencha uma ou as duas metas.
          </p>
        )}
        <div className="sm:w-1/2">
          <Input
            label="Bônus (R$)"
            inputMode="numeric"
            value={bonus}
            onChange={(e) => setBonus(maskMoney(e.target.value))}
            placeholder="0,00"
            hint="Opcional."
            error={errors.bonus}
          />
        </div>
        <Textarea
          label="Observação (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={2}
          maxLength={META_OBSERVACAO_MAX}
          placeholder="Ex: bônus pago junto com o salário."
          error={errors.observacao}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" variant="liberty" loading={salvando}>
            {meta ? 'Salvar' : 'Criar meta'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal da lista de vendedores ────────────────────────────────────────────

function VendedoresModal({
  candidatos,
  selecionadosIniciais,
  onClose,
  onSaved,
}: {
  candidatos: VendedorOpcao[]
  selecionadosIniciais: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [selecionados, setSelecionados] = useState(() => new Set(selecionadosIniciais))
  const [salvando, setSalvando] = useState(false)

  function alternar(uid: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(uid)) novo.delete(uid)
      else novo.add(uid)
      return novo
    })
  }

  async function salvar() {
    setSalvando(true)
    try {
      const result = await salvarVendedoresMetas([...selecionados])
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(result.success || 'Lista salva.')
      onSaved()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !salvando && onClose()}
      title="Vendedores das metas"
      description='Só quem estiver marcado pode receber meta e aparece em "Quem fechou?" nas propostas registradas.'
    >
      <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto">
        {candidatos.map((c) => (
          <li key={c.uid}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-neutral-50 adobe-dark:hover:bg-adobe-bg-3">
              <input
                type="checkbox"
                checked={selecionados.has(c.uid)}
                onChange={() => alternar(c.uid)}
                className="h-4 w-4 cursor-pointer accent-[var(--color-liberty,#0284c7)]"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-neutral-900 adobe-dark:text-adobe-text-hi">
                  {c.nome}
                </span>
                {c.email && (
                  <span className="block truncate text-[11px] text-neutral-500 adobe-dark:text-adobe-text-lo">{c.email}</span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="button" variant="liberty" loading={salvando} onClick={salvar}>
          Salvar ({selecionados.size})
        </Button>
      </div>
    </Modal>
  )
}

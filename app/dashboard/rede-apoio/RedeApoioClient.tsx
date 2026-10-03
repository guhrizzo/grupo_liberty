'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  IconBrandWhatsapp,
  IconEye,
  IconMapPin,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconTruckDelivery,
  IconUsersGroup,
} from '@tabler/icons-react'
import { Button, ConfirmDialog, EmptyState, Input, Modal, Select, Textarea, useToast } from '@/app/components/ui'
import { ESTADO_OPCOES } from '@/utils/estadosBrasil'
import {
  REDE_CIDADE_MAX,
  REDE_NOME_MAX,
  REDE_OBS_MAX,
  REDE_RELACAO_LABEL,
  REDE_RELACOES,
} from '@/constants/rede-apoio'
import { excluirContatoApoio, salvarContatoApoio } from './actions'
import type { ContatoApoio, ContatoApoioFieldErrors, ContatoApoioInput } from './types'

const FORM_VAZIO: ContatoApoioInput = {
  nome: '',
  relacao: '',
  cidade: '',
  uf: '',
  telefone: '',
  podeReceber: false,
  podeVistoriar: false,
  observacoes: '',
}

const ESTADO_LABEL: Record<string, string> = Object.fromEntries(ESTADO_OPCOES.map((e) => [e.value, e.label]))

/** Compara sem acento e sem caixa ("sao paulo" acha "São Paulo"). */
function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function whatsappLink(telefone: string): string | null {
  const digits = telefone.replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`
}

export default function RedeApoioClient({ initialContatos }: { initialContatos: ContatoApoio[] }) {
  const toast = useToast()
  const [contatos, setContatos] = useState(initialContatos)
  const [busca, setBusca] = useState('')
  const [ufFiltro, setUfFiltro] = useState('')
  const [editando, setEditando] = useState<ContatoApoio | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<ContatoApoio | null>(null)
  const [isPending, startTransition] = useTransition()

  const ufsComContato = useMemo(
    () => [...new Set(contatos.map((c) => c.uf))].sort(),
    [contatos],
  )

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim())
    return contatos.filter(
      (c) =>
        (!ufFiltro || c.uf === ufFiltro) &&
        (!q || normalizar(`${c.nome} ${c.cidade} ${c.observacoes}`).includes(q)),
    )
  }, [contatos, busca, ufFiltro])

  /** Agrupa por estado para achar rápido "quem temos na Bahia". */
  const grupos = useMemo(() => {
    const mapa = new Map<string, ContatoApoio[]>()
    for (const c of filtrados) mapa.set(c.uf, [...(mapa.get(c.uf) ?? []), c])
    return [...mapa.entries()].sort(([a], [b]) => (ESTADO_LABEL[a] ?? a).localeCompare(ESTADO_LABEL[b] ?? b, 'pt-BR'))
  }, [filtrados])

  function aoSalvar(contato: ContatoApoio) {
    setContatos((atual) => {
      const sem = atual.filter((c) => c.id !== contato.id)
      return [...sem, contato].sort(
        (a, b) =>
          a.uf.localeCompare(b.uf) ||
          a.cidade.localeCompare(b.cidade, 'pt-BR') ||
          a.nome.localeCompare(b.nome, 'pt-BR'),
      )
    })
    setEditando(null)
  }

  function confirmarExclusao() {
    if (!excluindo) return
    const alvo = excluindo
    startTransition(async () => {
      const res = await excluirContatoApoio(alvo.id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setContatos((atual) => atual.filter((c) => c.id !== alvo.id))
      setExcluindo(null)
      toast.success(res.success)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            placeholder="Buscar por nome ou cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            leftIcon={<IconSearch size={16} />}
          />
        </div>
        <div className="sm:w-56">
          <Select
            value={ufFiltro}
            onChange={(e) => setUfFiltro(e.target.value)}
            options={[
              { value: '', label: 'Todos os estados' },
              ...ufsComContato.map((uf) => ({ value: uf, label: ESTADO_LABEL[uf] ?? uf })),
            ]}
          />
        </div>
        <Button variant="liberty" leftIcon={<IconPlus size={16} />} onClick={() => setEditando('novo')}>
          Novo contato
        </Button>
      </div>

      {contatos.length === 0 ? (
        <EmptyState
          icon={<IconUsersGroup size={28} />}
          title="Nenhum contato cadastrado"
          description="Cadastre amigos, parceiros, conhecidos ou mentorados com a cidade onde moram. Quando fecharmos um negócio longe, dá para achar alguém de confiança na região."
          action={
            <Button variant="liberty" leftIcon={<IconPlus size={16} />} onClick={() => setEditando('novo')}>
              Cadastrar o primeiro
            </Button>
          }
        />
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={<IconMapPin size={28} />}
          title="Ninguém encontrado"
          description="Nenhum contato com essa busca. Tente outra cidade ou limpe o filtro de estado."
        />
      ) : (
        <div className="space-y-8">
          {grupos.map(([uf, lista]) => (
            <section key={uf} className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-neutral-200 pb-2">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-neutral-700">
                  {ESTADO_LABEL[uf] ?? uf}
                </h2>
                <span className="text-xs text-neutral-500">
                  {lista.length} contato{lista.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {lista.map((c) => (
                  <CartaoContato
                    key={c.id}
                    contato={c}
                    onEditar={() => setEditando(c)}
                    onExcluir={() => setExcluindo(c)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {editando && (
        <ContatoModal
          key={editando === 'novo' ? 'novo' : editando.id}
          contato={editando === 'novo' ? null : editando}
          onClose={() => setEditando(null)}
          onSalvo={aoSalvar}
        />
      )}

      <ConfirmDialog
        open={!!excluindo}
        onClose={() => setExcluindo(null)}
        onConfirm={confirmarExclusao}
        title="Excluir contato"
        description={excluindo ? `Excluir ${excluindo.nome} (${excluindo.cidade}/${excluindo.uf}) da rede de apoio?` : ''}
        confirmLabel="Excluir"
        tone="danger"
        loading={isPending}
      />
    </div>
  )
}

function CartaoContato({
  contato: c,
  onEditar,
  onExcluir,
}: {
  contato: ContatoApoio
  onEditar: () => void
  onExcluir: () => void
}) {
  const wa = whatsappLink(c.telefone)
  return (
    <article className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-neutral-900">{c.nome}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-neutral-600">
            <IconMapPin size={13} className="shrink-0 text-neutral-400" />
            {c.cidade}/{c.uf}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
          {REDE_RELACAO_LABEL[c.relacao]}
        </span>
      </div>

      {(c.podeReceber || c.podeVistoriar) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.podeReceber && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <IconTruckDelivery size={12} stroke={2.2} />
              Recebe veículo
            </span>
          )}
          {c.podeVistoriar && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
              <IconEye size={12} stroke={2.2} />
              Vai ver veículo
            </span>
          )}
        </div>
      )}

      {c.observacoes && <p className="mt-3 whitespace-pre-line text-xs text-neutral-600">{c.observacoes}</p>}

      <div className="mt-auto flex items-center gap-2 border-t border-neutral-100 pt-3 [&:not(:first-child)]:mt-4">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <IconBrandWhatsapp size={14} stroke={2.2} />
            {c.telefone}
          </a>
        ) : (
          <span className="flex-1 text-xs text-neutral-400">Sem telefone</span>
        )}
        <button
          type="button"
          onClick={onEditar}
          aria-label={`Editar ${c.nome}`}
          className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
        >
          <IconPencil size={14} stroke={2.5} />
        </button>
        <button
          type="button"
          onClick={onExcluir}
          aria-label={`Excluir ${c.nome}`}
          className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-rose-600 hover:bg-rose-50 cursor-pointer"
        >
          <IconTrash size={14} stroke={2.5} />
        </button>
      </div>
    </article>
  )
}

function ContatoModal({
  contato,
  onClose,
  onSalvo,
}: {
  contato: ContatoApoio | null
  onClose: () => void
  onSalvo: (c: ContatoApoio) => void
}) {
  const toast = useToast()
  const [form, setForm] = useState<ContatoApoioInput>(() =>
    contato
      ? {
          nome: contato.nome,
          relacao: contato.relacao,
          cidade: contato.cidade,
          uf: contato.uf,
          telefone: contato.telefone,
          podeReceber: contato.podeReceber,
          podeVistoriar: contato.podeVistoriar,
          observacoes: contato.observacoes,
        }
      : FORM_VAZIO,
  )
  const [erros, setErros] = useState<ContatoApoioFieldErrors>({})
  const [isPending, startTransition] = useTransition()

  function set<K extends keyof ContatoApoioInput>(campo: K, valor: ContatoApoioInput[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setErros((e) => ({ ...e, [campo]: undefined }))
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await salvarContatoApoio(contato?.id ?? null, form)
      if ('error' in res) {
        setErros(res.fieldErrors ?? {})
        toast.error(res.error)
        return
      }
      toast.success(res.success)
      onSalvo(res.contato)
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={contato ? 'Editar contato' : 'Novo contato'}
      description="Pessoa de confiança que pode receber ou ver um veículo na cidade dela."
      size="md"
    >
      <form onSubmit={salvar} className="space-y-4">
        <Input
          label="Nome"
          value={form.nome}
          maxLength={REDE_NOME_MAX}
          onChange={(e) => set('nome', e.target.value)}
          error={erros.nome}
          autoFocus
        />
        <Select
          label="Relação"
          value={form.relacao}
          onChange={(e) => set('relacao', e.target.value)}
          options={[
            { value: '', label: 'Escolha...' },
            ...REDE_RELACOES.map((r) => ({ value: r, label: REDE_RELACAO_LABEL[r] })),
          ]}
          error={erros.relacao}
        />
        <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
          <Input
            label="Cidade"
            value={form.cidade}
            maxLength={REDE_CIDADE_MAX}
            onChange={(e) => set('cidade', e.target.value)}
            error={erros.cidade}
          />
          <Select
            label="Estado"
            value={form.uf}
            onChange={(e) => set('uf', e.target.value)}
            options={[
              { value: '', label: 'Escolha...' },
              ...ESTADO_OPCOES.map((o) => ({ value: o.value, label: `${o.value} · ${o.label}` })),
            ]}
            error={erros.uf}
          />
        </div>
        <Input
          label="Telefone / WhatsApp"
          mask="phone"
          inputMode="tel"
          value={form.telefone}
          onChange={(e) => set('telefone', e.target.value)}
          error={erros.telefone}
          hint="Opcional"
        />
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-bold text-neutral-700">Pode ajudar com</legend>
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.podeReceber}
              onChange={(e) => set('podeReceber', e.target.checked)}
              className="h-4 w-4 accent-liberty"
            />
            Receber / guardar um veículo
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.podeVistoriar}
              onChange={(e) => set('podeVistoriar', e.target.checked)}
              className="h-4 w-4 accent-liberty"
            />
            Ir ver / vistoriar um veículo
          </label>
        </fieldset>
        <Textarea
          label="Observações"
          rows={3}
          maxLength={REDE_OBS_MAX}
          value={form.observacoes}
          onChange={(e) => set('observacoes', e.target.value)}
          error={erros.observacoes}
          hint="Ex.: mecânico, tem garagem, atende também cidades vizinhas."
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="liberty" loading={isPending}>
            {contato ? 'Salvar' : 'Cadastrar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

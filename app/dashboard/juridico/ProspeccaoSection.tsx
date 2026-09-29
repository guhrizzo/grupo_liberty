'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconUserSearch,
  IconTableImport,
} from '@tabler/icons-react'
import {
  Button,
  Input,
  Textarea,
  Modal,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  ConfirmDialog,
  useToast,
} from '@/app/components/ui'
import { useDebounce } from '@/utils/useDebounce'
import { formatCurrency } from '@/utils/format'
import { maskCPFCNPJ, maskMoney, maskPhone, moneyFromNumber } from '@/utils/masks'
import {
  salvarProspeccao,
  importarProspeccoes,
  getProspeccoes,
  deleteProspeccao,
} from './prospeccao-actions'
import { PROSPECCAO_COLUNAS, parseLinhasPlanilha } from './prospeccao-parse'
import type { Prospeccao, ProspeccaoInput } from './types'

type Chave = keyof ProspeccaoInput
type FormState = Record<Chave, string>

const MONEY: Chave[] = ['valorEntrada', 'valorFinanciado', 'valorParcela']
const INTS: Chave[] = ['parcelasContrato', 'parcelasPagas']
const PHONES: Chave[] = ['telefone1', 'telefone2', 'telefone3']

const PAGE_SIZE = 15

function formVazio(): FormState {
  return Object.fromEntries(PROSPECCAO_COLUNAS.map(({ key }) => [key, ''])) as FormState
}

function formDe(p: Prospeccao): FormState {
  const f = formVazio()
  for (const { key } of PROSPECCAO_COLUNAS) {
    const v = p[key]
    if (MONEY.includes(key)) f[key] = moneyFromNumber(v as number | null)
    else f[key] = v == null ? '' : String(v)
  }
  return f
}

function mascarar(key: Chave, v: string): string {
  if (MONEY.includes(key)) return maskMoney(v)
  if (INTS.includes(key)) return v.replace(/\D/g, '').slice(0, 4)
  if (key === 'cpfCnpj') return maskCPFCNPJ(v)
  if (PHONES.includes(key)) return maskPhone(v)
  return v
}

/** Valor da célula como aparece na planilha. */
function celula(p: Prospeccao, key: Chave): string {
  const v = p[key]
  if (v === null || v === '') return 'Não consta'
  if (MONEY.includes(key)) return formatCurrency(v as number)
  if (INTS.includes(key)) return `${v} parcelas`
  return String(v)
}

export default function ProspeccaoSection({
  initialProspeccoes,
}: {
  initialProspeccoes: Prospeccao[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [itens, setItens] = useState<Prospeccao[]>(initialProspeccoes)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Prospeccao | null>(null)
  const [form, setForm] = useState<FormState>(formVazio)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Prospeccao | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [importTexto, setImportTexto] = useState('')
  const previa = useMemo(() => parseLinhasPlanilha(importTexto), [importTexto])

  function abrirNovo() {
    setEditing(null)
    setForm(formVazio())
    setFormOpen(true)
  }

  function abrirEdicao(p: Prospeccao) {
    setEditing(p)
    setForm(formDe(p))
    setFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    if (!form.nomeExecutado.trim()) {
      toast.error('Informe o nome do executado.')
      return
    }
    setSubmitting(true)
    try {
      const res = await salvarProspeccao(editing?.id ?? null, form)
      if (res.error || !res.prospeccao) {
        toast.error(res.error || 'Erro ao salvar.')
        return
      }
      const salvo = res.prospeccao
      setItens((prev) =>
        editing ? prev.map((x) => (x.id === salvo.id ? salvo : x)) : [salvo, ...prev],
      )
      if (!editing) setPage(1)
      toast.success(res.success || 'Salvo.')
      setFormOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleImport() {
    if (submitting || previa.length === 0) return
    setSubmitting(true)
    try {
      const res = await importarProspeccoes(previa)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(res.success || 'Importado.')
      setImportOpen(false)
      setImportTexto('')
      setPage(1)
      setItens(await getProspeccoes())
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(p: Prospeccao) {
    setConfirmDelete(null)
    setItens((prev) => prev.filter((x) => x.id !== p.id))
    const res = await deleteProspeccao(p.id)
    if (res.error) {
      toast.error(res.error)
      setItens((prev) => [p, ...prev])
    } else {
      toast.success(res.success || 'Removido.')
    }
    router.refresh()
  }

  const filtrados = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    if (!term) return itens
    const termDigits = term.replace(/\D/g, '')
    return itens.filter((p) => {
      const texto = [p.nomeExecutado, p.numeroProcesso, p.comarca, p.banco, p.veiculo, p.email]
        .join(' ')
        .toLowerCase()
      if (texto.includes(term)) return true
      return termDigits.length >= 3 && p.cpfCnpj.replace(/\D/g, '').includes(termDigits)
    })
  }, [itens, debouncedSearch])

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visiveis = filtrados.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-neutral-950">
            <IconUserSearch size={20} className="text-liberty-deep" />
            Prospecção de clientes
            <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-liberty/15 px-2 text-xs font-bold text-liberty-deep">
              {itens.length}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Executados em processos, com dados do financiamento e contato.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setImportOpen(true)}
            leftIcon={<IconTableImport size={16} stroke={2.2} />}
          >
            Colar da planilha
          </Button>
          <Button variant="liberty" onClick={abrirNovo} leftIcon={<IconPlus size={16} stroke={2.5} />}>
            Nova prospecção
          </Button>
        </div>
      </div>

      <Input
        placeholder="Buscar por nome, CPF, processo, banco, veículo..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
        containerClassName="w-full sm:w-96"
      />

      {visiveis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-500">
          {itens.length === 0
            ? 'Nenhuma prospecção cadastrada. Cadastre uma ou cole as linhas da planilha.'
            : 'Nenhum registro encontrado para essa busca.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
          <Table className="text-xs">
            <THead>
              <tr>
                {PROSPECCAO_COLUNAS.map(({ key, label }) => (
                  <TH key={key} className="whitespace-nowrap !px-3 text-[10px]">
                    {label}
                  </TH>
                ))}
                <TH align="right" className="sticky right-0 bg-neutral-50 !px-3 text-[10px]">
                  Ações
                </TH>
              </tr>
            </THead>
            <TBody>
              {visiveis.map((p) => (
                <TR key={p.id}>
                  {PROSPECCAO_COLUNAS.map(({ key }) => {
                    const vazio = p[key] === null || p[key] === ''
                    return (
                      <TD
                        key={key}
                        className={`!px-3 ${key === 'endereco' ? 'min-w-[280px]' : 'whitespace-nowrap'} ${
                          key === 'nomeExecutado' ? 'font-semibold text-neutral-900' : ''
                        } ${vazio ? 'text-neutral-400' : ''}`}
                      >
                        {celula(p, key)}
                      </TD>
                    )
                  })}
                  <TD align="right" className="sticky right-0 bg-white !px-3">
                    <div className="inline-flex gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => abrirEdicao(p)}
                        aria-label="Editar"
                        leftIcon={<IconPencil size={12} />}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setConfirmDelete(p)}
                        aria-label="Remover"
                        className="!border-rose-200 !text-rose-600 hover:!bg-rose-50"
                      >
                        <IconTrash size={12} />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50/60 px-4 py-3">
              <span className="text-xs text-neutral-500">
                Página {safePage} de {totalPages} · {filtrados.length} registros
              </span>
              <div className="inline-flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((x) => Math.max(1, x - 1))}
                  disabled={safePage === 1}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((x) => Math.min(totalPages, x + 1))}
                  disabled={safePage === totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar prospecção' : 'Nova prospecção'}
        size="lg"
        className="max-h-[90vh] overflow-y-auto"
      >
        <form onSubmit={handleSubmit} className="grid gap-3 pt-2 sm:grid-cols-2">
          {PROSPECCAO_COLUNAS.map(({ key, label }) => (
            <Input
              key={key}
              label={key === 'nomeExecutado' ? `${label} *` : label}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: mascarar(key, e.target.value) }))}
              placeholder={
                MONEY.includes(key)
                  ? '0,00'
                  : key === 'ultimoMesPago'
                    ? 'jan/26'
                    : key === 'anoModelo'
                      ? '2013/2014'
                      : undefined
              }
              inputMode={MONEY.includes(key) || INTS.includes(key) ? 'numeric' : undefined}
              type={key === 'email' ? 'email' : 'text'}
              autoComplete="off"
              containerClassName={
                key === 'endereco' || key === 'veiculo' || key === 'nomeExecutado'
                  ? 'sm:col-span-2'
                  : undefined
              }
            />
          ))}
          <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="liberty" disabled={submitting}>
              {submitting ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Colar da planilha"
        description="Copie as linhas na planilha (com ou sem o cabeçalho) e cole abaixo. As colunas precisam estar na mesma ordem da tabela."
        size="lg"
      >
        <div className="space-y-3 pt-2">
          <Textarea
            value={importTexto}
            onChange={(e) => setImportTexto(e.target.value)}
            rows={8}
            placeholder="Número do processo	Comarca	Nome do Executado	..."
            className="font-mono text-xs"
          />
          <p className="text-xs text-neutral-500">
            {importTexto.trim()
              ? previa.length > 0
                ? `${previa.length} registro(s) reconhecido(s): ${previa
                    .slice(0, 3)
                    .map((p) => p.nomeExecutado)
                    .join(', ')}${previa.length > 3 ? '…' : ''}`
                : 'Nenhuma linha reconhecida. Verifique se as colunas estão separadas por TAB (copiadas da planilha).'
              : 'Aguardando conteúdo colado.'}
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="liberty"
              onClick={handleImport}
              disabled={submitting || previa.length === 0}
            >
              {submitting ? 'Importando...' : `Importar ${previa.length || ''}`.trim()}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Remover prospecção?"
        description={
          confirmDelete ? (
            <>
              Remover o registro de <strong>{confirmDelete.nomeExecutado}</strong>? Esta ação não
              pode ser desfeita.
            </>
          ) : null
        }
        confirmLabel="Remover"
        tone="danger"
      />
    </section>
  )
}

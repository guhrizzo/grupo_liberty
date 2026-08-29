'use client'

import { useState } from 'react'
import {
  IconNotes,
  IconPencil,
  IconTrash,
  IconLoader2,
  IconDeviceFloppy,
  IconX,
} from '@tabler/icons-react'
import {
  Button,
  Modal,
  Select,
  Textarea,
  StatusBadge,
  ConfirmDialog,
  useToast,
} from '@/app/components/ui'
import type { BadgeTone } from '@/app/components/ui/StatusBadge'
import { formatDateTime } from '@/utils/format'
import { createAnotacao, updateAnotacao, deleteAnotacao } from './actions'
import {
  ANOTACAO_MARCADORES,
  ANOTACAO_MARCADOR_LABELS,
  type Anotacao,
  type AnotacaoEscopo,
  type AnotacaoMarcador,
} from './types'

const MARCADOR_TONE: Record<AnotacaoMarcador, BadgeTone> = {
  importante: 'danger',
  prazo: 'warning',
  andamento: 'info',
  contato: 'liberty',
}

const MARCADOR_OPTIONS = [
  { value: '', label: 'Sem marcador' },
  ...ANOTACAO_MARCADORES.map((m) => ({ value: m, label: ANOTACAO_MARCADOR_LABELS[m] })),
]

interface AnotacoesModalProps {
  open: boolean
  onClose: () => void
  escopo: AnotacaoEscopo
  /** Obrigatório quando escopo === 'processo'. */
  processoId?: string
  processoTitulo?: string
  anotacoes: Anotacao[]
  loading: boolean
  currentUid: string
  isAdmin: boolean
  /** Chamado após criar/editar/remover — o pai recarrega a lista e a contagem. */
  onMutated: () => void
}

export default function AnotacoesModal({
  open,
  onClose,
  escopo,
  processoId,
  processoTitulo,
  anotacoes,
  loading,
  currentUid,
  isAdmin,
  onMutated,
}: AnotacoesModalProps) {
  const toast = useToast()

  // Nova anotação
  const [texto, setTexto] = useState('')
  const [marcador, setMarcador] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Edição inline
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editTexto, setEditTexto] = useState('')
  const [editMarcador, setEditMarcador] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  // Remoção
  const [confirmarRemocao, setConfirmarRemocao] = useState<Anotacao | null>(null)
  const [removendo, setRemovendo] = useState(false)

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    const valor = texto.trim()
    if (!valor) {
      toast.error('Escreva o texto da anotação.')
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('escopo', escopo)
      if (escopo === 'processo' && processoId) fd.set('processoId', processoId)
      fd.set('texto', valor)
      if (marcador) fd.set('marcador', marcador)

      const res = await createAnotacao(fd)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setTexto('')
      setMarcador('')
      toast.success('Anotação adicionada.')
      onMutated()
    } finally {
      setSubmitting(false)
    }
  }

  function iniciarEdicao(a: Anotacao) {
    setEditandoId(a.id)
    setEditTexto(a.texto)
    setEditMarcador(a.marcador ?? '')
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditTexto('')
    setEditMarcador('')
  }

  async function handleSalvarEdicao(id: string) {
    const valor = editTexto.trim()
    if (!valor) {
      toast.error('Escreva o texto da anotação.')
      return
    }
    setSavingId(id)
    try {
      const fd = new FormData()
      fd.set('texto', valor)
      if (editMarcador) fd.set('marcador', editMarcador)

      const res = await updateAnotacao(id, fd)
      if (res.error) {
        toast.error(res.error)
        return
      }
      cancelarEdicao()
      toast.success('Anotação atualizada.')
      onMutated()
    } finally {
      setSavingId(null)
    }
  }

  async function handleRemover() {
    if (!confirmarRemocao) return
    setRemovendo(true)
    try {
      const res = await deleteAnotacao(confirmarRemocao.id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setConfirmarRemocao(null)
      toast.success('Anotação removida.')
      onMutated()
    } finally {
      setRemovendo(false)
    }
  }

  const titulo =
    escopo === 'processo' ? 'Anotações do processo' : 'Mural de anotações — Jurídico'

  const descricao =
    escopo === 'processo'
      ? processoTitulo
      : 'Anotações gerais do setor, sem vínculo com um processo específico.'

  return (
    <>
      <Modal open={open} onClose={onClose} title={titulo} description={descricao} size="lg">
        {/* Formulário de nova anotação */}
        <form onSubmit={handleAdicionar} className="mt-3 space-y-3">
          <Textarea
            label="Nova anotação"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder="Escreva a anotação..."
            disabled={submitting}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select
              label="Marcador"
              value={marcador}
              onChange={(e) => setMarcador(e.target.value)}
              options={MARCADOR_OPTIONS}
              containerClassName="sm:w-52"
              disabled={submitting}
            />
            <div className="sm:ml-auto">
              <Button
                type="submit"
                variant="liberty"
                loading={submitting}
                loadingLabel="Adicionando..."
                leftIcon={<IconNotes size={14} stroke={2.5} />}
              >
                Adicionar
              </Button>
            </div>
          </div>
        </form>

        {/* Linha do tempo */}
        <div className="mt-5 border-t border-neutral-200 pt-4">
          {loading ? (
            <p className="flex items-center gap-2 py-6 text-sm text-neutral-500">
              <IconLoader2 size={16} className="animate-spin" stroke={2.2} />
              Carregando anotações…
            </p>
          ) : anotacoes.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">
              Nenhuma anotação ainda. Adicione a primeira acima.
            </p>
          ) : (
            <ul className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
              {anotacoes.map((a) => {
                const podeGerenciar = a.autorUid === currentUid || isAdmin
                const emEdicao = editandoId === a.id
                const editado = a.updated_at && a.updated_at !== a.created_at
                return (
                  <li
                    key={a.id}
                    className="rounded-xl border border-neutral-200 bg-white p-3.5"
                  >
                    {emEdicao ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editTexto}
                          onChange={(e) => setEditTexto(e.target.value)}
                          rows={3}
                          disabled={savingId === a.id}
                        />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <Select
                            value={editMarcador}
                            onChange={(e) => setEditMarcador(e.target.value)}
                            options={MARCADOR_OPTIONS}
                            containerClassName="sm:w-52"
                            disabled={savingId === a.id}
                          />
                          <div className="flex gap-2 sm:ml-auto">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={cancelarEdicao}
                              disabled={savingId === a.id}
                              leftIcon={<IconX size={12} stroke={2.5} />}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="liberty"
                              onClick={() => handleSalvarEdicao(a.id)}
                              loading={savingId === a.id}
                              loadingLabel="Salvando..."
                              leftIcon={<IconDeviceFloppy size={12} stroke={2.5} />}
                            >
                              Salvar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {a.marcador && (
                              <StatusBadge tone={MARCADOR_TONE[a.marcador]}>
                                {ANOTACAO_MARCADOR_LABELS[a.marcador]}
                              </StatusBadge>
                            )}
                            <span className="text-xs font-semibold text-neutral-700">
                              {a.autorNome}
                            </span>
                            <span className="text-[11px] text-neutral-400">
                              {formatDateTime(a.created_at)}
                              {editado ? ' · editado' : ''}
                            </span>
                          </div>

                          {podeGerenciar && (
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => iniciarEdicao(a)}
                                aria-label="Editar anotação"
                                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors cursor-pointer"
                              >
                                <IconPencil size={14} stroke={2.2} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmarRemocao(a)}
                                aria-label="Remover anotação"
                                className="rounded-lg p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                              >
                                <IconTrash size={14} stroke={2.2} />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">
                          {a.texto}
                        </p>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmarRemocao}
        onClose={() => !removendo && setConfirmarRemocao(null)}
        onConfirm={handleRemover}
        title="Remover anotação?"
        description="Esta ação não pode ser desfeita."
        confirmLabel={removendo ? 'Removendo...' : 'Remover'}
        tone="danger"
        loading={removendo}
      />
    </>
  )
}

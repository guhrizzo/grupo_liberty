'use client'

import { useState, useTransition, useRef } from 'react'
import {
  IconFileText,
  IconUpload,
  IconDownload,
  IconTrash,
} from '@tabler/icons-react'
import {
  Button,
  Input,
  Textarea,
  Modal,
  ConfirmDialog,
  EmptyState,
  useToast,
} from '@/app/components/ui'
import { formatDateTime } from '@/utils/format'
import type { VeiculoContrato } from './actions'
import {
  anexarContratoVeiculoAction,
  removerContratoVeiculoAction,
} from './actions'

interface ContratosVeiculoProps {
  veiculoId: string
  initialContratos: VeiculoContrato[]
}

const MAX_PDF_SIZE = 10 * 1024 * 1024 // 10MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function ContratosVeiculo({
  veiculoId,
  initialContratos,
}: ContratosVeiculoProps) {
  const [contratos, setContratos] = useState<VeiculoContrato[]>(initialContratos)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [isUploading, startUpload] = useTransition()
  const [isRemoving, startRemove] = useTransition()
  const formRef = useRef<HTMLFormElement | null>(null)
  const toast = useToast()

  function openModal() {
    formRef.current?.reset()
    setModalOpen(true)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('veiculoId', veiculoId)

    const file = formData.get('pdf') as File | null
    if (!file || file.size === 0) {
      toast.error('Selecione um arquivo PDF.')
      return
    }
    if (file.size > MAX_PDF_SIZE) {
      toast.error('Arquivo excede o limite de 10MB.')
      return
    }
    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      toast.error('Apenas arquivos PDF são permitidos.')
      return
    }

    startUpload(async () => {
      const res = await anexarContratoVeiculoAction(formData)
      if (res.error) {
        toast.error(res.error)
        return
      }
      if (res.contrato) {
        toast.success('Contrato anexado com sucesso.')
        setContratos((prev) => [res.contrato!, ...prev])
        setModalOpen(false)
        form.reset()
      }
    })
  }

  function handleRemove() {
    if (!confirmId) return
    const formData = new FormData()
    formData.set('veiculoId', veiculoId)
    formData.set('contratoId', confirmId)

    startRemove(async () => {
      const res = await removerContratoVeiculoAction(formData)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Contrato removido com sucesso.')
      setContratos((prev) => prev.filter((c) => c.id !== confirmId))
      setConfirmId(null)
    })
  }

  const confirmTarget = contratos.find((c) => c.id === confirmId) ?? null

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <h3 className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-liberty-deep flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-liberty animate-[pulse-soft_1.4s_ease-in-out_infinite]" />
          Contratos do Veículo
        </h3>
        <Button
          variant="liberty"
          size="sm"
          leftIcon={<IconUpload size={14} stroke={2.5} />}
          onClick={openModal}
        >
          Anexar contrato
        </Button>
      </div>

      {contratos.length === 0 ? (
        <EmptyState
          icon={<IconFileText size={24} />}
          title="Nenhum contrato anexado"
          description="Anexe PDFs como contrato de compra/venda, aditivos ou termos relacionados a este veículo."
          action={
            <Button
              variant="liberty"
              size="sm"
              leftIcon={<IconUpload size={14} stroke={2.5} />}
              onClick={openModal}
            >
              Anexar primeiro contrato
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {contratos.map((c) => (
            <li
              key={c.id}
              className="group flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 hover:border-liberty/40 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-liberty/10 text-liberty">
                <IconFileText size={18} stroke={2.2} />
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-semibold text-neutral-900"
                  title={c.fileName}
                >
                  {c.fileName}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {formatDateTime(c.uploadedAt)} · {formatBytes(c.size)} ·{' '}
                  {c.uploadedByEmail ?? '—'}
                </p>
                {c.descricao && (
                  <p className="mt-1 text-xs italic text-neutral-500">
                    {c.descricao}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <a
                  href={`/api/veiculos/${veiculoId}/contratos/${c.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Baixar ${c.fileName}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 hover:bg-neutral-100 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition-colors"
                >
                  <IconDownload size={14} stroke={2.2} />
                  Baixar
                </a>
                <button
                  type="button"
                  onClick={() => setConfirmId(c.id)}
                  aria-label={`Remover ${c.fileName}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 hover:bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors cursor-pointer"
                >
                  <IconTrash size={14} stroke={2.2} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Modal de upload */}
      <Modal
        open={modalOpen}
        onClose={() => !isUploading && setModalOpen(false)}
        title="Anexar contrato"
        description="Adicione um PDF de contrato (compra/venda, aditivos, termos) vinculado a este veículo."
        size="md"
      >
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="mt-2 space-y-4"
        >
          <Input
            label="Arquivo PDF"
            name="pdf"
            type="file"
            accept="application/pdf"
            required
            hint="Máx. 10MB."
            disabled={isUploading}
          />
          <Textarea
            label="Descrição (opcional)"
            name="descricao"
            rows={3}
            placeholder="Ex.: Contrato de compra e venda assinado em 10/07/2026."
            disabled={isUploading}
          />
          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="liberty"
              loading={isUploading}
              loadingLabel="Enviando..."
              leftIcon={<IconUpload size={14} stroke={2.5} />}
            >
              Anexar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmação de remoção */}
      <ConfirmDialog
        open={!!confirmId}
        onClose={() => !isRemoving && setConfirmId(null)}
        onConfirm={handleRemove}
        title="Remover contrato?"
        description={
          confirmTarget ? (
            <>
              Tem certeza que deseja remover o arquivo{' '}
              <strong>{confirmTarget.fileName}</strong>? Esta ação também
              apaga o PDF do Storage.
            </>
          ) : null
        }
        confirmLabel={isRemoving ? 'Removendo...' : 'Remover'}
        tone="danger"
        loading={isRemoving}
      />
    </div>
  )
}

'use client'

import { useRef, useState, useTransition } from 'react'
import { IconFileText, IconUpload, IconTrash, IconEye, IconReplace } from '@tabler/icons-react'
import { Modal, ConfirmDialog, useToast } from '@/app/components/ui'
import {
  anexarComprovanteTransacao,
  removerComprovanteTransacao,
} from './actions'
import type { TransacaoComprovante } from './types'

const MAX_COMPROVANTE_SIZE = 10 * 1024 * 1024 // 10MB
const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

interface TransacaoAlvo {
  id: string
  descricao: string
  comprovante: TransacaoComprovante | null
}

export default function ComprovanteTransacao({
  transacao,
  onClose,
  onChange,
}: {
  /** `null` fecha o modal. */
  transacao: TransacaoAlvo | null
  onClose: () => void
  /** Chamado assim que anexar/remover é confirmado pelo servidor, para a
   *  tabela atualizar o indicador da linha na hora — sem depender de um
   *  refresh de página. */
  onChange: (transacaoId: string, comprovante: TransacaoComprovante | null) => void
}) {
  const toast = useToast()
  const [isUploading, startUpload] = useTransition()
  const [isRemoving, startRemove] = useTransition()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !transacao) return

    if (file.size > MAX_COMPROVANTE_SIZE) {
      toast.error('Arquivo excede o limite de 10MB.')
      e.target.value = ''
      return
    }
    if (!TIPOS_ACEITOS.includes(file.type)) {
      toast.error('Formato não suportado. Envie um PDF, JPG, PNG ou WEBP.')
      e.target.value = ''
      return
    }

    const fd = new FormData()
    fd.set('transacaoId', transacao.id)
    fd.set('arquivo', file)

    startUpload(async () => {
      const res = await anexarComprovanteTransacao(fd)
      if (res.error) {
        toast.error(res.error)
      } else if (res.comprovante) {
        toast.success('Comprovante anexado com sucesso.')
        onChange(transacao.id, res.comprovante)
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    })
  }

  function handleRemove() {
    if (!transacao) return
    startRemove(async () => {
      const res = await removerComprovanteTransacao(transacao.id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Comprovante removido com sucesso.')
      onChange(transacao.id, null)
      setConfirmOpen(false)
    })
  }

  const comprovante = transacao?.comprovante ?? null
  const url = transacao ? `/api/financeiro/${transacao.id}/comprovante` : ''
  const isImagem = comprovante?.contentType.startsWith('image/')

  return (
    <>
      <Modal
        open={!!transacao}
        onClose={onClose}
        title="Comprovante do lançamento"
        description={transacao?.descricao}
        size="md"
      >
        <div className="space-y-4">
          {comprovante ? (
            <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 text-neutral-500 adobe-dark:bg-adobe-bg-3 adobe-dark:text-adobe-text-lo">
                {isImagem ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={comprovante.fileName} className="h-full w-full object-cover" />
                ) : (
                  <IconFileText size={20} stroke={2} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-semibold text-neutral-900 adobe-dark:text-adobe-text-hi"
                  title={comprovante.fileName}
                >
                  {comprovante.fileName}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500 adobe-dark:text-adobe-text-lo">
                  {formatBytes(comprovante.size)} ·{' '}
                  {new Date(comprovante.uploadedAt).toLocaleDateString('pt-BR')}
                  {comprovante.uploadedByEmail ? ` · ${comprovante.uploadedByEmail}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500 adobe-dark:text-adobe-text-lo">
              Nenhum comprovante anexado ainda. Anexe a nota fiscal ou o recibo referente a este
              lançamento.
            </p>
          )}

          <label
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 px-4 py-4 text-center text-xs font-semibold text-neutral-600 transition-colors hover:border-liberty/40 hover:bg-liberty/5 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-3 adobe-dark:text-adobe-text-md ${
              isUploading ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {comprovante ? (
              <IconReplace size={16} stroke={2.2} className="shrink-0" />
            ) : (
              <IconUpload size={16} stroke={2.2} className="shrink-0" />
            )}
            {isUploading
              ? 'Enviando...'
              : comprovante
                ? 'Substituir por outro arquivo (PDF, JPG, PNG ou WEBP · máx. 10MB)'
                : 'Anexar nota fiscal ou recibo (PDF, JPG, PNG ou WEBP · máx. 10MB)'}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>

          {comprovante && (
            <div className="flex justify-end gap-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 adobe-dark:border-adobe-line adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-3"
              >
                <IconEye size={14} stroke={2.2} /> Visualizar
              </a>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 adobe-dark:border-rose-500/30 adobe-dark:hover:bg-rose-500/10"
              >
                <IconTrash size={14} stroke={2.2} /> Remover
              </button>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => !isRemoving && setConfirmOpen(false)}
        onConfirm={handleRemove}
        title="Remover comprovante?"
        description={
          comprovante ? (
            <>
              Tem certeza que deseja remover o arquivo <strong>{comprovante.fileName}</strong>?
              Esta ação também apaga o arquivo do Storage.
            </>
          ) : null
        }
        confirmLabel={isRemoving ? 'Removendo...' : 'Remover'}
        tone="danger"
        loading={isRemoving}
      />
    </>
  )
}

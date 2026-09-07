'use client'

import { useRef, useState, useTransition } from 'react'
import { IconCash, IconUpload, IconFileText, IconX } from '@tabler/icons-react'
import { Modal, Button, Input, useToast } from '@/app/components/ui'
import { maskMoney, parseMoney } from '@/utils/masks'
import { darBaixaManutencao } from './actions'
import type { Manutencao } from './types'

const MAX_COMPROVANTE_SIZE = 10 * 1024 * 1024 // 10MB
const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

interface Props {
  /** `null` fecha o modal. */
  manutencao: Manutencao | null
  onClose: () => void
  /** Chamado após a baixa ser confirmada pelo servidor. */
  onDone: () => void
}

export default function BaixaManutencaoModal({ manutencao, onClose, onDone }: Props) {
  const toast = useToast()
  const [valor, setValor] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [submitting, startSubmit] = useTransition()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function reset() {
    setValor('')
    setArquivo(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    if (submitting) return
    reset()
    onClose()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setArquivo(null)
      return
    }
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
    setArquivo(file)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!manutencao || submitting) return

    const valorNum = parseMoney(valor) || 0
    if (!(valorNum > 0)) {
      toast.error('Informe o valor pago na manutenção.')
      return
    }

    const fd = new FormData()
    fd.set('manutencaoId', manutencao.id)
    fd.set('valor', valor)
    if (arquivo) fd.set('arquivo', arquivo)

    startSubmit(async () => {
      const res = await darBaixaManutencao(fd)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(res.success || 'Baixa registrada.')
      reset()
      onDone()
    })
  }

  return (
    <Modal
      open={!!manutencao}
      onClose={handleClose}
      title="Dar baixa na manutenção"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {manutencao && (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 px-3.5 py-3 text-sm">
            <p className="font-semibold text-neutral-900">{manutencao.veiculoLabel}</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {manutencao.tipo} · {manutencao.oficina}
            </p>
          </div>
        )}

        <Input
          label="Valor pago (R$)"
          required
          type="text"
          inputMode="decimal"
          data-autofocus
          value={valor}
          onChange={(e) => setValor(maskMoney(e.target.value))}
          placeholder="0,00"
          leftIcon={<IconCash size={14} />}
          hint="Marca a manutenção como Concluída e entra no custo efetivo total do veículo."
        />

        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-neutral-700">
            Comprovante (opcional)
          </span>
          {arquivo ? (
            <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3">
              <IconFileText size={20} className="shrink-0 text-neutral-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900" title={arquivo.name}>
                  {arquivo.name}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {(arquivo.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setArquivo(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                aria-label="Remover arquivo"
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <IconX size={16} />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 px-4 py-4 text-center text-xs font-semibold text-neutral-600 transition-colors hover:border-liberty/40 hover:bg-liberty/5">
              <IconUpload size={16} stroke={2.2} className="shrink-0" />
              Anexar nota fiscal ou recibo (PDF, JPG, PNG ou WEBP · máx. 10MB)
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="liberty" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Dar baixa'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

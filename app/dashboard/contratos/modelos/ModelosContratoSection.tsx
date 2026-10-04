'use client'

import { useRef, useState, useTransition } from 'react'
import {
  IconDownload,
  IconFileText,
  IconFileTypePdf,
  IconPencil,
  IconPlus,
  IconTemplate,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { Button, ConfirmDialog, Input, Modal, useToast } from '@/app/components/ui'
import {
  concluirUploadModeloAction,
  excluirModeloAction,
  iniciarUploadModeloAction,
  renomearModeloAction,
} from './actions'
import {
  MODELO_ACCEPT,
  MODELO_NOME_MAX,
  MODELO_TAMANHO_MAX,
  extensaoDoArquivo,
  type ModeloContrato,
} from './types'

function tamanho(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function semExtensao(nome: string) {
  return nome.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
}

export default function ModelosContratoSection({ initialModelos }: { initialModelos: ModeloContrato[] }) {
  const toast = useToast()
  const [modelos, setModelos] = useState(initialModelos)
  const [novoAberto, setNovoAberto] = useState(false)
  const [renomeando, setRenomeando] = useState<ModeloContrato | null>(null)
  const [excluindo, setExcluindo] = useState<ModeloContrato | null>(null)
  const [isPending, startTransition] = useTransition()

  function guardar(m: ModeloContrato) {
    setModelos((atual) =>
      [...atual.filter((x) => x.id !== m.id), m].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    )
  }

  function confirmarExclusao() {
    if (!excluindo) return
    const alvo = excluindo
    startTransition(async () => {
      const res = await excluirModeloAction(alvo.id)
      if ('error' in res) {
        toast.error(res.error, 'Não foi possível excluir')
        return
      }
      setModelos((atual) => atual.filter((m) => m.id !== alvo.id))
      setExcluindo(null)
      toast.success(res.success)
    })
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-neutral-700">
            <IconTemplate size={18} className="text-liberty-deep" />
            Modelos de contrato
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Contratos em branco para baixar e preencher. Word (.doc, .docx), .odt ou PDF.
          </p>
        </div>
        <Button variant="secondary" size="sm" leftIcon={<IconPlus size={14} />} onClick={() => setNovoAberto(true)}>
          Novo modelo
        </Button>
      </div>

      {modelos.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-neutral-200 px-4 py-6 text-center text-xs text-neutral-500">
          Nenhum modelo ainda. Clique em &quot;Novo modelo&quot; para enviar o primeiro.
        </p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {modelos.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
                {m.extensao === 'pdf' ? <IconFileTypePdf size={18} /> : <IconFileText size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-neutral-900" title={m.nome}>
                  {m.nome}
                </p>
                <p className="text-[11px] uppercase text-neutral-500">
                  {m.extensao} · {tamanho(m.size)}
                </p>
              </div>
              <a
                href={`/api/contratos/modelos/${m.id}`}
                aria-label={`Baixar ${m.nome}`}
                title="Baixar"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-liberty/10 text-liberty-deep hover:bg-liberty/20"
              >
                <IconDownload size={15} stroke={2.4} />
              </a>
              <button
                type="button"
                onClick={() => setRenomeando(m)}
                aria-label={`Renomear ${m.nome}`}
                title="Renomear"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 cursor-pointer"
              >
                <IconPencil size={14} stroke={2.4} />
              </button>
              <button
                type="button"
                onClick={() => setExcluindo(m)}
                aria-label={`Excluir ${m.nome}`}
                title="Excluir"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
              >
                <IconTrash size={14} stroke={2.4} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {novoAberto && (
        <NovoModeloModal
          onClose={() => setNovoAberto(false)}
          onSalvo={(m) => {
            guardar(m)
            setNovoAberto(false)
          }}
        />
      )}

      {renomeando && (
        <RenomearModal
          key={renomeando.id}
          modelo={renomeando}
          onClose={() => setRenomeando(null)}
          onSalvo={(m) => {
            guardar(m)
            setRenomeando(null)
          }}
        />
      )}

      <ConfirmDialog
        open={!!excluindo}
        onClose={() => setExcluindo(null)}
        onConfirm={confirmarExclusao}
        title="Excluir modelo"
        description={excluindo ? `Excluir o modelo "${excluindo.nome}"? O arquivo será apagado.` : ''}
        confirmLabel="Excluir"
        tone="danger"
        loading={isPending}
      />
    </section>
  )
}

function NovoModeloModal({ onClose, onSalvo }: { onClose: () => void; onSalvo: (m: ModeloContrato) => void }) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [nome, setNome] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)

  function escolher(f: File | undefined) {
    if (!f) return
    if (!extensaoDoArquivo(f.name)) {
      toast.error('Envie um arquivo Word (.doc, .docx), .odt ou PDF.')
      return
    }
    if (f.size > MODELO_TAMANHO_MAX) {
      toast.error('Arquivo excede o limite de 20MB.')
      return
    }
    setArquivo(f)
    if (!nome.trim()) setNome(semExtensao(f.name).slice(0, MODELO_NOME_MAX))
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!arquivo || !nome.trim()) {
      toast.error('Informe o nome e escolha o arquivo.')
      return
    }
    setEnviando(true)
    try {
      const inicio = await iniciarUploadModeloAction({ nome, fileName: arquivo.name, size: arquivo.size })
      if ('error' in inicio) {
        toast.error(inicio.error)
        return
      }
      // Direto para o Storage: a Vercel limita o corpo a ~4,5MB.
      const put = await fetch(inicio.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': inicio.contentType },
        body: arquivo,
      }).catch(() => null)
      if (!put || !put.ok) {
        toast.error('Falha ao enviar o arquivo. Tente novamente.')
        return
      }
      const res = await concluirUploadModeloAction({ modeloId: inicio.modeloId, nome, fileName: arquivo.name })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(res.success)
      onSalvo(res.modelo)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo modelo de contrato" size="md">
      <form onSubmit={enviar} className="space-y-4">
        <Input
          label="Nome do contrato"
          value={nome}
          maxLength={MODELO_NOME_MAX}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Contrato de compra e venda"
        />
        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-neutral-700">Arquivo</span>
          <input
            ref={inputRef}
            type="file"
            accept={MODELO_ACCEPT}
            className="hidden"
            onChange={(e) => escolher(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-left hover:bg-neutral-50 cursor-pointer"
          >
            <IconUpload size={18} className="shrink-0 text-neutral-500" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-neutral-900">
                {arquivo ? arquivo.name : 'Escolher arquivo'}
              </span>
              <span className="block text-[11px] text-neutral-500">
                {arquivo ? tamanho(arquivo.size) : 'Word, .odt ou PDF, até 20MB'}
              </span>
            </span>
          </button>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" variant="liberty" loading={enviando}>
            Enviar modelo
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function RenomearModal({
  modelo,
  onClose,
  onSalvo,
}: {
  modelo: ModeloContrato
  onClose: () => void
  onSalvo: (m: ModeloContrato) => void
}) {
  const toast = useToast()
  const [nome, setNome] = useState(modelo.nome)
  const [isPending, startTransition] = useTransition()

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await renomearModeloAction(modelo.id, nome)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(res.success)
      onSalvo(res.modelo)
    })
  }

  return (
    <Modal open onClose={onClose} title="Renomear modelo" size="sm">
      <form onSubmit={salvar} className="space-y-4">
        <Input label="Nome do contrato" value={nome} maxLength={MODELO_NOME_MAX} onChange={(e) => setNome(e.target.value)} autoFocus />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="liberty" loading={isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

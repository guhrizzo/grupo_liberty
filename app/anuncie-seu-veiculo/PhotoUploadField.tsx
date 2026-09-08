'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  IconPhoto,
  IconUpload,
  IconX,
  IconArrowUp,
  IconArrowDown,
  IconStar,
} from '@tabler/icons-react'
import { useToast } from '../components/ui'

export interface LocalFoto {
  id: string
  /** Arquivo já comprimido, pronto para enviar. */
  file: File
  /** ObjectURL para preview — revogado ao remover / desmontar. */
  previewUrl: string
}

interface PhotoUploadFieldProps {
  fotos: LocalFoto[]
  onChange: (next: LocalFoto[]) => void
  max?: number
  disabled?: boolean
}

const MAX_DIMENSAO = 1600
const ALVO_BYTES = 1.5 * 1024 * 1024

function uid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

/**
 * Redimensiona e comprime a imagem no navegador antes do upload. Lado maior
 * ≤ 1600px, JPEG qualidade 0.8 (cai para 0.6 se ainda passar de ~1,5MB).
 * Se o navegador não conseguir decodificar (ex.: HEIC), devolve o arquivo
 * original — o servidor ainda aceita e valida.
 */
async function comprimirImagem(file: File): Promise<File> {
  const dataUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode'))
      el.src = dataUrl
    })

    const escala = Math.min(1, MAX_DIMENSAO / Math.max(img.width, img.height))
    const w = Math.round(img.width * escala)
    const h = Math.round(img.height * escala)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, w, h)

    const toBlob = (q: number) =>
      new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', q))

    let blob = await toBlob(0.8)
    if (blob && blob.size > ALVO_BYTES) {
      const menor = await toBlob(0.6)
      if (menor) blob = menor
    }
    if (!blob) return file

    const nome = file.name.replace(/\.[^.]+$/, '') || 'foto'
    return new File([blob], `${nome}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(dataUrl)
  }
}

export default function PhotoUploadField({
  fotos,
  onChange,
  max = 10,
  disabled = false,
}: PhotoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  // Revoga todos os previews quando o componente sai de cena.
  const fotosRef = useRef(fotos)
  useEffect(() => {
    fotosRef.current = fotos
  }, [fotos])
  useEffect(() => {
    return () => {
      for (const f of fotosRef.current) URL.revokeObjectURL(f.previewUrl)
    }
  }, [])

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return
      const escolhidos = Array.from(fileList)
      const imagens = escolhidos.filter((f) => f.type.startsWith('image/'))

      if (imagens.length < escolhidos.length) {
        toast.error('Alguns arquivos não são imagens e foram ignorados.')
      }

      const espaco = max - fotos.length
      if (espaco <= 0) {
        toast.error(`Você já adicionou o máximo de ${max} fotos.`)
        return
      }

      const aProcessar = imagens.slice(0, espaco)
      if (aProcessar.length < imagens.length) {
        toast.error(`Só cabem mais ${espaco} foto(s). O restante foi ignorado.`)
      }

      const novos: LocalFoto[] = []
      for (const original of aProcessar) {
        const comprimido = await comprimirImagem(original)
        novos.push({
          id: uid(),
          file: comprimido,
          previewUrl: URL.createObjectURL(comprimido),
        })
      }
      onChange([...fotos, ...novos])
    },
    [fotos, max, onChange, toast],
  )

  const remover = (id: string) => {
    const alvo = fotos.find((f) => f.id === id)
    if (alvo) URL.revokeObjectURL(alvo.previewUrl)
    onChange(fotos.filter((f) => f.id !== id))
  }

  const mover = (index: number, dir: -1 | 1) => {
    const destino = index + dir
    if (destino < 0 || destino >= fotos.length) return
    const copia = [...fotos]
    ;[copia[index], copia[destino]] = [copia[destino], copia[index]]
    onChange(copia)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
          Fotos do veículo <span className="text-rose-500">*</span>
        </span>
        <span className="text-[11px] font-semibold text-neutral-400">
          {fotos.length}/{max}
        </span>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || fotos.length >= max}
        className="w-full rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50/60 px-4 py-6 text-center transition-colors hover:border-liberty hover:bg-liberty/5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <IconUpload size={22} className="mx-auto mb-2 text-neutral-400" />
        <span className="block text-sm font-bold text-neutral-700">
          Adicionar fotos
        </span>
        <span className="block text-xs text-neutral-500 mt-0.5">
          Frente, traseira, laterais, interior e motor. Até {max} fotos.
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {fotos.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {fotos.map((foto, i) => (
            <li
              key={foto.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto.previewUrl}
                alt={`Foto ${i + 1}`}
                className="h-full w-full object-cover"
              />
              {i === 0 && (
                <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-liberty px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  <IconStar size={9} stroke={3} /> Capa
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  className="rounded bg-white/90 p-1 text-neutral-700 disabled:opacity-30 hover:bg-white cursor-pointer"
                  aria-label="Mover para trás"
                >
                  <IconArrowUp size={12} stroke={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === fotos.length - 1}
                  className="rounded bg-white/90 p-1 text-neutral-700 disabled:opacity-30 hover:bg-white cursor-pointer"
                  aria-label="Mover para frente"
                >
                  <IconArrowDown size={12} stroke={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => remover(foto.id)}
                  className="rounded bg-rose-600 p-1 text-white hover:bg-rose-700 cursor-pointer"
                  aria-label="Remover foto"
                >
                  <IconX size={12} stroke={2.5} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {fotos.length === 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400">
          <IconPhoto size={13} /> Nenhuma foto adicionada ainda.
        </p>
      )}
    </div>
  )
}

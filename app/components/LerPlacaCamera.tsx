'use client'

import { useRef, useState } from 'react'
import { IconCamera, IconLoader2 } from '@tabler/icons-react'

// Foto do celular tem 12MP+; para ler a placa basta bem menos — e a foto
// precisa caber no limite de corpo da Vercel (~4,5MB).
const LADO_MAX = 1600
const QUALIDADE_JPEG = 0.85

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível abrir a foto.'))
    }
    img.src = url
  })
}

/** Reduz a foto e devolve o JPEG em base64 (sem o prefixo `data:`). */
async function fotoParaBase64(arquivo: File): Promise<string> {
  const img = await carregarImagem(arquivo)
  const escala = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * escala)
  canvas.height = Math.round(img.naturalHeight * escala)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível.')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', QUALIDADE_JPEG).split(',')[1] ?? ''
}

/**
 * Botão que abre a câmera do celular (ou o seletor de foto no computador) e
 * lê a placa com IA no servidor (/api/ler-placa). Devolve a placa encontrada;
 * quem usa decide o que fazer — ex.: já buscar a FIPE.
 */
export default function LerPlacaCamera({
  onPlaca,
  onErro,
  disabled,
}: {
  onPlaca: (placa: string) => void
  onErro: (mensagem: string) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [lendo, setLendo] = useState(false)

  async function lerFoto(arquivo: File) {
    setLendo(true)
    try {
      const imagem = await fotoParaBase64(arquivo)
      const res = await fetch('/api/ler-placa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imagem, tipo: 'image/jpeg' }),
      })
      const data = (await res.json().catch(() => ({}))) as { placa?: string; error?: string }
      if (res.ok && data.placa) onPlaca(data.placa)
      else onErro(data.error || 'Não consegui ler a placa. Tente de novo ou digite.')
    } catch (err) {
      console.error('[LerPlacaCamera]', err)
      onErro('Erro ao ler a foto. Tente de novo ou digite a placa.')
    } finally {
      setLendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          if (arquivo) void lerFoto(arquivo)
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || lendo}
        aria-label="Ler placa pela câmera"
        title="Ler placa pela câmera"
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 cursor-pointer"
      >
        {lendo ? <IconLoader2 size={18} className="animate-spin" /> : <IconCamera size={18} stroke={2.2} />}
        {lendo ? 'Lendo placa...' : 'Câmera'}
      </button>
    </>
  )
}

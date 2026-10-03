'use client'

import { useRef, useState } from 'react'
import { IconCamera, IconLoader2 } from '@tabler/icons-react'
import { extrairPlaca } from '@/utils/veiculos/placa-ocr'

/** Recorte da foto (frações da largura/altura) a ser lido. */
type Recorte = { x: number; y: number; w: number; h: number }

const FOTO_INTEIRA: Recorte = { x: 0, y: 0, w: 1, h: 1 }
// A placa costuma ficar no meio quando a pessoa mira nela.
const CENTRO: Recorte = { x: 0.15, y: 0.25, w: 0.7, h: 0.5 }

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

/** Recorta, redimensiona e passa para tons de cinza com contraste esticado. */
function prepararImagem(img: HTMLImageElement, r: Recorte): HTMLCanvasElement {
  const sx = img.naturalWidth * r.x
  const sy = img.naturalHeight * r.y
  const sw = img.naturalWidth * r.w
  const sh = img.naturalHeight * r.h
  const escala = Math.min(1600 / sw, 2)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sw * escala)
  canvas.height = Math.round(sh * escala)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return canvas
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

  const dados = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = dados.data
  let min = 255
  let max = 0
  for (let i = 0; i < px.length; i += 4) {
    const cinza = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    px[i] = cinza
    if (cinza < min) min = cinza
    if (cinza > max) max = cinza
  }
  const faixa = Math.max(max - min, 1)
  for (let i = 0; i < px.length; i += 4) {
    const v = ((px[i] - min) / faixa) * 255
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(dados, 0, 0)
  return canvas
}

/**
 * Botão que abre a câmera do celular (ou o seletor de foto no computador), lê
 * a placa com OCR no próprio navegador (Tesseract, sem custo) e devolve a
 * placa encontrada. Quem usa decide o que fazer — ex.: já buscar a FIPE.
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
      const img = await carregarImagem(arquivo)
      // Import dinâmico: o Tesseract (e os dados de idioma, via CDN) só
      // carregam quando alguém usa a câmera.
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      try {
        // Fica no modo de página padrão (bloco único): no tesseract.js 7 o
        // modo "texto esparso" devolve vazio até para uma placa nítida.
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
        })
        for (const recorte of [FOTO_INTEIRA, CENTRO]) {
          const { data } = await worker.recognize(prepararImagem(img, recorte))
          const placa = extrairPlaca(data.text)
          if (placa) {
            onPlaca(placa)
            return
          }
        }
        onErro('Não consegui ler a placa. Tire a foto mais de perto, com a placa reta e bem iluminada, ou digite.')
      } finally {
        await worker.terminate()
      }
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

'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { IconX, IconChevronLeft, IconChevronRight, IconZoomIn } from '@tabler/icons-react'

interface PhotoLightboxProps {
  fotos: string[]
  alt: string
  initialIndex?: number
  onClose: () => void
}

// Quanto a foto aumenta ao clicar. 2.5x é o suficiente pra ver detalhe
// (amassado, risco, desgaste de pneu) sem esticar demais e pixelar.
const ZOOM_SCALE = 2.5

/**
 * Visualizador de fotos em tela cheia com zoom, navegação por teclado (Esc,
 * setas) e contador — mesmo comportamento do lightbox da página pública do
 * veículo (`app/veiculos/[id]/GalleryViewer.tsx`), extraído aqui pra poder
 * ser reaproveitado em qualquer lugar que só precise do "clique pra ampliar"
 * sem a grade de miniaturas (ex.: os cards do estoque no dashboard).
 *
 * Zoom: clicar na foto amplia centralizado exatamente no ponto clicado (não
 * só no centro da imagem). Com o mouse, dá pra passear pela foto ampliada —
 * o ponto de foco segue o cursor em tempo real. Clicar de novo (ou trocar de
 * foto) volta ao tamanho normal.
 */
export default function PhotoLightbox({ fotos, alt, initialIndex = 0, onClose }: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const [zoomed, setZoomed] = useState(false)
  const [origin, setOrigin] = useState({ x: 50, y: 50 })
  const imgWrapRef = useRef<HTMLDivElement>(null)
  const prevFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setIndex(initialIndex)
  }, [initialIndex])

  // Troca de foto sempre volta pro tamanho normal — evita abrir a próxima
  // foto já ampliada num ponto que não faz sentido pra ela.
  useEffect(() => {
    setZoomed(false)
  }, [index])

  useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (fotos.length < 2) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setIndex((p) => (p + 1) % fotos.length)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIndex((p) => (p - 1 + fotos.length) % fotos.length)
      }
    }
    document.addEventListener('keydown', onKey)
    // Trava scroll do body enquanto o lightbox está aberto.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevFocus.current?.focus?.()
    }
  }, [onClose, fotos.length])

  if (!fotos || fotos.length === 0) return null

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setIndex((p) => (p + 1) % fotos.length)
  }
  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setIndex((p) => (p - 1 + fotos.length) % fotos.length)
  }

  // Posição do clique/toque em % da imagem — vira o transform-origin, ou
  // seja, o ponto exato que fica no centro quando amplia.
  const pontoRelativo = (clientX: number, clientY: number) => {
    const rect = imgWrapRef.current?.getBoundingClientRect()
    if (!rect) return { x: 50, y: 50 }
    return {
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    }
  }

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (zoomed) {
      setZoomed(false)
      return
    }
    setOrigin(pontoRelativo(e.clientX, e.clientY))
    setZoomed(true)
  }

  // Com o mouse, o foco do zoom acompanha o cursor em tempo real — dá pra
  // "passear" pela foto ampliada sem precisar clicar de novo a cada área.
  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (!zoomed) return
    setOrigin(pontoRelativo(e.clientX, e.clientY))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Galeria de ${alt}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950/95 backdrop-blur-sm px-4 animate-fade-in"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar galeria (Esc)"
        autoFocus
        className="absolute top-6 right-6 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-[background-color,color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer border border-white/10"
      >
        <IconX size={20} stroke={2.5} />
      </button>

      {fotos.length > 1 && (
        <button
          type="button"
          onClick={prevImage}
          aria-label="Foto anterior (seta esquerda)"
          className="absolute left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-3.5 rounded-full transition-[background-color,color,border-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer hidden sm:flex items-center justify-center border border-white/10 hover:scale-105"
        >
          <IconChevronLeft size={24} stroke={2.5} />
        </button>
      )}

      <div
        ref={imgWrapRef}
        className="relative w-full max-w-5xl aspect-16/10 max-h-[80vh] flex items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={fotos[index]}
          alt={`${alt} - Foto ${index + 1}`}
          fill
          className={`object-contain transition-transform duration-300 ease-out ${
            zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
          }`}
          style={{
            transform: `scale(${zoomed ? ZOOM_SCALE : 1})`,
            transformOrigin: `${origin.x}% ${origin.y}%`,
          }}
          sizes="100vw"
          onClick={handleImageClick}
          onMouseMove={handleImageMouseMove}
        />

        {!zoomed && (
          <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-white/90">
            <IconZoomIn size={13} stroke={2.2} />
            Clique pra ampliar
          </span>
        )}
      </div>

      {fotos.length > 1 && (
        <button
          type="button"
          onClick={nextImage}
          aria-label="Próxima foto (seta direita)"
          className="absolute right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-3.5 rounded-full transition-[background-color,color,border-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer hidden sm:flex items-center justify-center border border-white/10 hover:scale-105"
        >
          <IconChevronRight size={24} stroke={2.5} />
        </button>
      )}

      <div className="mt-6 flex items-center gap-6">
        {fotos.length > 1 && (
          <button
            type="button"
            onClick={prevImage}
            className="text-white/80 bg-white/10 px-4 py-2 rounded-lg text-xs font-semibold sm:hidden border border-white/10 cursor-pointer"
          >
            Anterior
          </button>
        )}
        <span
          className="text-white/90 text-xs font-bold bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10"
          aria-live="polite"
        >
          {index + 1} de {fotos.length}
        </span>
        {fotos.length > 1 && (
          <button
            type="button"
            onClick={nextImage}
            className="text-white/80 bg-white/10 px-4 py-2 rounded-lg text-xs font-semibold sm:hidden border border-white/10 cursor-pointer"
          >
            Próxima
          </button>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  IconCar,
  IconArrowsMaximize,
  IconX,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react'

interface GalleryViewerProps {
  fotos: string[]
  alt: string
}

export default function GalleryViewer({ fotos, alt }: GalleryViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const prevFocus = useRef<HTMLElement | null>(null)

  // Teclado: ESC fecha, setas navegam.
  useEffect(() => {
    if (!lightboxOpen) return
    prevFocus.current = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setLightboxOpen(false)
        return
      }
      if (fotos.length < 2) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setLightboxIndex((p) => (p + 1) % fotos.length)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setLightboxIndex((p) => (p - 1 + fotos.length) % fotos.length)
      }
    }
    document.addEventListener('keydown', onKey)
    // Trava scroll do body enquanto lightbox aberto.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      // Restaura foco no elemento que abriu o lightbox.
      prevFocus.current?.focus?.()
    }
  }, [lightboxOpen, fotos.length])

  if (!fotos || fotos.length === 0) {
    return (
      <div className="flex aspect-16/9 w-full items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 text-neutral-500">
        <IconCar size={48} stroke={1.5} aria-hidden />
        <span className="ml-2 text-sm font-medium">Nenhuma foto cadastrada</span>
      </div>
    )
  }

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }
  const closeLightbox = () => setLightboxOpen(false)
  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setLightboxIndex((prev) => (prev + 1) % fotos.length)
  }
  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setLightboxIndex((prev) => (prev - 1 + fotos.length) % fotos.length)
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => openLightbox(activeIndex)}
        aria-label={`Ampliar foto ${activeIndex + 1} de ${fotos.length}`}
        className="relative aspect-16/9 w-full rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50 cursor-zoom-in group hover:border-liberty transition-all duration-300"
      >
        <Image
          src={fotos[activeIndex]}
          alt={`${alt} - Foto Principal`}
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
        <span className="absolute bottom-4 right-4 rounded-lg bg-white/95 text-neutral-700 text-[10px] font-extrabold px-3 py-1.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity border border-neutral-200 shadow-sm">
          <IconArrowsMaximize size={12} stroke={2.5} aria-hidden />
          Clique para ampliar
        </span>
      </button>

      {fotos.length > 1 && (
        <div
          className="grid grid-cols-4 sm:grid-cols-5 gap-3"
          role="tablist"
          aria-label="Miniaturas"
        >
          {fotos.map((url, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Miniatura ${index + 1}`}
              onClick={() => setActiveIndex(index)}
              className={`relative aspect-16/10 rounded-lg overflow-hidden bg-neutral-50 transition-all duration-200 cursor-pointer ${
                index === activeIndex
                  ? 'border-2 border-liberty shadow-sm'
                  : 'border border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <Image
                src={url}
                alt={`${alt} - Miniatura ${index + 1}`}
                fill
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Galeria de ${alt}`}
          onClick={closeLightbox}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950/95 backdrop-blur-sm px-4 animate-fade-in"
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Fechar galeria (Esc)"
            autoFocus
            className="absolute top-6 right-6 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all cursor-pointer border border-white/10"
          >
            <IconX size={20} stroke={2.5} />
          </button>

          {fotos.length > 1 && (
            <button
              type="button"
              onClick={prevImage}
              aria-label="Foto anterior (seta esquerda)"
              className="absolute left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-3.5 rounded-full transition-all cursor-pointer hidden sm:flex items-center justify-center border border-white/10"
            >
              <IconChevronLeft size={24} stroke={2.5} />
            </button>
          )}

          <div className="relative w-full max-w-5xl aspect-16/10 max-h-[80vh] flex items-center justify-center">
            <Image
              src={fotos[lightboxIndex]}
              alt={`${alt} - Foto ${lightboxIndex + 1}`}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>

          {fotos.length > 1 && (
            <button
              type="button"
              onClick={nextImage}
              aria-label="Próxima foto (seta direita)"
              className="absolute right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-3.5 rounded-full transition-all cursor-pointer hidden sm:flex items-center justify-center border border-white/10"
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
              {lightboxIndex + 1} de {fotos.length}
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
      )}
    </div>
  )
}

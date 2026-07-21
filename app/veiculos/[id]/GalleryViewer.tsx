'use client'

import { useState } from 'react'
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

  if (!fotos || fotos.length === 0) {
    return (
      <div className="flex aspect-16/9 w-full items-center justify-center rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-bg-2)] text-[var(--color-text-lo)]">
        <IconCar size={48} stroke={1.5} />
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
      <div
        onClick={() => openLightbox(activeIndex)}
        className="relative aspect-16/9 w-full rounded-xl overflow-hidden border border-[var(--color-line)] bg-[var(--color-bg-2)] cursor-zoom-in group hover:border-[var(--color-neon)]/40 transition-all duration-300"
      >
        <Image
          src={fotos[activeIndex]}
          alt={`${alt} - Foto Principal`}
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-4 right-4 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[10px] font-extrabold px-3 py-1.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity border border-white/10">
          <IconArrowsMaximize size={12} stroke={2.5} />
          Clique para ampliar
        </div>
      </div>

      {fotos.length > 1 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
          {fotos.map((url, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`relative aspect-16/10 rounded-lg overflow-hidden bg-[var(--color-bg-2)] transition-all duration-200 cursor-pointer ${
                index === activeIndex
                  ? 'border-2 border-[var(--color-neon)] shadow-[0_0_12px_-2px_rgba(0,212,255,0.5)]'
                  : 'border border-[var(--color-line)] hover:border-[var(--color-text-mute)]'
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
          onClick={closeLightbox}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm px-4"
        >
          <button
            onClick={closeLightbox}
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all cursor-pointer border border-white/10"
          >
            <IconX size={20} stroke={2.5} />
          </button>

          {fotos.length > 1 && (
            <button
              onClick={prevImage}
              className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-[var(--color-neon-soft)] bg-white/10 hover:bg-white/20 p-3.5 rounded-full transition-all cursor-pointer hidden sm:block border border-white/10"
            >
              <IconChevronLeft size={24} stroke={2.5} />
            </button>
          )}

          <div className="relative w-full max-w-5xl aspect-16/10 max-h-[80vh] flex items-center justify-center">
            <Image
              src={fotos[lightboxIndex]}
              alt={`${alt} - Tela Cheia`}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>

          {fotos.length > 1 && (
            <button
              onClick={nextImage}
              className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-[var(--color-neon-soft)] bg-white/10 hover:bg-white/20 p-3.5 rounded-full transition-all cursor-pointer hidden sm:block border border-white/10"
            >
              <IconChevronRight size={24} stroke={2.5} />
            </button>
          )}

          <div className="mt-6 flex items-center gap-6">
            {fotos.length > 1 && (
              <button
                onClick={prevImage}
                className="text-white/75 bg-white/10 px-4 py-2 rounded-lg text-xs font-semibold sm:hidden border border-white/10"
              >
                Anterior
              </button>
            )}
            <span className="text-white/80 text-xs font-bold bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10">
              {lightboxIndex + 1} de {fotos.length}
            </span>
            {fotos.length > 1 && (
              <button
                onClick={nextImage}
                className="text-white/75 bg-white/10 px-4 py-2 rounded-lg text-xs font-semibold sm:hidden border border-white/10"
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

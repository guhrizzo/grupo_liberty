'use client'

import { useState } from 'react'
import Image from 'next/image'
import { IconCar, IconArrowsMaximize } from '@tabler/icons-react'
import PhotoLightbox from '@/app/components/PhotoLightbox'

interface GalleryViewerProps {
  fotos: string[]
  alt: string
}

export default function GalleryViewer({ fotos, alt }: GalleryViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  if (!fotos || fotos.length === 0) {
    return (
      <div className="flex aspect-16/9 w-full items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 text-neutral-500">
        <IconCar size={48} stroke={1.5} aria-hidden />
        <span className="ml-2 text-sm font-medium">Nenhuma foto cadastrada</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        aria-label={`Ampliar foto ${activeIndex + 1} de ${fotos.length}`}
        className="relative aspect-16/9 w-full rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50 cursor-zoom-in group hover:border-liberty transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
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
              className={`relative aspect-16/10 rounded-lg overflow-hidden bg-neutral-50 transition-[border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer ${
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
        <PhotoLightbox
          fotos={fotos}
          alt={alt}
          initialIndex={activeIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}

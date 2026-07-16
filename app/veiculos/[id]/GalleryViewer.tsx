'use client'

import { useState } from 'react'
import Image from 'next/image'

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
      <div className="flex aspect-16/9 w-full items-center justify-center rounded-xl border border-dashed border-neutral-350 bg-neutral-50 text-neutral-400">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M5 17H3v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="ml-2 text-sm font-medium">Nenhuma foto cadastrada</span>
      </div>
    )
  }

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
  }

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
      {/* Imagem Principal */}
      <div 
        onClick={() => openLightbox(activeIndex)}
        className="relative aspect-16/9 w-full rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-50 cursor-zoom-in group hover:opacity-95 transition-all duration-300"
      >
        <Image
          src={fotos[activeIndex]}
          alt={`${alt} - Foto Principal`}
          fill
          priority
          className="object-cover"
        />
        <div className="absolute bottom-4 right-4 rounded-xl bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-3 py-1.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-305">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
          Clique para ampliar
        </div>
      </div>

      {/* Miniaturas (Thumbnails) */}
      {fotos.length > 1 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
          {fotos.map((url, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`relative aspect-16/10 rounded-xl overflow-hidden border bg-neutral-50 transition-all duration-200 cursor-pointer ${
                index === activeIndex
                  ? 'border-neutral-950 ring-2 ring-neutral-950/20'
                  : 'border-neutral-200 hover:border-neutral-400'
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

      {/* Lightbox / Visualizador Tela Cheia */}
      {lightboxOpen && (
        <div 
          onClick={closeLightbox}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xs px-4"
        >
          {/* Botão de Fechar */}
          <button 
            onClick={closeLightbox}
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          {/* Navegação Anterior */}
          {fotos.length > 1 && (
            <button 
              onClick={prevImage}
              className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-3.5 rounded-full transition-all cursor-pointer hidden sm:block"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          )}

          {/* Container da Imagem em Destaque */}
          <div className="relative w-full max-w-5xl aspect-16/10 max-h-[80vh] flex items-center justify-center">
            <Image
              src={fotos[lightboxIndex]}
              alt={`${alt} - Tela Cheia`}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>

          {/* Navegação Próxima */}
          {fotos.length > 1 && (
            <button 
              onClick={nextImage}
              className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-3.5 rounded-full transition-all cursor-pointer hidden sm:block"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          )}

          {/* Indicador / Controles mobile-friendly */}
          <div className="mt-6 flex items-center gap-6">
            {fotos.length > 1 && (
              <button 
                onClick={prevImage}
                className="text-white/75 bg-white/10 px-4 py-2 rounded-lg text-xs font-semibold sm:hidden"
              >
                Anterior
              </button>
            )}
            <span className="text-white/80 text-xs font-bold bg-white/10 px-3.5 py-1.5 rounded-full">
              {lightboxIndex + 1} de {fotos.length}
            </span>
            {fotos.length > 1 && (
              <button 
                onClick={nextImage}
                className="text-white/75 bg-white/10 px-4 py-2 rounded-lg text-xs font-semibold sm:hidden"
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

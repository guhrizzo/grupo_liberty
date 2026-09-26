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

// Distância mínima (px) pra um arraste de dedo contar como swipe e não como
// toque — abaixo disso o navegador ainda dispara o click (zoom).
const SWIPE_MIN = 50

/**
 * Visualizador de fotos em tela cheia com zoom, navegação por teclado (Esc,
 * setas), swipe no celular, contador e faixa de miniaturas. Usado na página
 * pública do veículo (`app/veiculos/[id]/GalleryViewer.tsx`) e em qualquer
 * lugar que só precise do "clique pra ampliar" (ex.: os cards do estoque no
 * dashboard).
 *
 * Layout: a foto ocupa toda a área entre a barra de cima (contador + fechar)
 * e a de baixo (miniaturas) — sem caixa de proporção fixa, então foto em pé
 * no celular aparece grande em vez de espremida numa faixa 16:10.
 *
 * Zoom: clicar/tocar na foto amplia centralizado exatamente no ponto clicado.
 * Com o mouse, o ponto de foco segue o cursor; no toque, arrastar o dedo
 * passeia pela foto ampliada. Clicar de novo (ou trocar de foto) volta ao
 * tamanho normal.
 *
 * Gestos (sem zoom): deslizar pro lado troca de foto, deslizar pra baixo fecha.
 */
export default function PhotoLightbox({ fotos, alt, initialIndex = 0, onClose }: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const [zoomed, setZoomed] = useState(false)
  const [origin, setOrigin] = useState({ x: 50, y: 50 })
  // Deslocamento do dedo durante o swipe, pra foto acompanhar o gesto.
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const imgWrapRef = useRef<HTMLDivElement>(null)
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
  const prevFocus = useRef<HTMLElement | null>(null)
  const touch = useRef<{ x: number; y: number; lastX: number; lastY: number } | null>(null)

  // `initialIndex` só vale na abertura — todos os usos montam o lightbox do
  // zero a cada abertura (`{aberto && <PhotoLightbox … />}`).

  // Troca de foto sempre volta pro tamanho normal — evita abrir a próxima
  // foto já ampliada num ponto que não faz sentido pra ela.
  const irPara = (calc: (atual: number) => number) => {
    setZoomed(false)
    setIndex(calc)
  }

  // Mantém a miniatura da foto atual visível na faixa de baixo.
  useEffect(() => {
    thumbRefs.current[index]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
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
        setZoomed(false)
        setIndex((p) => (p + 1) % fotos.length)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setZoomed(false)
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

  const temVarias = fotos.length > 1

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    irPara((p) => (p + 1) % fotos.length)
  }
  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    irPara((p) => (p - 1 + fotos.length) % fotos.length)
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
  const handleImagePointerMove = (e: React.PointerEvent) => {
    if (!zoomed || e.pointerType !== 'mouse') return
    setOrigin(pontoRelativo(e.clientX, e.clientY))
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY, lastX: t.clientX, lastY: t.clientY }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const start = touch.current
    if (!start || e.touches.length !== 1) return
    const t = e.touches[0]

    if (zoomed) {
      // Arrastar a foto ampliada: com transform-origin, mover a origem em Δ%
      // desloca a imagem em -Δ% × (escala - 1) × largura. Então pra imagem
      // seguir o dedo, a origem anda no sentido oposto, proporcional.
      const rect = imgWrapRef.current?.getBoundingClientRect()
      if (rect) {
        const dx = t.clientX - start.lastX
        const dy = t.clientY - start.lastY
        setOrigin((o) => ({
          x: Math.min(100, Math.max(0, o.x - (dx / ((ZOOM_SCALE - 1) * rect.width)) * 100)),
          y: Math.min(100, Math.max(0, o.y - (dy / ((ZOOM_SCALE - 1) * rect.height)) * 100)),
        }))
      }
      start.lastX = t.clientX
      start.lastY = t.clientY
      return
    }

    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    // Trava no eixo dominante: horizontal troca de foto, vertical (só pra
    // baixo) fecha.
    if (Math.abs(dx) > Math.abs(dy)) setDrag({ x: temVarias ? dx : 0, y: 0 })
    else setDrag({ x: 0, y: Math.max(0, dy) })
  }

  const handleTouchEnd = () => {
    const d = drag
    touch.current = null
    setDrag({ x: 0, y: 0 })
    if (zoomed) return
    if (d.y > SWIPE_MIN * 2) {
      onClose()
    } else if (temVarias && d.x <= -SWIPE_MIN) {
      nextImage()
    } else if (temVarias && d.x >= SWIPE_MIN) {
      prevImage()
    }
  }

  const arrastando = drag.x !== 0 || drag.y !== 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Galeria de ${alt}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex h-dvh flex-col bg-neutral-950 animate-fade-in"
      style={arrastando && drag.y > 0 ? { backgroundColor: `rgb(10 10 10 / ${Math.max(0.4, 1 - drag.y / 400)})` } : undefined}
    >
      {/* Barra de cima: contador + fechar */}
      <div
        className="flex shrink-0 items-center justify-between px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-6 sm:pt-6"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-semibold tabular-nums text-white/90" aria-live="polite">
          {index + 1} <span className="text-white/40">/ {fotos.length}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar galeria (Esc)"
          autoFocus
          className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-[background-color,color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer border border-white/10"
        >
          <IconX size={20} stroke={2.5} />
        </button>
      </div>

      {/* Foto: ocupa todo o espaço que sobra entre as barras */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center sm:px-24">
        {temVarias && (
          <button
            type="button"
            onClick={prevImage}
            aria-label="Foto anterior (seta esquerda)"
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 text-white/80 hover:text-white bg-black/40 sm:bg-white/10 hover:bg-white/20 p-2 sm:left-6 sm:p-3.5 rounded-full transition-[background-color,color,border-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer flex items-center justify-center border border-white/10 hover:scale-105"
          >
            <IconChevronLeft size={22} stroke={2.5} />
          </button>
        )}

        <div
          ref={imgWrapRef}
          className="relative h-full w-full max-w-6xl touch-none overflow-hidden select-none"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <div
            className={`absolute inset-0 ${arrastando ? '' : 'transition-transform duration-300 ease-out'}`}
            style={{ transform: `translate3d(${drag.x}px, ${drag.y}px, 0)` }}
          >
            <Image
              key={fotos[index]}
              src={fotos[index]}
              alt={`${alt} - Foto ${index + 1}`}
              fill
              priority
              draggable={false}
              className={`object-contain transition-transform duration-300 ease-out ${
                zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
              }`}
              style={{
                transform: `scale(${zoomed ? ZOOM_SCALE : 1})`,
                transformOrigin: `${origin.x}% ${origin.y}%`,
              }}
              sizes="100vw"
              onClick={handleImageClick}
              onPointerMove={handleImagePointerMove}
            />
          </div>
        </div>

        {temVarias && (
          <button
            type="button"
            onClick={nextImage}
            aria-label="Próxima foto (seta direita)"
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-white/80 hover:text-white bg-black/40 sm:bg-white/10 hover:bg-white/20 p-2 sm:right-6 sm:p-3.5 rounded-full transition-[background-color,color,border-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer flex items-center justify-center border border-white/10 hover:scale-105"
          >
            <IconChevronRight size={22} stroke={2.5} />
          </button>
        )}
      </div>

      {/* Barra de baixo: dica + miniaturas */}
      <div
        className="flex shrink-0 flex-col items-center gap-3 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-white/50 transition-opacity ${
            zoomed ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <IconZoomIn size={13} stroke={2.2} />
          <span className="[@media(pointer:coarse)]:hidden">Clique na foto pra ampliar</span>
          <span className="hidden [@media(pointer:coarse)]:inline">
            Toque pra ampliar{temVarias ? ' · deslize pra trocar' : ''}
          </span>
        </span>

        {temVarias && (
          // Sem w-full/justify-center: o pai centraliza a faixa quando cabe, e
          // quando não cabe ela rola a partir da primeira miniatura (com
          // justify-center as primeiras ficariam cortadas fora do scroll).
          <div className="flex max-w-full gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-w-3xl">
            {fotos.map((url, i) => (
              <button
                key={i}
                ref={(el) => {
                  thumbRefs.current[i] = el
                }}
                type="button"
                onClick={() => irPara(() => i)}
                aria-label={`Ver foto ${i + 1}`}
                aria-current={i === index}
                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-md cursor-pointer transition-[opacity,box-shadow] duration-200 ${
                  i === index ? 'opacity-100 ring-2 ring-white' : 'opacity-50 hover:opacity-80'
                }`}
              >
                <Image src={url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

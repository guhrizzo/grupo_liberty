'use client'

import { useEffect, useRef, useState } from 'react'
import { IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react'
import styles from './entrada.module.css'

export default function VideoEntrada() {
  const video = useRef<HTMLVideoElement>(null)
  const [visivel, setVisivel] = useState(false)
  const [reproduzindo, setReproduzindo] = useState(false)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    const elemento = video.current
    if (!elemento) return

    const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)')
    function atualizar() {
      if (movimentoReduzido.matches) elemento?.pause()
      else void elemento?.play().catch(() => {})
    }

    atualizar()
    movimentoReduzido.addEventListener('change', atualizar)
    return () => movimentoReduzido.removeEventListener('change', atualizar)
  }, [])

  function alternar() {
    const elemento = video.current
    if (!elemento) return
    if (elemento.paused) void elemento.play().catch(() => {})
    else elemento.pause()
  }

  return (
    <>
      <video
        ref={video}
        className={styles.video}
        data-visivel={visivel}
        src="/portal-liberty-entrada.mp4"
        aria-hidden="true"
        preload="none"
        muted
        loop
        playsInline
        onPlaying={() => {
          setVisivel(true)
          setReproduzindo(true)
        }}
        onPause={() => setReproduzindo(false)}
        onError={() => {
          setVisivel(false)
          setFalhou(true)
        }}
      />
      {!falhou && (
        <button
          type="button"
          className={styles.controleVideo}
          aria-label={reproduzindo ? 'Pausar vídeo' : 'Reproduzir vídeo'}
          onClick={alternar}
        >
          {reproduzindo ? <IconPlayerPause aria-hidden size={18} /> : <IconPlayerPlay aria-hidden size={18} />}
        </button>
      )}
    </>
  )
}

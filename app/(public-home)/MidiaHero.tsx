'use client'

import { useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import frame from '@/app/public/hero-liberty-frame.webp'
import styles from './HeroLiberty.module.css'

const chaveDesempenho = 'liberty-hero-desempenho'
const eventoDesempenho = 'liberty:hero-desempenho'
const consultas = ['(prefers-reduced-motion: reduce)', '(prefers-reduced-data: reduce)']
type Conexao = EventTarget & { saveData?: boolean }

function conexao() {
  return (navigator as Navigator & { connection?: Conexao }).connection
}

function lerModo() {
  if (consultas.some((consulta) => matchMedia(consulta).matches) || conexao()?.saveData) return 'automatico'
  try {
    return localStorage.getItem(chaveDesempenho) === '1' ? 'desempenho' : 'video'
  } catch {
    return 'video'
  }
}

function observarModo(atualizar: () => void) {
  const midias = consultas.map((consulta) => matchMedia(consulta))
  const rede = conexao()
  midias.forEach((midia) => midia.addEventListener('change', atualizar))
  rede?.addEventListener('change', atualizar)
  window.addEventListener('storage', atualizar)
  window.addEventListener(eventoDesempenho, atualizar)
  return () => {
    midias.forEach((midia) => midia.removeEventListener('change', atualizar))
    rede?.removeEventListener('change', atualizar)
    window.removeEventListener('storage', atualizar)
    window.removeEventListener(eventoDesempenho, atualizar)
  }
}

function VideoHero() {
  const [reproduzindo, setReproduzindo] = useState(false)
  return (
    <video
      src="/hero-liberty.mp4"
      className={`${styles.carro} ${styles.video}`}
      data-reproduzindo={reproduzindo}
      aria-hidden="true"
      autoPlay
      muted
      loop
      playsInline
      onPlaying={() => setReproduzindo(true)}
      onError={() => setReproduzindo(false)}
    />
  )
}

export default function MidiaHero() {
  const modo = useSyncExternalStore(observarModo, lerModo, () => 'automatico')

  return (
    <div className={styles.imagem}>
      <Image src={frame} alt="" fill preload sizes="100vw" className={styles.carro} />
      {modo === 'video' && <VideoHero />}
    </div>
  )
}

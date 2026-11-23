'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import logo from '@/app/public/logo-liberty-car-white.png'
import styles from './PreloaderPublico.module.css'

export default function PreloaderPublico() {
  const abertura = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const elemento = abertura.current
    if (!elemento || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const chave = 'liberty-abertura-publica'
    try {
      if (sessionStorage.getItem(chave)) return
      sessionStorage.setItem(chave, '1')
    } catch {
      // A abertura continua disponível quando o armazenamento está bloqueado.
    }

    elemento.dataset.ativa = 'true'
  }, [])

  return (
    <div ref={abertura} className={styles.abertura} aria-hidden="true">
      <div className={styles.marca}>
        <Image src={logo} alt="" width={156} loading="eager" />
        <span className={styles.trilho} />
      </div>
    </div>
  )
}

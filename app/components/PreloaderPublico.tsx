'use client'

import { useLayoutEffect, useRef } from 'react'
import Image from 'next/image'
import logo from '@/app/public/logo-liberty-car-white.png'
import styles from './PreloaderPublico.module.css'

const chave = 'liberty-abertura-publica'
const movimentoReduzido = '(prefers-reduced-motion: reduce)'

// O navegador executa este script ao ler o HTML, antes da hidratação.
const iniciarAbertura = `(() => {
  const elemento = document.currentScript.parentElement;
  if (matchMedia(${JSON.stringify(movimentoReduzido)}).matches) return;
  try {
    if (sessionStorage.getItem(${JSON.stringify(chave)})) return;
    sessionStorage.setItem(${JSON.stringify(chave)}, '1');
  } catch {}
  elemento.dataset.ativa = 'true';
})();`

export default function PreloaderPublico() {
  const abertura = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const elemento = abertura.current
    // Na navegação pelo cliente, o script inserido pelo React não é executado.
    if (!elemento || elemento.dataset.ativa || window.matchMedia(movimentoReduzido).matches) return

    try {
      if (sessionStorage.getItem(chave)) return
      sessionStorage.setItem(chave, '1')
    } catch {
      // A abertura continua disponível quando o armazenamento está bloqueado.
    }

    elemento.dataset.ativa = 'true'
  }, [])

  return (
    <div ref={abertura} className={styles.abertura} aria-hidden="true" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: iniciarAbertura }} />
      <div className={styles.marca}>
        <Image src={logo} alt="" width={156} loading="eager" fetchPriority="high" />
        <span className={styles.trilho} />
      </div>
    </div>
  )
}

'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { IconMoon, IconSun } from '@tabler/icons-react'
import { lerTemaPortalNoNavegador, observarTemaPortal, salvarTemaPortal, type TemaPortal } from '@/utils/portal/preferencia-tema'
import styles from './entrada.module.css'

export default function TemaEntrada({ temaInicial, children }: { temaInicial: TemaPortal; children: ReactNode }) {
  const tema = useSyncExternalStore(observarTemaPortal, lerTemaPortalNoNavegador, () => temaInicial)
  const escuro = tema === 'dark'
  const rotulo = escuro ? 'Ativar tema claro' : 'Ativar tema escuro'

  return (
    <main className={`${styles.paleta} ${styles.shell}`} data-tema={tema}>
      {children}
      <button type="button" className={styles.tema} aria-label={rotulo} title={rotulo} onClick={() => salvarTemaPortal(escuro ? 'light' : 'dark')}>
        {escuro ? <IconSun aria-hidden size={18} /> : <IconMoon aria-hidden size={18} />}
      </button>
    </main>
  )
}

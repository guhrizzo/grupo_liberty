'use client'

import { useSyncExternalStore } from 'react'
import { detectarMobileNoNavegador } from './dispositivo'

const semAssinatura = () => () => {}

/** true = celular/tablet, false = computador, null = ainda não sabemos (servidor/hidratação). */
export function useDispositivoMobile(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    semAssinatura,
    () => detectarMobileNoNavegador(),
    () => null,
  )
}

'use client'

import { useCallback, useSyncExternalStore } from 'react'

export type ModoVisualizacao = 'blocos' | 'lista'

// Preferência por pessoa, guardada só neste navegador. useSyncExternalStore
// evita divergência na hidratação (o servidor sempre renderiza 'blocos').
const ouvintes = new Set<() => void>()
// Reserva em memória para quando o localStorage não está disponível.
const memoria = new Map<string, ModoVisualizacao>()

function ler(chave: string): ModoVisualizacao {
  try {
    const salvo = localStorage.getItem(chave)
    if (salvo === 'lista' || salvo === 'blocos') return salvo
  } catch {
    // segue para a memória
  }
  return memoria.get(chave) ?? 'blocos'
}

function assinar(aviso: () => void) {
  ouvintes.add(aviso)
  window.addEventListener('storage', aviso)
  return () => {
    ouvintes.delete(aviso)
    window.removeEventListener('storage', aviso)
  }
}

/** Modo de visualização (blocos ou lista) lembrado por tela, via `chave`. */
export function useModoVisualizacao(chave: string): [ModoVisualizacao, (m: ModoVisualizacao) => void] {
  const modo = useSyncExternalStore(
    assinar,
    () => ler(chave),
    () => 'blocos' as const,
  )
  const definir = useCallback(
    (m: ModoVisualizacao) => {
      memoria.set(chave, m)
      try {
        localStorage.setItem(chave, m)
      } catch {
        // Sem storage (aba anônima etc.): fica na memória até recarregar.
      }
      ouvintes.forEach((o) => o())
    },
    [chave],
  )
  return [modo, definir]
}

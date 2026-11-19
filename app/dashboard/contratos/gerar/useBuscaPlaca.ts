'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/app/components/ui'

// Busca por placa (Sistema Puxa Placa) compartilhada pelos formulários de contrato e de
// recibo. Mesmo endpoint do cadastro de veículo. Assim que a placa fica completa e
// válida, consulta sozinha (debounce de 600 ms). O resultado fica 24 h em cache no
// servidor, então repetir a mesma placa no dia não gasta saldo.

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
const limpar = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '')

export interface DadosPlaca {
  marca?: string
  modelo?: string
  anoModelo?: string | number
  cor?: string
  chassi?: string
  renavam?: string
  rouboFurto?: string
}

/**
 * @param placa  placa digitada (com ou sem máscara)
 * @param ativo  false desliga a busca (ex.: veículo do estoque escolhido: os dados dele valem)
 * @param onDados recebe os dados encontrados para o formulário preencher os campos
 */
export function useBuscaPlaca(placa: string, ativo: boolean, onDados: (d: DadosPlaca) => void) {
  const toast = useToast()
  const [buscando, setBuscando] = useState(false)
  const jaBuscadaRef = useRef('')
  const onDadosRef = useRef(onDados)
  useEffect(() => {
    onDadosRef.current = onDados
  })

  const buscar = useCallback(
    async (p: string) => {
      setBuscando(true)
      try {
        const res = await fetch(`/api/consulta-placa?placa=${p}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.message || err.error || 'Não encontramos registro para a placa informada.')
        }
        const data = (await res.json()) as DadosPlaca
        onDadosRef.current(data)
        if (data.rouboFurto && data.rouboFurto !== 'NAO') {
          toast.error(`Status retornado: ${data.rouboFurto}. Confira antes de seguir.`, 'Ocorrência de roubo/furto')
        } else {
          toast.success('Marca, modelo, ano, cor, chassi e RENAVAM preenchidos. Confira os dados.', 'Placa encontrada')
        }
      } catch (err) {
        // Permite tentar de novo quando a placa for editada.
        jaBuscadaRef.current = ''
        toast.error(err instanceof Error ? err.message : 'Erro ao consultar a placa.', 'Falha na busca')
      } finally {
        setBuscando(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    if (!ativo) return
    const p = limpar(placa)
    if (!PLACA_REGEX.test(p)) {
      jaBuscadaRef.current = ''
      return
    }
    if (jaBuscadaRef.current === p) return
    const id = window.setTimeout(() => {
      jaBuscadaRef.current = p
      void buscar(p)
    }, 600)
    return () => window.clearTimeout(id)
  }, [placa, ativo, buscar])

  /** Marca a placa como já resolvida (não consulta), ex.: ao escolher um veículo do estoque. */
  const marcarJaBuscada = useCallback((p: string) => {
    jaBuscadaRef.current = limpar(p)
  }, [])

  return { buscando, marcarJaBuscada }
}

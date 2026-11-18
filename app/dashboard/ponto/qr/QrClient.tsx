'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { QR_JANELA_MS } from '@/constants/ponto'
import { useDispositivoMobile } from '@/utils/ponto/useDispositivoMobile'
import { getTokenQr } from './actions'

/** Renova o token um pouco antes da janela virar, para nunca exibir um QR vencido. */
const RENOVAR_APOS_MS = QR_JANELA_MS - 5_000

/** O QR só é gerado em computador; no celular mostra o aviso e nem pede o token. */
export default function QrClient() {
  const mobile = useDispositivoMobile()
  if (mobile === null) return null
  if (mobile) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="font-semibold text-amber-900">O QR code só pode ser gerado em um computador.</p>
        <p className="mt-1 text-sm text-amber-800">
          Abra esta página no computador (ou numa TV/tablet em modo computador) e deixe-a na empresa. No celular,
          use apenas a leitura do QR em &quot;Bater ponto&quot;.
        </p>
      </div>
    )
  }
  return <QrExibicao />
}

function QrExibicao() {
  const [imagem, setImagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [restante, setRestante] = useState(100)
  const inicioRef = useRef(0)

  useEffect(() => {
    let ativo = true
    let timer: ReturnType<typeof setTimeout>

    async function renovar() {
      const r = await getTokenQr().catch(() => null)
      if (!ativo) return
      if (!r || !r.ok) {
        setErro(r && !r.ok ? r.erro : 'Sem conexão. Tentando de novo...')
        timer = setTimeout(renovar, 5_000)
        return
      }
      const url = `${window.location.origin}/dashboard/ponto/bater?t=${r.token}`
      const png = await QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: 'M' })
      if (!ativo) return
      setErro(null)
      setImagem(png)
      inicioRef.current = Date.now()
      timer = setTimeout(renovar, RENOVAR_APOS_MS)
    }

    renovar()
    return () => {
      ativo = false
      clearTimeout(timer)
    }
  }, [])

  // Barra de tempo até o próximo QR.
  useEffect(() => {
    const id = setInterval(() => {
      if (!inicioRef.current) return
      const pct = 100 - ((Date.now() - inicioRef.current) / RENOVAR_APOS_MS) * 100
      setRestante(Math.max(0, Math.min(100, pct)))
    }, 250)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
      {erro ? (
        <p className="py-16 text-center text-sm font-medium text-rose-600">{erro}</p>
      ) : imagem ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagem} alt="QR code para bater o ponto" className="aspect-square w-full max-w-md" />
      ) : (
        <div className="aspect-square w-full max-w-md animate-pulse rounded-xl bg-neutral-100" />
      )}
      <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full bg-liberty transition-[width] duration-200 ease-linear" style={{ width: `${restante}%` }} />
      </div>
      <p className="text-center text-sm font-semibold text-neutral-700">
        Aponte a câmera do celular para bater o ponto
      </p>
    </div>
  )
}

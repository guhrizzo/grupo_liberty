'use client'

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

/** Extrai o token de um QR do ponto; null se o QR não for do nosso ponto. */
export function tokenDoQr(texto: string): string | null {
  try {
    const url = new URL(texto)
    if (url.origin !== window.location.origin) return null
    if (url.pathname !== '/dashboard/ponto/bater') return null
    return url.searchParams.get('t')
  } catch {
    return null
  }
}

/**
 * Abre a câmera traseira e lê QR codes. Monte o componente só quando for usar:
 * a câmera liga ao montar e desliga ao desmontar.
 */
export default function LeitorQr({ onToken }: { onToken: (token: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onTokenRef = useRef(onToken)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    let ativo = true
    let stream: MediaStream | null = null
    let raf = 0
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    function varrer() {
      const video = videoRef.current
      if (!ativo || !video || !ctx) return
      if (video.readyState >= 2 && video.videoWidth > 0) {
        // Reduz a imagem: leitura mais rápida e suficiente para um QR de tela.
        const escala = Math.min(1, 640 / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * escala)
        canvas.height = Math.round(video.videoHeight * escala)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
        if (qr?.data) {
          const token = tokenDoQr(qr.data)
          if (token) {
            ativo = false
            onTokenRef.current(token)
            return
          }
          setAviso('Esse QR não é do ponto da empresa.')
        }
      }
      raf = requestAnimationFrame(varrer)
    }

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro('Este navegador não permite abrir a câmera aqui. Use a câmera do celular para ler o QR.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (!ativo) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        raf = requestAnimationFrame(varrer)
      } catch (e) {
        const nome = (e as DOMException)?.name
        setErro(
          nome === 'NotAllowedError'
            ? 'Permissão da câmera negada. Libere a câmera para este site nas configurações do navegador.'
            : nome === 'NotFoundError'
              ? 'Nenhuma câmera encontrada neste aparelho.'
              : 'Não foi possível abrir a câmera.',
        )
      }
    }

    iniciar()
    return () => {
      ativo = false
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  if (erro) return <p className="py-6 text-center text-sm font-medium text-rose-600">{erro}</p>

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
        <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/80" />
      </div>
      <p className="text-center text-sm text-neutral-600">
        {aviso ?? 'Aponte para o QR code da tela da empresa.'}
      </p>
    </div>
  )
}
